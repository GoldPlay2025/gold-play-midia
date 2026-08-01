// Responde quando você abre o link direto no navegador (GET)
export async function GET() {
  return Response.json({ 
    status: "Online!", 
    mensagem: "A API do WhatsApp na Vercel está ativa e pronta para receber envios via POST." 
  });
}

// Executa o envio real quando o seu sistema chama (POST)
export async function POST(request) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return Response.json({ sucesso: false, erro: 'Telefone e mensagem são obrigatórios.' }, { status: 400 });
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

    return Response.json({ sucesso: true, resultado: dados });
  } catch (err) {
    return Response.json({ sucesso: false, erro: err.message }, { status: 500 });
  }
}
