export default async function handler(req, res) {
  // 1. Verificação de status via navegador (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "Online!", 
      mensagem: "A API do WhatsApp está ativa e pronta!" 
    });
  }

  // 2. Executa os disparos (POST)
  if (req.method === 'POST') {
    try {
      const { phone, message, disparar_lote } = req.body;

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      // OPÇÃO A: Disparar em lote puxando direto do Supabase via REST API nativa
      if (disparar_lote) {
        const supRes = await fetch(`${supabaseUrl}/rest/v1/clientes?select=*`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });

        const clientes = await supRes.json();

        if (!supRes.ok) {
          throw new Error(clientes.message || 'Erro ao consultar os dados no Supabase');
        }

        if (!clientes || clientes.length === 0) {
          return res.status(200).json({ sucesso: true, mensagem: 'Nenhum cliente encontrado na tabela.' });
        }

        let resultados = [];

        for (const cliente of clientes) {
          const telefone = cliente.whatsapp || cliente.telefone;
          const nome = cliente.nome || 'Cliente';
          const vencimento = cliente.vencimento || '';
          const valor = cliente.valor || '';

          if (!telefone) continue;

          let numeroLimpo = telefone.replace(/\D/g, '');
          if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
            numeroLimpo = '55' + numeroLimpo;
          }

          const textoMensagem = message || `Olá ${nome}, passamos para lembrar que o seu vencimento é em ${vencimento} no valor de R$ ${valor}. Regularize para evitar o bloqueio!`;

          const respostaBot = await fetch('https://api.botbot.chat/api/v2/sendText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'appKey': process.env.BOTBOT_APP_KEY,
              'authKey': process.env.BOTBOT_AUTH_KEY
            },
            body: JSON.stringify({
              phone: numeroLimpo,
              message: textoMensagem
            })
          });

          const dadosBot = await respostaBot.json();
          resultados.push({ 
            cliente: nome, 
            status: respostaBot.ok ? 'Enviado com sucesso' : 'Falha', 
            detalhe: dadosBot 
          });
        }

        return res.status(200).json({ 
          sucesso: true, 
          totalProcessados: resultados.length, 
          resultados 
        });
      }

      // OPÇÃO B: Envio Individual / Teste Direto
      if (!phone || !message) {
        return res.status(400).json({ 
          sucesso: false, 
          erro: 'Envie "phone" e "message" para envio individual, ou "disparar_lote: true" para buscar do banco.' 
        });
      }

      let numeroLimpo = phone.replace(/\D/g, '');
      if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        numeroLimpo = '55' + numeroLimpo;
      }

      const respostaBot = await fetch('https://api.botbot.chat/api/v2/sendText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'appKey': process.env.BOTBOT_APP_KEY,
          'authKey': process.env.BOTBOT_AUTH_KEY
        },
        body: JSON.stringify({
          phone: numeroLimpo,
          message: message
        })
      });

      const dados = await respostaBot.json();

      if (!respostaBot.ok) {
        throw new Error(dados.message || 'Erro ao disparar mensagem pelo botbot.chat');
      }

      return res.status(200).json({ sucesso: true, resultado: dados });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido' });
}
