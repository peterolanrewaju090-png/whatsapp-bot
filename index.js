const express = require('express');
const QRCode = require('qrcode');
const app = express();
let qrCodeImage = '';
let isConnected = false;

app.get('/', (req, res) => {
  if (isConnected) return res.send('<h1>Luffy Bot Connected!</h1>');
  if (!qrCodeImage) return res.send('<h1>Wait... generating QR... refresh in 5 sec</h1>');
  res.send(`<h1>Scan This QR With WhatsApp</h1><img src="${qrCodeImage}" style="width:300px"><script>setTimeout(()=>location.reload(), 15000)</script>`);
});
app.listen(process.env.PORT || 10000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');

let warns = {};
let spamTracker = {};
let lastMessages = {};
const LUFFY_STICKER_URL = 'https://i.imgur.com/3GvwH8h.png';
const BAD_WORDS = ['fuck', 'shit', 'bitch', 'bastard', 'idiot', 'stupid', 'mumu', 'ode', 'f*ck', 'asshole', 'dick', 'pussy', 'fool'];

const OWNER_NUMBER = '2349013635052@s.whatsapp.net';

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: false, browser: ['Luffy Bot', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) qrCodeImage = await QRCode.toDataURL(qr);
    if (connection === 'open') { isConnected = true; console.log('Luffy Bot Connected!'); }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    }
  });

  async function sendLuffySticker(from) {
    try { await sock.sendMessage(from, { sticker: { url: LUFFY_STICKER_URL } }); } catch (e) { console.log('Sticker failed'); }
  }

  function getLuffyAnswer(question, lower) {
    if (lower.includes('bea') || lower.includes('babe') || lower.includes('girlfriend') || lower.includes('boyfriend') || lower.includes('run') || lower.includes('left') || lower.includes('break up') || lower.includes('breakup')) {
      return `Luffy says:\n\nYou said: "${question}"\n\nListen, do not panic. If she has left, first calm down and give her some space. Do not spam her with messages. Think about what happened. Did you offend her? If yes, apologize honestly like a real man.\n\nIf she truly loves you, she will come back. If she does not come back, then she was not your One Piece. Your treasure is still out there.\n\nFor now: eat well, focus on yourself, and become a better version of you. Kings do not chase, they attract.`;
    }
    if (lower.includes('money') || lower.includes('broke') || lower.includes('poor') || lower.includes('rich')) {
      return `Luffy says:\n\nYou said: "${question}"\n\nMoney matters? Listen captain, no treasure comes easily. You must hustle like you want to be the Pirate King. Stop wasting time, learn one skill, stay consistent for 3 months, and the money will follow you.\n\nDo not compare yourself to others. Your journey is your own. Eat, sleep, hustle, repeat. I believe in you!`;
    }
    if (lower.includes('sad') || lower.includes('depress') || lower.includes('tired') || lower.includes('lonely') || lower.includes('cry')) {
      return `Luffy says:\n\nYou said: "${question}"\n\nHey, I am here. Even Luffy feels down sometimes, but I never give up. You are not alone. Rest a little, drink water, eat something, and talk to someone you trust.\n\nThis pain will pass. You are stronger than you think. Your crew still needs you. Do not give up!`;
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('good morning') || lower.includes('good evening') || lower.includes('how are you') || lower.includes('how are u') || lower.includes('hw are u') || lower.includes('hw are you') || lower.includes('how far') || lower.includes('howfar') || lower.includes('hw far') || lower.includes('whats up') || lower.includes("what's up") || lower.includes('wsp') || lower.includes('sup')) {
      return `Luffy says:\n\nYo! Your Captain Luffy is here! I am alive and ready! 🔥\n\nI am doing great! How are you doing? What do you want me to do for you? Type .menu to see all my powers, or ask me anything like:\n.afx my girlfriend left me\n.play Asake Why Love`;
    }
    if (lower.includes('who are you') || lower.includes('your name')) {
      return `Luffy says:\n\nI am Monkey D. Luffy! The future Pirate King! 👑\n\nI am here to answer questions, play songs, make stickers, warn bad members in the group, and keep this crew safe. Type .menu to see everything I can do.`;
    }
    return `Luffy says:\n\nYou asked: "${question}"\n\nAs your captain, my advice is simple: Do not give up. Whatever the problem is, face it head-on like I face my enemies. Rest, think clearly, make a plan, and attack it again.\n\nYou are stronger than you think. I believe in you!`;
  }

  async function autoWarn(from, target, reason, msg) {
    if (target === OWNER_NUMBER) return;
    warns[target] = (warns[target] || 0) + 1;
    const count = warns[target];
    if (count >= 3) {
      await sock.sendMessage(from, { text: `@${target.split('@')[0]} has reached 3 warns (${reason}). Luffy is removing this person automatically.`, mentions: [target] });
      warns[target] = 0;
      try { await sock.groupParticipantsUpdate(from, [target], 'remove'); }
      catch (e) { await sock.sendMessage(from, { text: 'I tried to remove the person but I could not. Please make me an admin in this group so I can remove members.' }); }
    } else {
      await sock.sendMessage(from, { text: `Automatic Warning ${count}/3 for @${target.split('@')[0]}!\nReason: ${reason}\nPlease behave. If you reach 3 warns, you will be removed automatically.`, mentions: [target] }, { quoted: msg });
    }
  }

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const isFromMe = msg.key.fromMe === true;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';
    const body = text.trim();
    const lower = body.toLowerCase();
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let sender = msg.key.participant || msg.key.remoteJid;
    if (isFromMe) sender = OWNER_NUMBER;
    const isOwner = isFromMe || sender === OWNER_NUMBER || from === OWNER_NUMBER;
    const isCommand = lower.startsWith('.');
    const hasImage = !!msg.message.imageMessage;
    const hasVideo = !!msg.message.videoMessage;

    // Auto-warn only for other people, never for owner, never for your own messages
    if (isGroup && !isCommand && !isOwner && !hasImage && !hasVideo) {
      const foundBadWord = BAD_WORDS.find(w => lower.includes(w));
      if (foundBadWord) { await autoWarn(from, sender, `Bad language`, msg); return; }
      const now = Date.now();
      if (!spamTracker[sender]) spamTracker[sender] = [];
      spamTracker[sender].push(now);
      spamTracker[sender] = spamTracker[sender].filter(t => now - t < 10000);
      if (spamTracker[sender].length >= 5) { spamTracker[sender] = []; await autoWarn(from, sender, `Spamming: too many messages too fast`, msg); return; }
      if (!lastMessages[sender]) lastMessages[sender] = { text: lower, count: 1 };
      else if (lastMessages[sender].text === lower && lower.length > 2) {
        lastMessages[sender].count++;
        if (lastMessages[sender].count >= 3) { lastMessages[sender].count = 0; await autoWarn(from, sender, `Spamming: same message repeatedly`, msg); return; }
      } else { lastMessages[sender] = { text: lower, count: 1 }; }
    }

    if (lower === '.ping') { await sock.sendMessage(from, { text: 'Pong! Luffy Bot is alive!' }, { quoted: msg }); await sendLuffySticker(from); return; }

    if (lower === '.menu') {
      await sock.sendMessage(from, { text: 'LUFFY BOT MENU\n\n.ping - Check if bot is alive\n.menu - Show this menu\n.hi - Say hi\n.s - Reply to photo/video to make sticker, or send photo with .s as caption\n.play + song name - Play song\n.afx + question - Ask Luffy AI + Sticker\n.afx @person + question - Ask Luffy about someone (tags them)\n.warn @person - Warn a person\n.warnings @person - Check warns\n.unwarn @person - Remove one warn\n\nTALK TO LUFFY:\nJust type Luffy + your question, or just say hw are u\nExample: Luffy my girlfriend left me\n\nAUTO RULES:\n- Bad language = Auto Warn\n- Spamming = Auto Warn\n- 3 warns = Automatic removal\n- Owner can never be warned' }, { quoted: msg });
      await sendLuffySticker(from);
      return;
    }

    if (lower === '.hi' || lower === 'hi') { await sock.sendMessage(from, { text: 'Hey! It is Luffy here. What do you want me to do?' }, { quoted: msg }); await sendLuffySticker(from); return; }

    if (lower === '.s' || lower === '.sticker' || lower === '.stiker') {
      const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
      try {
        if (quoted?.imageMessage || quoted?.videoMessage) {
          const quotedMsg = { key: { remoteJid: from, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant }, message: quoted };
          const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
        } else if (hasImage || hasVideo) {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { text: 'Reply to a photo or video with .s to turn it into a sticker.\nOr send a photo with .s as the caption.\nExample: Reply to photo, then type .s' }, { quoted: msg });
        }
      } catch (e) {
        console.log('Sticker error', e);
        await sock.sendMessage(from, { text: 'I could not make that sticker. Try a smaller photo or video, maximum 10 seconds.' }, { quoted: msg });
      }
      return;
    }

    if (lower.startsWith('.play')) {
      const songName = body.replace(/^\.play\s*/i, '');
      if (!songName) {
        await sock.sendMessage(from, { text: 'Please write the song name. Example:\n.play Asake Why Love\n.play Burna Boy City Boys' }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: `Searching for "${songName}"... Please wait, Luffy is finding your song...` }, { quoted: msg });
      try {
        const searchRes = await fetch(`https://yt.lemnoslife.com/noKey/search?part=snippet&q=${encodeURIComponent(songName)}&type=video&maxResults=1`);
        const searchData = await searchRes.json();
        const videoId = searchData?.items?.[0]?.id?.videoId;
        const title = searchData?.items?.[0]?.snippet?.title || songName;
        if (!videoId) throw new Error('not found');
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        await sock.sendMessage(from, { text: `Found it! 🎵\n\n*${title}*\n\nLink: ${videoUrl}\n\nNow downloading audio... please wait...` }, { quoted: msg });
        const audioRes = await fetch(`https://api.cobalt.tools/api/json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url: videoUrl, isAudioOnly: true, aFormat: 'mp3' }) });
        const audioData = await audioRes.json();
        const audioUrl = audioData?.url;
        if (!audioUrl) throw new Error('audio failed');
        await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mp4', fileName: `${title}.mp3` }, { quoted: msg });
      } catch (e) {
        console.log('Play error', e);
        const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`;
        await sock.sendMessage(from, { text: `I found the song but I could not download the audio. Click here to listen:\n${fallbackUrl}\n\nPlease try again with another song name.` }, { quoted: msg });
      }
      return;
    }

    if (lower.startsWith('.afx') || lower.startsWith('.ai')) {
      const question = body.replace(/^\.(afx|ai)\s*/i, '');
      if (!question) {
        await sock.sendMessage(from, { text: 'Please write something after .afx. Examples:\n.afx my girlfriend left me\n.afx @Raymond my girlfriend left me' }, { quoted: msg });
        return;
      }
      let tagText = '';
      if (mentioned.length > 0) tagText = mentioned.map(jid => `@${jid.split('@')[0]}`).join(' ');
      let reply = getLuffyAnswer(question, lower);
      if (mentioned.length > 0) reply = reply.replace('Luffy says:', `Luffy says: ${tagText}`);
      await sock.sendMessage(from, { text: reply, mentions: mentioned }, { quoted: msg });
      await sendLuffySticker(from);
      return;
    }

    if (lower.startsWith('.warn')) {
      if (!isGroup) return sock.sendMessage(from, { text: 'Warn only works in a group.' }, { quoted: msg });
      if (mentioned.length === 0) return sock.sendMessage(from, { text: 'Please tag the person you want to warn. Example: .warn @Raymond' }, { quoted: msg });
      const target = mentioned[0];
      if (target === OWNER_NUMBER) return sock.sendMessage(from, { text: 'You cannot warn the owner!' }, { quoted: msg });
      await autoWarn(from, target, `Manual warn`, msg);
      return;
    }
    if (lower.startsWith('.warnings')) {
      if (mentioned.length === 0) return sock.sendMessage(from, { text: 'Please tag the person. Example: .warnings @Raymond' }, { quoted: msg });
      const target = mentioned[0];
      const count = warns[target] || 0;
      await sock.sendMessage(from, { text: `@${target.split('@')[0]} has ${count}/3 warns`, mentions: [target] }, { quoted: msg });
      return;
    }
    if (lower.startsWith('.unwarn')) {
      if (mentioned.length === 0) return sock.sendMessage(from, { text: 'Please tag the person. Example: .unwarn @Raymond' }, { quoted: msg });
      const target = mentioned[0];
      warns[target] = Math.max(0, (warns[target] || 0) - 1);
      await sock.sendMessage(from, { text: `@${target.split('@')[0]} warn has been reduced. Now they have ${warns[target]}/3 warns`, mentions: [target] }, { quoted: msg });
      return;
    }

    if (!isCommand && body.length > 2 && !hasImage && !hasVideo) {
      const isGreeting = lower.includes('hw are u') || lower.includes('how are u') || lower.includes('how are you') || lower.includes('how far') || lower.includes('whats up') || lower.includes("what's up") || lower === 'hi' || lower === 'hello' || lower === 'hey';
      const talksToLuffy = lower.includes('luffy') || lower.includes('bot') || lower.includes('captain') || lower.endsWith('?') || isGreeting;
      if (talksToLuffy) {
        let tagText = '';
        if (mentioned.length > 0) tagText = mentioned.map(jid => `@${jid.split('@')[0]}`).join(' ');
        let reply = getLuffyAnswer(body, lower);
        if (mentioned.length > 0) reply = reply.replace('Luffy says:', `Luffy says: ${tagText}`);
        await sock.sendMessage(from, { text: reply, mentions: mentioned }, { quoted: msg });
        await sendLuffySticker(from);
        return;
      }
    }
  });
}
startBot();
