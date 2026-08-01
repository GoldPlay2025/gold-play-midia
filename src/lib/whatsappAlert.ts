import { supabase } from './supabase';

/**
 * Função exportável para enviar alerta de status de tela (OFF/ON) para o WhatsApp do Administrador.
 * Busca o número do administrador na tabela `perfil` do Supabase (ou `configuracoes` / localStorage)
 * e dispara a notificação via endpoint `/api/whatsapp`.
 */
export async function enviarAlertaStatusTela(status: 'OFF' | 'ON' | 'off' | 'on', nomeTela: string) {
  const normalizedStatus = String(status).toUpperCase() as 'OFF' | 'ON';
  const mensagemAlerta = `⚠️ ALERTA: A tela ${nomeTela || 'Desconhecida'} acabou de ficar ${normalizedStatus}.`;

  try {
    let adminPhone = '';

    // 1. Busca na tabela `perfil` do Supabase
    try {
      const { data: perfilData } = await supabase
        .from('perfil')
        .select('admin_phone, whatsapp, telefone')
        .limit(1)
        .maybeSingle();

      if (perfilData) {
        adminPhone = perfilData.admin_phone || perfilData.whatsapp || perfilData.telefone || '';
      }
    } catch (e) {
      console.warn('[enviarAlertaStatusTela] Aviso ao buscar tabela perfil:', e);
    }

    // 2. Se não encontrou, tenta tabela `configuracoes`
    if (!adminPhone) {
      try {
        const { data: configData } = await supabase
          .from('configuracoes')
          .select('admin_phone, whatsapp')
          .limit(1)
          .maybeSingle();

        if (configData) {
          adminPhone = configData.admin_phone || configData.whatsapp || '';
        }
      } catch (e) {
        console.warn('[enviarAlertaStatusTela] Aviso ao buscar tabela configuracoes:', e);
      }
    }

    // 3. Fallback para localStorage no cliente (configurações gerais e chaves BotBot)
    let appKey = '90d7b9ff-d861-49ae-a452-9ed6238f038d';
    let authKey = 'kMo4v73UxTTdDFmUGe7eYjQYCpZjykRb7lqZtlQu9Z8iDXN6Td';

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gpm_system_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (!adminPhone) adminPhone = parsed.adminPhone || '';
        } catch (e) {}
      }

      const savedKeys = localStorage.getItem('gpm_botbot_keys');
      if (savedKeys) {
        try {
          const parsed = JSON.parse(savedKeys);
          if (parsed.appKey) appKey = parsed.appKey;
          if (parsed.authKey) authKey = parsed.authKey;
        } catch (e) {}
      }
    }

    // 4. Disparo para o backend /api/whatsapp
    const response = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        alerta_status_tela: true,
        status: normalizedStatus,
        nomeTela,
        phone: adminPhone,
        message: mensagemAlerta,
        appKey,
        authKey
      })
    });

    const data = await response.json().catch(() => ({
      sucesso: response.ok,
      mensagem: response.ok ? 'Alerta disparado' : 'Erro no envio do alerta'
    }));

    console.log(`[enviarAlertaStatusTela] Resultado disparo de tela (${nomeTela} -> ${normalizedStatus}):`, data);
    return data;
  } catch (err: any) {
    console.error('[enviarAlertaStatusTela] Erro ao disparar alerta:', err);
    return { sucesso: false, erro: err?.message || 'Erro de conexão ao enviar alerta.' };
  }
}
