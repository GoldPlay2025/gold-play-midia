import { makeWASocket, useMultiFileAuthState, delay, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./wa-auth-test');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['Ubuntu', 'Chrome', '111.0.0.0'],
  });

  sock.ev.on('connection.update', (update) => {
    console.log("Connection update:", update);
  });
  sock.ev.on('creds.update', saveCreds);
}
connect();
