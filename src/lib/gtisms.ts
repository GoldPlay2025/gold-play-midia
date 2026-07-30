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
  const token = options.smsToken || process.env.GTISMS_API_TOKEN;
  if (!token) {
    return {
      success: false,
      message: 'Token GTI SMS (GTISMS_API_TOKEN) não configurado nas variáveis de ambiente.'
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

  const sanitizedMsg = sanitizeSms(options.mensagem);
  const senderId = options.senderId || process.env.GTISMS_SENDER_ID || '';
  const timeoutMs = options.timeoutMs || 8000;

  // 1. Tentar V3 JSON POST
  let timerV3: any = null;
  try {
    const controller = new AbortController();
    timerV3 = setTimeout(() => controller.abort(), Math.min(timeoutMs, 5000));

    const v3Url = 'https://sms.gtisms.com/api/v3/sms/send';
    const payload: any = {
      recipient: fullNumber,
      message: sanitizedMsg,
      type: 'plain'
    };
    if (senderId) payload.sender_id = senderId;

    const resp = await fetch(v3Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const rawText = await resp.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch(e) { data = { raw: rawText }; }

    if (resp.ok && (data.status === 'success' || data.success === true)) {
      return {
        success: true,
        message: data.message || 'SMS enviado com sucesso via GTI SMS (v3)',
        rawResponse: data
      };
    }
  } catch (errV3: any) {
    console.warn('[sendGtiSms] Tentativa v3 falhou ou excedeu o tempo, tentando HTTP GET...', errV3?.message);
  } finally {
    if (timerV3) clearTimeout(timerV3);
  }

  // 2. Fallback: HTTP GET Endpoint
  let timerHttp: any = null;
  try {
    const controller = new AbortController();
    timerHttp = setTimeout(() => controller.abort(), Math.min(timeoutMs, 4000));

    const httpUrl = `https://sms.gtisms.com/api/http/sms/send?api_token=${encodeURIComponent(token)}&recipient=${encodeURIComponent(fullNumber)}&message=${encodeURIComponent(sanitizedMsg)}${senderId ? `&sender_id=${encodeURIComponent(senderId)}` : ''}`;

    const resp = await fetch(httpUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    const rawText = await resp.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch(e) { data = { raw: rawText }; }

    if (resp.ok && (data.status === 'success' || data.success === true || rawText.includes('success') || rawText.includes('100') || rawText.includes('OK'))) {
      return {
        success: true,
        message: data.message || 'SMS enviado com sucesso via GTI SMS (HTTP)',
        rawResponse: data
      };
    }

    return {
      success: false,
      message: data.message || data.error || rawText || 'Falha ao enviar SMS via GTI SMS',
      rawResponse: data
    };
  } catch (errHttp: any) {
    return {
      success: false,
      message: errHttp.name === 'AbortError' ? 'Tempo de conexão esgotado ao contatar a operadora de SMS.' : ('Erro ao conectar à operadora de SMS: ' + errHttp.message)
    };
  } finally {
    if (timerHttp) clearTimeout(timerHttp);
  }
}
