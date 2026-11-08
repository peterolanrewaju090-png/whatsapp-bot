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

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const body = text.trim();
    const lower = body.toLowerCase();
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender === OWNER_NUMBER || from === OWNER_NUMBER;

    if (isGroup && !lower.startsWith('.') && !isOwner) {
      const foundBadWord = BAD_WORDS.find(w => lower.includes(w));
      if (foundBadWord) { await autoWarn(from, sender, `Foul language`, msg); return; }
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

    if (lower === '.ping') await sock.sendMessage(from, { text: 'Pong! Luffy Bot is alive!' }, { quoted: msg });

    if (lower === '.menu') {
      await sock.sendMessage(from, { text: 'LUFFY BOT MENU\n\n.ping - Check if bot is alive\n.menu - Show this menu\n.hi - Say hi\n.afx + question - Ask Luffy AI + Sticker\n.afx @person + question - Ask Luffy about someone (tags them)\n.warn @person - Warn a person\n.warnings @person - Check warns\n.unwarn @person - Remove one warn\n\nAUTO RULES:\n- Foul language = Auto Warn\n- Spamming = Auto Warn\n- 3 warns = Automatic removal\n- Owner can never be warned' }, { quoted: msg });
    }

    if (lower === '.hi' || lower === 'hi') await sock.sendMessage(from, { text: 'Hey! It is Luffy here. What do you want me to do?' }, { quoted: msg });

    if (lower.startsWith('.afx') || lower.startsWith('.ai')) {
      const question = body.replace(/^\.(afx|ai)\s*/i, '');
      if (!question) {
        await sock.sendMessage(from, { text: 'Please write something after .afx. Examples:\n.afx my bea has run\n.afx @Raymond my bea has run' }, { quoted: msg });
        return;
      }
      let reply = '';
      let tagText = '';
      if (mentioned.length > 0) tagText = mentioned.map(jid => `@${jid.split('@')[0]}`).join(' ');
      if (lower.includes('bea') || lower.includes('babe') || lower.includes('girlfriend') || lower.includes('boyfriend') || lower.includes('run') || lower.includes('left')) {
        reply = `Luffy says: ${tagText}\n\nYou said: "${question}"\n\nListen, don't panic. If she has run, first calm down and give her some space. Don't spam her with messages. Think about what happened. Did you offend her? If yes, apologize honestly like a real man.\n\nIf she truly loves you, she will come back. If she does not come back, then she was not your One Piece. Your treasure is still out there.\n\nFor now: eat well, focus on yourself, and become a better version of you. Kings don't chase, they attract.`;
      } else {
        reply = `Luffy says: ${tagText}\n\nYou asked: "${question}"\n\nAs your captain, my advice is simple: Don't give up. Whatever the problem is, face it head-on like I face my enemies. Rest, think clearly, make a plan, and attack it again.\n\nYou are stronger than you think. I believe in you!`;
      }
      if (mentioned.length === 0) reply = reply.replace('Luffy says: \n', 'Luffy says:\n');
      await sock.sendMessage(from, { text: reply, mentions: mentioned }, { quoted: msg });
      try { await sock.sendMessage(from, { sticker: { url: LUFFY_STICKER_URL } }); } catch (e) { console.log('Sticker failed'); }
    }

    if (lower.startsWith('.warn')) {
      if (!isGroup) return sock.sendMessage(from, { text: 'Warn only works in a group.' }, { quoted: msg });
      if (mentioned.length === 0) return sock.sendMessage(from, { text: 'Please tag the person you want to warn. Example: .warn @Raymond' }, { quoted: msg });
      const target = mentioned[0];
      if (target === OWNER_NUMBER) return sock.sendMessage(from, { text: 'You cannot warn the owner!' }, { quoted: msg });
      await autoWarn(from, target, `Manual warn`, msg);
    }
    if (lower.startsWith('.warnings')) {
      if (mentioned.length === 0) return sock.sendMessage(from, { text: 'Please tag the person. Example: .warnings @Raymond' }, { quoted: msg });
      const target = mentioned[0];
      const count = warns[target] || 0;
      await sock.sendMessage(from, { text: `@${target.split('@')[0]} has ${count}/3 warns`, mentions: [target] }, { quoted: msg });
    }
    if (lower.startsWith('.unwarn')) {
      if (mentioned.length === 0) return sock.sendMessage(from, { text: 'Please tag the person. Example: .unwarn @Raymond' }, { quoted: msg });
      const target = mentioned[0];
      warns[target] = Math.max(0, (warns[target] || 0) - 1);
      await sock.sendMessage(from, { text: `@${target.split('@')[0]} warn has been reduced. Now they have ${warns[target]}/3 warns`, mentions: [target] }, { quoted: msg });
    }
  });
}
startBot();
