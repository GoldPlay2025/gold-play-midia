const { makeWASocket } = require('@whiskeysockets/baileys');
const pino = require('pino');

try {
  const sock = makeWASocket({ printQRInTerminal: true });
  console.log("Socket initialized successfully");
  process.exit(0);
} catch (e) {
  console.error("Error initializing socket:", e);
  process.exit(1);
}
