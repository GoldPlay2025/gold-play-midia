import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys';

async function test() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log("Latest version:", version);
}
test();
