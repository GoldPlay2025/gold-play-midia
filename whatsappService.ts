import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';

let sock: ReturnType<typeof makeWASocket> | null = null;
let currentQR: string | null = null;
let connectionStatus: 'connecting' | 'open' | 'close' = 'close';
let reconnectTimer: NodeJS.Timeout | null = null;

export async function connectToWhatsApp() {
    if (connectionStatus === 'connecting' || connectionStatus === 'open') return;
    connectionStatus = 'connecting';
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        if (sock) {
            (sock.ev as any).removeAllListeners();
            sock = null;
        }

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }) as any,
            browser: ['Gold Play Midia', 'Chrome', '1.0.0'],
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                currentQR = await QRCode.toDataURL(qr);
            }

            if (connection === 'close') {
                connectionStatus = 'close';
                currentQR = null;
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                console.log('Connection closed. Error:', lastDisconnect?.error?.message, 'StatusCode:', statusCode);
                
                if (sock) {
                    (sock.ev as any).removeAllListeners();
                    sock = null;
                }
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('Device logged out. Deleting session.');
                    if (fs.existsSync('auth_info_baileys')) {
                        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
                    }
                } else if (statusCode === 409 || statusCode === 440 || statusCode === 401 || statusCode === 515) { 
                    console.log('Connection conflict/replaced/stream errored. Will not automatically reconnect immediately to avoid loop.');
                } else {
                    console.log('Connection Failure. Reconnecting in 10 seconds...');
                    reconnectTimer = setTimeout(() => {
                        connectionStatus = 'close';
                        connectToWhatsApp();
                    }, 10000);
                }
            } else if (connection === 'open') {
                connectionStatus = 'open';
                currentQR = null;
                console.log('opened connection');
            }
        });
    } catch (err) {
        console.error("Error connecting to whatsapp", err);
        connectionStatus = 'close';
    }
}

export function getWhatsAppStatus() {
    return {
        status: connectionStatus,
        qr: currentQR
    };
}

export function logoutWhatsApp() {
    if (sock) {
        try {
            sock.logout();
        } catch (e) {}
        (sock.ev as any).removeAllListeners();
        sock = null;
    }
    connectionStatus = 'close';
    currentQR = null;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (fs.existsSync('auth_info_baileys')) {
        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
    }
}

export async function sendWhatsAppMessage(number: string, message: string) {
    if (connectionStatus !== 'open' || !sock) {
        throw new Error('WhatsApp não está conectado');
    }
    
    const jid = `${number.replace(/\D/g, '')}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
}

export async function startBillingJob(clients: any[], template: string) {
    if (connectionStatus !== 'open' || !sock) {
        console.error('WhatsApp not connected');
        return;
    }
    
    let index = 0;
    
    const sendNext = async () => {
        if (index >= clients.length) {
            console.log("Billing job finished.");
            return;
        }
        
        const client = clients[index];
        index++;
        
        if (client.whatsapp) {
            const message = template.replace(/{nome}/g, client.nome_empresa || client.nome).replace(/{whatsapp}/g, client.whatsapp);
            try {
                const jid = `${client.whatsapp.replace(/\D/g, '')}@s.whatsapp.net`;
                await sock!.sendMessage(jid, { text: message });
                console.log(`Billed ${client.nome_empresa}`);
            } catch (err) {
                console.error(`Error billing ${client.nome_empresa}:`, err);
            }
        }
        
        const delay = Math.floor(Math.random() * (15000 - 5000 + 1) + 5000);
        setTimeout(sendNext, delay);
    };
    
    sendNext();
}
