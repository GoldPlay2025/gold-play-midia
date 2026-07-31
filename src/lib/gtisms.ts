import { createClient } from '@supabase/supabase-js';

export interface SendGtiSmsOptions {
  numero: string;
  mensagem: string;
  smsToken?: string;
  smsUrl?: string;
  senderId?: string;
  timeoutMs?: number;
}

export interface SendGtiSmsResult {
  success: boolean;
  message: string;
  rawResponse?: any;
}

export async function sendGtiSms(options: SendGtiSmsOptions): Promise<SendGtiSmsResult> {
  let token = options.smsToken || process.env.GTISMS_API_TOKEN || process.env.SMS_TOKEN || process.env.GTISMS_TOKEN;
  let senderId = options.senderId || process.env.GTISMS_SENDER_ID || '';

  // Fallback rápido: Busca token no Supabase em no máximo 1 segundo
  if (!token) {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const fetchConfPromise = (async () => {
          const { data: conf } = await supabase.from('configuracoes').select('*').eq('id', 'sistema').maybeSingle();
          if (conf) {
            if (conf.gtisms_token || conf.sms_token || conf.gtismsToken) {
              return {
                token: conf.gtisms_token || conf.sms_token || conf.gtismsToken,
                senderId: conf.gtisms_sender_id || conf.sms_sender_id || ''
              };
            }
          }
          const { data: autoConf } = await supabase.from('automacao_config').select('*').eq('id', 'sistema').maybeSingle();
          if (autoConf) {
            return {
              token: autoConf.gtisms_token || autoConf.sms_token || '',
              senderId: autoConf.gtisms_sender_id || ''
            };
          }
          return null;
        })();

        const timeoutPromise = new Promise<{ token?: string; senderId?: string } | null>(resolve => 
          setTimeout(() => resolve(null), 1200)
        );

        const dbRes = await Promise.race([fetchConfPromise, timeoutPromise]);
        if (dbRes?.token) {
          token = dbRes.token;
          if (!senderId && dbRes.senderId) senderId = dbRes.senderId;
        }
      }
    } catch (e) {
      console.warn('[sendGtiSms] Aviso ao buscar token no Supabase:', e);
    }
  }

  if (!token) {
    return {
      success: false,
      message: 'Token GTI SMS não configurado. Informe o Token do GTI SMS no painel em Perfil ou Automacao.'
    };
  }

  const cleaned = String(options.numero).replace(/\D/g, '');
  if (!cleaned) {
    return { success: false, message: 'Número de telefone é inválido.' };
  }

  const fullNumber = cleaned.startsWith('55') || cleaned.length > 11 ? cleaned : `55${cleaned}`;

  const sanitizeSms = (text: string) => {
    let sanitized = text.replace(/[\u00A0\u200B\u200C\u200D\u20FE\uFEFF]/g, ' ');
    sanitized = sanitized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return sanitized.replace(/[^\x00-\x7F]/g, '');
  };

  const sanitizedMsg = sanitizeSms(options.mensagem).substring(0, 160);
  const timeoutMs = options.timeoutMs ? Math.min(options.timeoutMs, 6000) : 5000;

  // Endpoint direto da API HTTP do GTI SMS
  const apiUrl = options.smsUrl && !options.smsUrl.includes('v3') 
    ? options.smsUrl 
    : 'https://sms.gtisms.com/api/http/sms/send';

  let timer: any = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);

    const payload: Record<string, any> = {
      api_token: token,
      recipient: fullNumber,
      message: sanitizedMsg
    };
    if (senderId) payload.sender_id = senderId;

    // Tenta POST com JSON na API HTTP
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const rawText = await resp.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch(e) { data = { raw: rawText }; }

    if (resp.ok && (data.status === 'success' || data.success === true || data.status === 100)) {
      return {
        success: true,
        message: data.message || `SMS enviado com sucesso para ${fullNumber}!`,
        rawResponse: data
      };
    }

    // Se POST retornou erro explícito (ex: credenciais), retorna
    if (data.message || data.error) {
      return {
        success: false,
        message: data.message || data.error || 'Erro ao enviar SMS via GTI SMS.',
        rawResponse: data
      };
    }

    // Fallback: Tentativa via GET se POST falhar por formato
    const queryUrl = `${apiUrl}?api_token=${encodeURIComponent(token)}&recipient=${encodeURIComponent(fullNumber)}&message=${encodeURIComponent(sanitizedMsg)}${senderId ? `&sender_id=${encodeURIComponent(senderId)}` : ''}`;
    const getResp = await fetch(queryUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    const getRaw = await getResp.text();
    let getData: any = {};
    try { getData = JSON.parse(getRaw); } catch(e) { getData = { raw: getRaw }; }

    if (getResp.ok && (getData.status === 'success' || getData.success === true || getRaw.includes('success'))) {
      return {
        success: true,
        message: getData.message || `SMS enviado com sucesso para ${fullNumber}!`,
        rawResponse: getData
      };
    }

    return {
      success: false,
      message: getData.message || getData.error || rawText || 'Falha ao processar SMS no provedor.',
      rawResponse: getData
    };

  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Tempo limite esgotado ao conectar à operadora de SMS.'
      };
    }
    return {
      success: false,
      message: 'Erro na conexão com GTI SMS: ' + (err?.message || String(err))
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
