import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // 1. Verificação de status via navegador (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "Online!", 
      mensagem: "A API do WhatsApp com Supabase está ativa e pronta!" 
    });
  }

  // 2. Executa os disparos (POST)
  if (req.method === 'POST') {
    try {
      const { phone, message, disparar_lote } = req.body;

      // OPÇÃO A: Disparar em lote puxando direto do Supabase
      if (disparar_lote) {
        // Altere 'clientes' caso o nome da sua tabela no banco seja outro
        const { data: clientes, error } = await supabase
          .from('clientes')
          .select('*');

        if (error) {
          return res.status(500).json({ sucesso: false, erro: 'Erro ao consultar o Supabase: ' + error.message });
        }

        if (!clientes || clientes.length === 0) {
          return res.status(200).json({ sucesso: true, mensagem: 'Nenhum cliente encontrado na tabela.' });
        }

        let resultados = [];

        for (const cliente of clientes) {
          // Puxa os campos do seu banco (ajuste se os nomes das colunas forem diferentes)
          const telefone = cliente.whatsapp || cliente.telefone;
          const nome = cliente.nome || 'Cliente';
          const vencimento = cliente.vencimento || '';
          const valor = cliente.valor || '';

          if (!telefone) continue;

          let numeroLimpo = telefone.replace(/\D/g, '');
          if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
            numeroLimpo = '55' + numeroLimpo;
          }

          // Mensagem padrão formatada com as variáveis do banco
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

      // OPÇÃO B: Teste ou Envio Individual direto
      if (!phone || !message) {
        return res.status(400).json({ 
          sucesso: false, 
          erro: 'Envie "phone" e "message" para envio individual, ou "disparar_lote: true" para buscar do Supabase.' 
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
