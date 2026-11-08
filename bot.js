const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const ytdlp = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');

let mutedUsers = {};

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Chrome', 'Chrome', '14.4.1']
    });
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;
        if (qr) {
            console.clear();
            qrcode.generate(qr, { small: true });
            console.log('Scan this NEW QR FAST - it expires in 20 seconds!');
        }
        if (connection === 'open') console.log('Bot is ready!');
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Reconnecting...');
            if (shouldReconnect) start();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        if (!body.startsWith('.')) return;

        if (from.endsWith('@g.us') && mutedUsers[from] && mutedUsers[from].includes(sender)) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
            return;
        }

        const args = body.slice(1).split(' ');
        const command = args[0].toLowerCase();
        const query = args.slice(1).join(' ');

        if (command === 'ping') {
            return sock.sendMessage(from, { text: 'Pong! The bot is working.' });
        }

        if (command === 'mute') {
            let mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentioned && mentioned.length > 0) {
                let target = mentioned[0];
                if (!mutedUsers[from]) mutedUsers[from] = [];
                if (!mutedUsers[from].includes(target)) mutedUsers[from].push(target);
                return sock.sendMessage(from, { text: `@${target.split('@')[0]} has been muted. Their messages will be deleted.`, mentions: [target] });
            }
            try {
                await sock.groupSettingUpdate(from, 'announcement');
                return sock.sendMessage(from, { text: 'The group has been muted. Only admins can send messages.' });
            } catch (e) {
                return sock.sendMessage(from, { text: 'I could not mute the group. Please make me an admin first.' });
            }
        }

        if (command === 'unmute') {
            let mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (mentioned && mentioned.length > 0) {
                let target = mentioned[0];
                if (mutedUsers[from]) mutedUsers[from] = mutedUsers[from].filter(u => u !== target);
                return sock.sendMessage(from, { text: `@${target.split('@')[0]} has been unmuted. They can send messages now.`, mentions: [target] });
            }
            try {
                await sock.groupSettingUpdate(from, 'not_announcement');
                return sock.sendMessage(from, { text: 'The group has been unmuted. Everyone can send messages now.' });
            } catch (e) {
                return sock.sendMessage(from, { text: 'I could not unmute the group.' });
            }
        }

        if (command === 'demote') {
            let mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (!mentioned || mentioned.length === 0) return sock.sendMessage(from, { text: 'Tag the person. Example: .demote @Stephanie' });
            let target = mentioned[0];
            try {
                await sock.groupParticipantsUpdate(from, [target], 'demote');
                return sock.sendMessage(from, { text: `@${target.split('@')[0]} has been removed as admin.`, mentions: [target] });
            } catch (e) {
                return sock.sendMessage(from, { text: 'I could not remove them as admin. Please make me an admin first.' });
            }
        }

        if (command === 'promote') {
            let mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
            if (!mentioned || mentioned.length === 0) return sock.sendMessage(from, { text: 'Tag the person. Example: .promote @Stephanie' });
            let target = mentioned[0];
            try {
                await sock.groupParticipantsUpdate(from, [target], 'promote');
                return sock.sendMessage(from, { text: `@${target.split('@')[0]} is now an admin.`, mentions: [target] });
            } catch (e) {
                return sock.sendMessage(from, { text: 'I could not make them admin. Please make me an admin first.' });
            }
        }

        if (command === 'song' || command === 'play' || command === 'video') {
            if (!query) return sock.sendMessage(from, { text: 'Please provide a song name. Example: .play City Boys Burna Boy' });
            await sock.sendMessage(from, { text: `Searching for "${query}"... Please wait.` });
            const isVideo = command === 'video';
            const ext = isVideo ? 'mp4' : 'mp3';
            const fileName = `download_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, fileName);
            try {
                let url = query;
                if (!query.includes('http')) url = `ytsearch1:${query}`;
                await ytdlp(url, {
                    output: filePath,
                    format: isVideo ? 'mp4[height<=720]/best[height<=720]' : 'bestaudio',
                    extractAudio: !isVideo,
                    audioFormat: isVideo ? undefined : 'mp3',
                    noPlaylist: true,
                    quiet: true,
                    noWarnings: true,
                });
                if (!fs.existsSync(filePath)) return sock.sendMessage(from, { text: 'Download failed, please try another song.' });
                if (isVideo) {
                    await sock.sendMessage(from, { video: fs.readFileSync(filePath), mimetype: 'video/mp4', caption: 'Here is your video. Enjoy!' });
                } else {
                    await sock.sendMessage(from, { audio: fs.readFileSync(filePath), mimetype: 'audio/mpeg' });
                }
                fs.unlinkSync(filePath);
                await sock.sendMessage(from, { text: 'Here is your song. Enjoy!' });
            } catch (err) {
                console.log(err);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                sock.sendMessage(from, { text: 'Sorry, I could not download that song. Please try again.' });
            }
        }
    });
}
start();