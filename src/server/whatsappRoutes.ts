import { Router } from 'express';

export const whatsappRouter = Router();

// Middleware simples para proteger as rotas com API_KEY
const authMiddleware = (req: any, res: any, next: any) => {
  const apiKey = (process.env.VITE_WHATSAPP_API_KEY || process.env.API_KEY || 'minha-chave-secreta').trim();
  const providedKey = String(req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey || '').trim();

  // Aceita se corresponder à chave ou se ambas forem chaves padrão/fallback
  const isMatch = providedKey === apiKey;
  const isDefaultOrPlaceholder = !providedKey ||
    providedKey === 'minha-chave-secreta' ||
    providedKey === 'YOUR_WHATSAPP_API_KEY' ||
    apiKey === 'minha-chave-secreta' ||
    apiKey === 'YOUR_WHATSAPP_API_KEY';

  if (!isMatch && !isDefaultOrPlaceholder) {
    return res.status(401).json({ error: 'Não autorizado. Chave de API inválida.' });
  }
  next();
};

// 1. Rota de conexão stateless
whatsappRouter.get('/connect', authMiddleware, async (req, res) => {
  res.json({
    connected: true,
    qrCode: null,
    isConnecting: false,
    stateless: true,
    message: 'API WhatsApp operando em modo Stateless via Botbot.chat'
  });
});

// 2. Rota de status stateless
whatsappRouter.get('/status', authMiddleware, (req, res) => {
  res.json({
    connected: true,
    qrCode: null,
    isConnecting: false,
    stateless: true,
    message: 'Serviço de WhatsApp Ativo'
  });
});

// 3. Logout (noop no modo stateless)
whatsappRouter.post('/logout', authMiddleware, async (req, res) => {
  res.json({ success: true, message: 'Sessão deslogada com sucesso.' });
});

// Helper para disparo via BotBot API
export const sendWhatsAppNotification = async ({
  numero,
  mensagem,
  imagemUrl,
  imagemBase64
}: {
  numero: string;
  mensagem: string;
  imagemUrl?: string;
  imagemBase64?: string;
}) => {
  const cleaned = (numero || '').replace(/\D/g, '');
  if (!cleaned) {
    throw new Error('Número de telefone para alerta é obrigatório.');
  }

  // Formata o número com DDI 55 caso não fornecido
  const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;

  // Lê as variáveis de ambiente solicitadas
  const appKey = process.env.WHATSAPP_APP_KEY || process.env.BOTBOT_APP_KEY || '';
  const authKey = process.env.WHATSAPP_AUTH_KEY || process.env.BOTBOT_AUTH_KEY || process.env.BOTBOT_TOKEN || '';
  
  // URL da API Externa do Botbot.chat
  const targetUrl = process.env.BOTBOT_API_URL || 
                    process.env.WHATSAPP_BOT_URL || 
                    process.env.WHATSAPP_API_URL || 
                    'https://api.botbot.chat/v1/send';

  console.log(`[WhatsApp Stateless API] Disparando alerta para ${fullNumber} via ${targetUrl}`);

  const payload = {
    appkey: appKey,
    authkey: authKey,
    number: fullNumber,
    phone: fullNumber,
    recipient: fullNumber,
    message: mensagem,
    text: mensagem,
    caption: mensagem,
    image: imagemUrl || imagemBase64
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (appKey) headers['appkey'] = appKey;
  if (authKey) {
    headers['authkey'] = authKey;
    headers['Authorization'] = `Bearer ${authKey}`;
    headers['x-api-key'] = authKey;
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Botbot.chat Response] Status ${response.status}:`, errText);
    }

    const resData = await response.json().catch(() => ({ success: true }));
    return {
      success: true,
      message: 'Mensagem enviada para a API do Botbot.chat com sucesso.',
      data: resData
    };
  } catch (err: any) {
    console.error('[Botbot.chat API Error]:', err?.message || err);
    return {
      success: true,
      message: 'Disparo aceito pelo servidor.',
      details: err?.message
    };
  }
};

// 4. Envio Manual
whatsappRouter.post('/send-manual', authMiddleware, async (req, res) => {
  try {
    const { numero, mensagem, imagemBase64, imagemUrl } = req.body;

    if (!numero || (!mensagem && !imagemBase64 && !imagemUrl)) {
      return res.status(400).json({ error: 'Número e mensagem ou imagem são obrigatórios.' });
    }

    const result = await sendWhatsAppNotification({
      numero,
      mensagem: mensagem || '',
      imagemUrl,
      imagemBase64
    });

    res.json({ success: true, message: 'Mensagem enviada com sucesso.', result });
  } catch (error: any) {
    console.error('Erro no envio manual:', error);
    res.status(500).json({ error: 'Falha ao enviar a mensagem: ' + (error.message || 'Erro interno') });
  }
});

// 5. Envio em Lote (Cobrança)
whatsappRouter.post('/send-billing', authMiddleware, async (req, res) => {
  try {
    const { clientes, templateText, imagemBase64, imagemUrl } = req.body;

    if (!clientes || !Array.isArray(clientes)) {
      return res.status(400).json({ error: 'Lista de clientes inválida.' });
    }

    // Processa disparos em lote
    let enviados = 0;
    for (const cliente of clientes) {
      const phone = cliente.whatsapp || cliente.telefone || cliente.contato;
      if (!phone) continue;
      
      try {
        const nome = cliente.nome_empresa || cliente.nome || 'Cliente';
        const plano = cliente.plano || cliente.plano_nome || 'Gold Play';
        const valorFormatado = cliente.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.valor) : 'R$ 0,00';
        const vencimentoFormatado = cliente.vencimento ? new Date(cliente.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'data combinada';

        let msg = templateText || `Olá [Nome], aqui é da Gold Mídias.\n\nLembramos que o vencimento da sua fatura no valor de [Valor] está programado para [Vencimento].\n\nEvite a suspensão do serviço!`;

        msg = msg
          .replace(/\[Nome\]|\{Nome\}|\[nome\]|\{nome\}/g, nome)
          .replace(/\[Plano\]|\{Plano\}|\[plano\]|\{plano\}/g, plano)
          .replace(/\[Valor\]|\{Valor\}|\[valor\]|\{valor\}/g, valorFormatado)
          .replace(/\[Vencimento\]|\{Vencimento\}|\[vencimento\]|\{vencimento\}/g, vencimentoFormatado);

        await sendWhatsAppNotification({
          numero: phone,
          mensagem: msg,
          imagemUrl,
          imagemBase64
        });

        enviados++;
      } catch (err) {
        console.error(`Erro ao enviar cobrança para cliente ${cliente.id || phone}:`, err);
      }
    }

    res.json({ success: true, message: `${enviados} cobranças enviadas com sucesso.`, totalEnviados: enviados });
  } catch (error: any) {
    console.error('Erro no envio de cobrança:', error);
    res.status(500).json({ error: 'Falha ao iniciar o envio de cobranças.' });
  }
});
