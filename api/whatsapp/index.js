export default async function handler(req, res) {
  // Se abrir direto no navegador (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: "Online!", 
      mensagem: "A API do WhatsApp na Vercel está ativa e pronta!" 
    });
  }

  // Se o seu sistema enviar os dados (POST)
  if (req.method === 'POST') {
    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ sucesso: false, erro: 'Telefone e mensagem são obrigatórios.' });
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
