import { createClient } from '@supabase/supabase-js';

// Conexão com o Supabase utilizando as variáveis de ambiente seguras da Vercel
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
  // 1. Verificação rápida de status via navegador (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "Online!", 
      mensagem: "A API do WhatsApp na Vercel está ativa e pronta!" 
    });
  }

  // 2. Executa os disparos (POST)
  if (req.method === 'POST') {
    try {
      const { phone, message, disparar_lote } = req.body;

      // OPÇÃO A: Disparo em lote automático buscando do Supabase
      if (disparar_lote) {
        const { data: clientes, error } = await supabase
          .from('clientes') // Altere 'clientes' se o nome da sua tabela for diferente
          .select('nome, whatsapp, vencimento, valor');

        if (error) throw error;

        let resultados = [];

        for (const cliente of clientes) {
          if (!cliente.whatsapp) continue;

          let numeroLimpo = cliente.whatsapp.replace(/\D/g, '');
          if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
            numeroLimpo = '55' + numeroLimpo;
          }

          // Mensagem personalizada utilizando as variáveis do banco
          const textoMensagem = `Olá ${cliente.nome}, passamos para lembrar que o seu vencimento é em ${cliente.vencimento} no valor de R$ ${cliente.valor}. Regularize para evitar o bloqueio!`;

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
            cliente: cliente.nome, 
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

      // OPÇÃO B: Disparo de Teste Individual (Passando número e mensagem direto)
      if (!phone || !message) {
        return res.status(400).json({ 
          sucesso: false, 
          erro: 'Envie "phone" e "message" para teste, ou ative "disparar_lote: true" para buscar do banco.' 
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
