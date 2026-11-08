const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Luffy Bot is running'));
app.listen(process.env.PORT || 10000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: true, browser: ['Luffy Bot', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u;
    if (connection === 'open') console.log('Luffy Bot Connected!');
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const body = text.trim().toLowerCase();

    if (body === '.ping' || body === 'ping') {
      await sock.sendMessage(from, { text: 'Pong! 🏴‍☠️ Luffy Bot is alive!' }, { quoted: msg });
    }
    if (body === '.menu' || body === 'menu') {
      await sock.sendMessage(from, { text: '🏴‍☠️ *LUFFY BOT MENU*\n\n.ping - Check bot\n.menu - This menu\n.sticker - Reply to image/video to make sticker' }, { quoted: msg });
    }
    if (body === '.sticker' || body === 'sticker') {
      await sock.sendMessage(from, { text: 'Reply to an image with .sticker' }, { quoted: msg });
    }
  });
}
startBot();
