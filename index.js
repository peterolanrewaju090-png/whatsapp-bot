// LUFFY BOT - English Version
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const BOT_NAME = 'Luffy';
const PREFIX = '.';
let warnings = {};
let mutedGroups = {};

async function startLuffy() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: [BOT_NAME, 'Chrome', '1.0']
    });

    // Pairing Code - use your phone number
    if (!sock.authState.creds.registered) {
        const phoneNumber = '2349013635052';
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n=== ${BOT_NAME} PAIRING CODE: ${code} ===`);
            console.log('Go to WhatsApp > Linked Devices > Link with phone number > Type this code\n');
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...');
            if (shouldReconnect) startLuffy();
        } else if (connection === 'open') {
            console.log(`${BOT_NAME} is ONLINE!`);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || from;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';
        if (!body.startsWith(PREFIX)) return;
        const args = body.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const text = args.join(' ');
        const reply = (txt) => sock.sendMessage(from, { text: txt }, { quoted: msg });

        if (isGroup && mutedGroups[from] && command !== 'unmute') return;

        if (command === 'menu' || command === 'help') {
            return reply(`🏴‍☠️ *${BOT_NAME} BOT - MENU* 🏴‍☠️\n\n*General:*\n.menu - Show this menu\n.ping - Check if bot is alive\n.afx - Get AFX effects list\n\n*Group:*\n.mute - Mute group\n.unmute - Unmute group\n.warn @user - Warn a user (3 warns = kick)\n.warns - Check warnings\n.resetwarn @user - Clear warnings\n.kick @user - Remove user\n\n*Fun:*\n.sticker - Reply to image/video to make sticker\n.say <text> - Bot will say it\n\nBot by Luffy`);
        }

        if (command === 'ping') return reply(`Pong! 🏴‍☠️ ${BOT_NAME} is active!`);

        if (command === 'afx') {
            return reply(`✨ *AFX EFFECTS* ✨\n\nType one to use it:\n.afx1 - Blur effect\n.afx2 - Cool effect\n.afx3 - Fire effect\n.afx4 - Neon effect\n\nExample: *.afx1* (reply to an image)\n\nMore AFX coming soon!`);
        }
        if (['afx1','afx2','afx3','afx4'].includes(command)) {
            return reply(`✨ ${command.toUpperCase()} applied! Send an image with caption ${PREFIX}${command} to use AFX effect.`);
        }

        if (command === 'mute') {
            if (!isGroup) return reply('This command is for groups only.');
            mutedGroups[from] = true;
            return reply(`🔇 Group muted by ${BOT_NAME}. Type *.unmute* to unmute.`);
        }
        if (command === 'unmute') {
            if (!isGroup) return reply('This command is for groups only.');
            delete mutedGroups[from];
            return reply(`🔊 Group unmuted by ${BOT_NAME}.`);
        }

        if (command === 'warn') {
            if (!isGroup) return reply('This command is for groups only.');
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mentioned) return reply('Tag the person: *.warn @user*');
            warnings[mentioned] = (warnings[mentioned] || 0) + 1;
            if (warnings[mentioned] >= 3) {
                warnings[mentioned] = 0;
                await sock.sendMessage(from, { text: `⚠️ @${mentioned.split('@')[0]} has reached 3 warnings and will be removed.`, mentions: [mentioned] });
                await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
            } else {
                return reply(`⚠️ Warning ${warnings[mentioned]}/3 for @${mentioned.split('@')[0]}. Reason: ${text || 'No reason'}`);
            }
            return;
        }
        if (command === 'warns') {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender;
            return reply(`⚠️ @${mentioned.split('@')[0]} has ${warnings[mentioned] || 0}/3 warnings.`);
        }
        if (command === 'resetwarn') {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mentioned) return reply('Tag the person: *.resetwarn @user*');
            warnings[mentioned] = 0;
            return reply(`✅ Warnings cleared for @${mentioned.split('@')[0]}`);
        }
        if (command === 'kick') {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mentioned) return reply('Tag the person: *.kick @user*');
            await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
            return reply(`👢 @${mentioned.split('@')[0]} kicked by ${BOT_NAME}`);
        }

        if (command === 'sticker' || command === 's') {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageMsg = quoted?.imageMessage || quoted?.videoMessage || msg.message.imageMessage || msg.message.videoMessage;
            if (!imageMsg) return reply('Reply to an image/video with *.sticker*');
            try {
                const buffer = await sock.downloadMediaMessage({ message: { imageMessage: imageMsg }, key: msg.key });
                const sticker = new Sticker(buffer, { pack: BOT_NAME, author: 'Luffy Bot', type: StickerTypes.FULL, quality: 50 });
                const stickerBuffer = await sticker.toBuffer();
                return sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
            } catch (e) { return reply('Failed to make sticker. Try again.'); }
        }

        if (command === 'say') {
            if (!text) return reply('Type something: *.say Hello*');
            return reply(text);
        }
    });
}

startLuffy();
