import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configure CORS
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
    
    // Get Fully API Token from Vercel environment variables
    const token = process.env.FULLY_API_TOKEN;

    if (!token) {
      return res.status(500).json({ error: 'FULLY_API_TOKEN não configurado nas variáveis de ambiente da Vercel.' });
    }

    if (!deviceId || !action) {
       return res.status(400).json({ error: 'O deviceId e a action são obrigatórios.' });
    }

    // URL format as required by the Fully Cloud API
    const fullyUrl = `https://cloud.fully-kiosk.com/api/?cmd=${action}&deviceId=${deviceId}&token=${token}&type=json`;

    // Fetch from Fully Cloud API
    const response = await fetch(fullyUrl, {
      method: 'POST', 
      headers: {
        'Accept': 'application/json',
      }
    });

    // Check if response is HTML (redirects, login page, etc.)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
       return res.status(502).json({ error: "A API do Fully Cloud retornou uma página HTML. Verifique se o FULLY_API_TOKEN e o Device ID estão corretos." });
    }

    // Get response body as text first to handle empty body
    const responseText = await response.text();
    
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : { status: 'Success', statustext: 'Comando enviado, mas sem resposta no corpo' };
    } catch (e) {
      console.warn("Resposta não é um JSON válido:", responseText);
      return res.status(200).json({ 
        status: 'Success', 
        statustext: 'Comando enviado (resposta não-JSON)', 
        rawResponse: responseText 
      });
    }

    // If Fully Cloud returns error
    if (data && data.status === 'Error') {
       return res.status(400).json({ error: data.statustext || 'Erro retornado pelo Fully Cloud' });
    }

    // Success
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro na API do Fully:", error);
    return res.status(500).json({ error: 'Falha de comunicação com o Fully Cloud' });
  }
}
