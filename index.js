const express = require('express');
const QRCode = require('qrcode');
const app = express();
let qrCodeImage = '';
let isConnected = false;

app.get('/', (req, res) => {
  if (isConnected) return res.send('<h1>Luffy Bot Connected! 🏴‍☠️</h1>');
  if (!qrCodeImage) return res.send('<h1>Wait... generating QR... refresh in 5 sec</h1>');
  res.send(`<h1>Scan This QR With WhatsApp</h1><img src="${qrCodeImage}" style="width:300px"><br><p>WhatsApp > Settings > Linked Devices > Link a Device</p><script>setTimeout(()=>location.reload(), 15000)</script>`);
});
app.get('/qr', (req, res) => res.redirect('/'));
app.listen(process.env.PORT || 10000);

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ logger: pino({ level: 'silent' }), auth: state, printQRInTerminal: false, browser: ['Luffy Bot', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      qrCodeImage = await QRCode.toDataURL(qr);
      console.log('New QR Generated - Open your website URL');
    }
    if (connection === 'open') { isConnected = true; console.log('Luffy Bot Connected!'); }
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
  });
}
startBot();
