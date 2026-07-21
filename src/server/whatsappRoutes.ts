import { Router } from 'express';
import { makeWASocket, DisconnectReason, delay, Browsers, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { useSupabaseAuthState, clearSupabaseAuth } from './supabaseAuthState';
import fs from 'fs';

export const whatsappRouter = Router();

// Middleware simples para proteger as rotas com API_KEY
const authMiddleware = (req: any, res: any, next: any) => {
  const apiKey = process.env.VITE_WHATSAPP_API_KEY || process.env.API_KEY || 'minha-chave-secreta';
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;

  if (providedKey !== apiKey) {
    return res.status(401).json({ error: 'Não autorizado. Chave de API inválida.' });
  }
  next();
};

// Variáveis globais
let sock: any = null;
let qrCodeBase64: string | null = null;
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

// Habilitando debug completo em arquivo para entender o loop de conexão
const logger = pino({ level: 'debug' }, pino.destination('./baileys-debug.log'));

// Inicializa a conexão com o WhatsApp
const connectToWhatsApp = async () => {
  if (isConnected && sock) return;

  // Usa armazenamento local temporariamente para evitar gargalo do Supabase
  const { state, saveCreds } = await useMultiFileAuthState('./wa-session');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    getMessage: async (key) => {
      return { conversation: '' };
    },
    browser: Browsers.macOS('Desktop'),
  });

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeBase64 = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      isConnected = false;
      qrCodeBase64 = null;
      
      console.log('Conexão fechada. Reconectar:', shouldReconnect, 'Código:', statusCode, 'Erro:', lastDisconnect?.error);
      
      if (shouldReconnect) {
        // Se for erro de rate limit ou similar, espera um pouco antes de reconectar
        setTimeout(connectToWhatsApp, 2000);
      } else {
        console.log('Deslogado. Limpando credenciais...');
        fs.rmSync('./wa-session', { recursive: true, force: true });
        sock = null;
      }
    } else if (connection === 'open') {
      console.log('Conectado ao WhatsApp!');
      isConnected = true;
      qrCodeBase64 = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);
};

// 1. Inicia a conexão e retorna o QRCode
whatsappRouter.get('/connect', authMiddleware, async (req, res) => {
  try {
    if (!sock || (!isConnected && !qrCodeBase64)) {
      await connectToWhatsApp();
      // Aguarda um pouco para o QR Code ser gerado
      await delay(2000);
    }

    res.json({
      connected: isConnected,
      qrCode: qrCodeBase64
    });
  } catch (error: any) {
    console.error('Erro no /connect:', error);
    res.status(500).json({ error: 'Erro ao conectar no WhatsApp.' });
  }
});

// 2. Verifica status
whatsappRouter.get('/status', authMiddleware, (req, res) => {
  res.json({ connected: isConnected });
});

// 3. Logout e limpa a sessão
whatsappRouter.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (sock) {
      sock.logout();
    }
    fs.rmSync('./wa-session', { recursive: true, force: true });
    sock = null;
    isConnected = false;
    qrCodeBase64 = null;
    
    res.json({ success: true, message: 'Desconectado com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao desconectar.' });
  }
});

// Helper para formatar o número do WhatsApp
const formatPhone = (phone: string) => {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) {
    cleaned = `55${cleaned}`;
  }
  return `${cleaned}@s.whatsapp.net`;
};

// 4. Envio Manual
whatsappRouter.post('/send-manual', authMiddleware, async (req, res) => {
  try {
    const { numero, mensagem } = req.body;

    if (!isConnected || !sock) {
      return res.status(400).json({ error: 'WhatsApp não está conectado.' });
    }

    if (!numero || !mensagem) {
      return res.status(400).json({ error: 'Número e mensagem são obrigatórios.' });
    }

    const jid = formatPhone(numero);
    await sock.sendMessage(jid, { text: mensagem });

    res.json({ success: true, message: 'Mensagem enviada com sucesso.' });
  } catch (error: any) {
    console.error('Erro no envio manual:', error);
    res.status(500).json({ error: 'Falha ao enviar a mensagem.' });
  }
});

// 5. Envio em Lote (Cobrança)
whatsappRouter.post('/send-billing', authMiddleware, async (req, res) => {
  try {
    const { clientes } = req.body;

    if (!isConnected || !sock) {
      return res.status(400).json({ error: 'WhatsApp não está conectado.' });
    }

    if (!clientes || !Array.isArray(clientes)) {
      return res.status(400).json({ error: 'Lista de clientes inválida.' });
    }

    // Inicia o processo de envio em background (para não travar a request se houver muitos clientes)
    const processBilling = async () => {
      for (const cliente of clientes) {
        if (!cliente.whatsapp) continue;
        
        try {
          const jid = formatPhone(cliente.whatsapp);
          const saudacao = `Olá ${cliente.nome_empresa}, aqui é da Gold Mídias.`;
          
          // Formatar moeda e data
          const valorFormatado = cliente.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor) : 'R$ 0,00';
          const vencimentoFormatado = cliente.vencimento ? new Date(cliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'data acordada';
          
          const msg = `${saudacao}\nLembramos que o vencimento da sua fatura no valor de ${valorFormatado} está programado para ${vencimentoFormatado}.\nEvite a suspensão do serviço!`;
          
          await sock.sendMessage(jid, { text: msg });
          console.log(`Cobrança enviada para ${cliente.whatsapp}`);
          
          // Delay de 3 a 5 segundos para evitar banimento
          const waitTime = Math.floor(Math.random() * 2000) + 3000;
          await delay(waitTime);
        } catch (err) {
          console.error(`Erro ao enviar para ${cliente.telefone}:`, err);
        }
      }
    };

    // Chamamos a função mas não aguardamos (async)
    processBilling();

    res.json({ success: true, message: `${clientes.length} cobranças agendadas para envio.` });
  } catch (error: any) {
    console.error('Erro no envio de cobrança:', error);
    res.status(500).json({ error: 'Falha ao iniciar o envio de cobranças.' });
  }
});
