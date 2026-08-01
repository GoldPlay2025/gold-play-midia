// lib/botbot.js
export async function enviarMensagemBotBot(telefone, texto) {
  let numeroLimpo = telefone.replace(/\D/g, '');
  if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
    numeroLimpo = '55' + numeroLimpo;
  }

  const resposta = await fetch('https://api.botbot.chat/api/v2/sendText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'appKey': process.env.BOTBOT_APP_KEY,
      'authKey': process.env.BOTBOT_AUTH_KEY
    },
    body: JSON.stringify({
      phone: numeroLimpo,
      message: texto
    })
  });

  return await resposta.json();
}