import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configura CORS (caso precise)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { deviceId, action } = req.body;
    
    // Puxa a chave mestra escondida na Vercel
    const token = process.env.FULLY_API_TOKEN;

    if (!token) {
      return res.status(500).json({ error: 'FULLY_API_TOKEN não configurado nas variáveis de ambiente da Vercel.' });
    }

    if (!deviceId || !action) {
       return res.status(400).json({ error: 'O deviceId e a action são obrigatórios.' });
    }

    // A URL no formato exato exigido pela documentação do Fully Cloud
    const fullyUrl = `https://cloud.fully-kiosk.com/?cmd=${action}&deviceId=${deviceId}&token=${token}&type=json`;

    // Dispara a ordem para o servidor do Fully Cloud
    const response = await fetch(fullyUrl, {
      method: 'POST', 
      headers: {
        'Accept': 'application/json',
      }
    });

    // Pega a resposta como texto primeiro para evitar erro de JSON vazio
    const responseText = await response.text();
    
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : { status: 'Success', statustext: 'Comando enviado, mas sem resposta no corpo' };
    } catch (e) {
      console.warn("Resposta não é um JSON válido:", responseText);
      // Retornar um JSON genérico para não quebrar o frontend
      return res.status(200).json({ 
        status: 'Success', 
        statustext: 'Comando enviado (resposta não-JSON)', 
        rawResponse: responseText 
      });
    }

    // Se o Fully Cloud retornar erro, repassa para o painel
    if (data && data.status === 'Error') {
       return res.status(400).json({ error: data.statustext || 'Erro desconhecido retornado pelo Fully Cloud' });
    }

    // Sucesso
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro na API do Fully:", error);
    return res.status(500).json({ error: 'Falha de comunicação com o Fully Cloud' });
  }
}
