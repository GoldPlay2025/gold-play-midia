// app/api/enviar-cobranca/route.js
import { createClient } from '@supabase/supabase-js';
import { enviarMensagemBotBot } from '@/lib/botbot';

// Conecta ao Supabase usando variáveis de ambiente seguras da Vercel
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function GET(request) {
  try {
    // 1. Pega os clientes do Supabase (substitua 'clientes' pelo nome real da sua tabela)
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('nome, whatsapp, vencimento');

    if (error) throw error;

    let resultados = [];

    // 2. Percorre cada cliente cadastrado no banco
    for (const cliente of clientes) {
      // Personaliza a mensagem com as variáveis do banco de dados
      const mensagem = `Olá ${cliente.nome}, passamos para lembrar que o seu vencimento é no dia ${cliente.vencimento}. Regularize para evitar o bloqueio!`;

      // 3. Dispara pelo botbot.chat usando o WhatsApp do cliente
      await enviarMensagemBotBot(cliente.whatsapp, mensagem);
      
      resultados.push({ cliente: cliente.nome, status: 'Enviado' });
    }

    return Response.json({ sucesso: true, total: resultados.length, detalhes: resultados });
  } catch (err) {
    return Response.json({ sucesso: false, erro: err.message }, { status: 500 });
  }
}