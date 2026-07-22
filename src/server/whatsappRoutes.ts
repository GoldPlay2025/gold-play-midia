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

// Helper para formatar e validar o JID do WhatsApp
const getValidJid = async (phone: string): Promise<string | null> => {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return null;

  // Se não tem código de país (55), adiciona se tiver 10 ou 11 dígitos
  if (!cleaned.startsWith('55') && (cleaned.length === 10 || cleaned.length === 11)) {
    cleaned = `55${cleaned}`;
  }

  // Tenta validar e buscar o JID exato via onWhatsApp
  if (sock && isConnected) {
    try {
      console.log(`Verificando JID no WhatsApp para o número: ${cleaned}`);
      const results = await sock.onWhatsApp(cleaned);
      if (results && results.length > 0 && results[0]?.exists) {
        console.log(`JID verificado com sucesso: ${results[0].jid}`);
        return results[0].jid;
      }

      // Se não encontrou e for número do Brasil com 13 dígitos (55 + DDD + 9 + 8 dígitos)
      // tenta buscar sem o nono dígito (muitos números no WhatsApp são registrados sem o 9)
      if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const altCleaned = cleaned.slice(0, 4) + cleaned.slice(5); // remove o 9
        console.log(`Tentando JID alternativo sem o nono dígito: ${altCleaned}`);
        const altResults = await sock.onWhatsApp(altCleaned);
        if (altResults && altResults.length > 0 && altResults[0]?.exists) {
          console.log(`JID alternativo verificado com sucesso: ${altResults[0].jid}`);
          return altResults[0].jid;
        }
      }

      // Se for número com 12 dígitos (55 + DDD + 8 dígitos), tenta com o 9 adicionado
      if (cleaned.length === 12 && cleaned.startsWith('55')) {
        const altCleaned = cleaned.slice(0, 4) + '9' + cleaned.slice(4); // adiciona o 9
        console.log(`Tentando JID alternativo com o nono dígito: ${altCleaned}`);
        const altResults = await sock.onWhatsApp(altCleaned);
        if (altResults && altResults.length > 0 && altResults[0]?.exists) {
          console.log(`JID alternativo verificado com sucesso: ${altResults[0].jid}`);
          return altResults[0].jid;
        }
      }
    } catch (err) {
      console.error('Erro ao consultar sock.onWhatsApp:', err);
    }
  }

  // Fallback padrão se não for possível consultar via onWhatsApp
  return `${cleaned}@s.whatsapp.net`;
};

// 4. Envio Manual
whatsappRouter.post('/send-manual', authMiddleware, async (req, res) => {
  try {
    const { numero, mensagem, imagemBase64, imagemUrl } = req.body;

    if (!isConnected || !sock) {
      return res.status(400).json({ error: 'WhatsApp não está conectado.' });
    }

    if (!numero || (!mensagem && !imagemBase64 && !imagemUrl)) {
      return res.status(400).json({ error: 'Número e mensagem ou imagem são obrigatórios.' });
    }

    const jid = await getValidJid(numero);
    if (!jid) {
      return res.status(400).json({ error: 'Número de telefone inválido ou não encontrado no WhatsApp.' });
    }

    console.log(`Enviando mensagem avulsa para JID: ${jid}`);

    let sentResult;
    if (imagemBase64) {
      const base64Clean = imagemBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Clean, 'base64');
      sentResult = await sock.sendMessage(jid, { image: imageBuffer, caption: mensagem || '' });
    } else if (imagemUrl) {
      sentResult = await sock.sendMessage(jid, { image: { url: imagemUrl }, caption: mensagem || '' });
    } else {
      sentResult = await sock.sendMessage(jid, { text: mensagem });
    }

    console.log('Mensagem enviada com sucesso! Result:', sentResult?.key);

    res.json({ success: true, message: 'Mensagem enviada com sucesso.', jid });
  } catch (error: any) {
    console.error('Erro no envio manual:', error);
    res.status(500).json({ error: 'Falha ao enviar a mensagem: ' + (error.message || 'Erro interno') });
  }
});

// 5. Envio em Lote (Cobrança)
whatsappRouter.post('/send-billing', authMiddleware, async (req, res) => {
  try {
    const { clientes, templateText, imagemBase64, imagemUrl } = req.body;

    if (!isConnected || !sock) {
      return res.status(400).json({ error: 'WhatsApp não está conectado.' });
    }

    if (!clientes || !Array.isArray(clientes)) {
      return res.status(400).json({ error: 'Lista de clientes inválida.' });
    }

    // Inicia o processo de envio em background
    const processBilling = async () => {
      for (const cliente of clientes) {
        const phone = cliente.whatsapp || cliente.telefone || cliente.contato;
        if (!phone) continue;
        
        try {
          const jid = await getValidJid(phone);
          if (!jid) continue;

          // Formatar valores para interpolação
          const nome = cliente.nome_empresa || cliente.nome || 'Cliente';
          const plano = cliente.plano || cliente.plano_nome || 'Gold Play';
          const valorFormatado = cliente.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor) : 'R$ 0,00';
          const vencimentoFormatado = cliente.vencimento ? new Date(cliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'data combinada';

          // Mensagem padrão caso não venha template customizado
          let msg = templateText || `Olá [Nome], aqui é da Gold Mídias.\n\nLembramos que o vencimento da sua fatura no valor de [Valor] está programado para [Vencimento].\n\nEvite a suspensão do serviço!`;

          // Substituir variáveis no template (suporta [Nome], {Nome}, [nome], etc.)
          msg = msg
            .replace(/\[Nome\]|\{Nome\}|\[nome\]|\{nome\}/g, nome)
            .replace(/\[Plano\]|\{Plano\}|\[plano\]|\{plano\}/g, plano)
            .replace(/\[Valor\]|\{Valor\}|\[valor\]|\{valor\}/g, valorFormatado)
            .replace(/\[Vencimento\]|\{Vencimento\}|\[vencimento\]|\{vencimento\}/g, vencimentoFormatado);

          // Enviar imagem com caption ou apenas texto
          if (imagemBase64) {
            const base64Clean = imagemBase64.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Clean, 'base64');
            await sock.sendMessage(jid, { image: imageBuffer, caption: msg });
          } else if (imagemUrl) {
            await sock.sendMessage(jid, { image: { url: imagemUrl }, caption: msg });
          } else {
            await sock.sendMessage(jid, { text: msg });
          }

          console.log(`Cobrança enviada com sucesso para ${phone} (JID: ${jid})`);
          
          // Delay de 3 a 5 segundos entre disparos para segurança antiban
          const waitTime = Math.floor(Math.random() * 2000) + 3000;
          await delay(waitTime);
        } catch (err) {
          console.error(`Erro ao enviar cobrança para cliente ${cliente.id || phone}:`, err);
        }
      }
    };

    // Executa em background
    processBilling();

    res.json({ success: true, message: `${clientes.length} cobranças agendadas para envio.` });
  } catch (error: any) {
    console.error('Erro no envio de cobrança:', error);
    res.status(500).json({ error: 'Falha ao iniciar o envio de cobranças.' });
  }
});
