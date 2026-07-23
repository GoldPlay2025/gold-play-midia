import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action, newUrl } = body;

    const apiEmail = process.env.FULLY_API_EMAIL;
    const apiToken = process.env.FULLY_API_TOKEN || process.env.FULLY_API_KEY;

    // Validação de credenciais no servidor
    if (!apiToken) {
      return NextResponse.json(
        { error: "A variável de ambiente FULLY_API_TOKEN (ou FULLY_API_KEY) não está configurada na Vercel." },
        { status: 400 }
      );
    }

    // Validação do corpo da requisição
    if (!deviceId || !action) {
      return NextResponse.json(
        { error: "Os campos 'deviceId' e 'action' são obrigatórios." },
        { status: 400 }
      );
    }

    // Mapeamento de action do Front para o cmd exigido pela API do Fully Cloud
    let cmd = action;
    if (action === 'reload') cmd = 'loadStartUrl';
    if (action === 'restart') cmd = 'restartApp';

    let extraParams = '';
    if (action === 'change_url' || action === 'loadURL') {
      if (!newUrl) {
        return NextResponse.json(
          { error: "O campo 'newUrl' é obrigatório para a ação change_url." },
          { status: 400 }
        );
      }
      cmd = 'loadURL';
      extraParams = `&url=${encodeURIComponent(newUrl)}`;
    }

    // Construção da URL de chamada para a REST API Oficial do Fully Cloud
    const emailParam = apiEmail ? `&apiemail=${encodeURIComponent(apiEmail)}` : '';
    const fullyApiUrl = `https://api.fully-kiosk.com/remote/?cmd=${cmd}&devid=${encodeURIComponent(deviceId)}${emailParam}&apikey=${encodeURIComponent(apiToken)}${extraParams}&type=json`;

    // Requisição simples GET sem cabeçalhos customizados (conforme documentação)
    const response = await fetch(fullyApiUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "A API do Fully Cloud retornou HTML. Verifique se FULLY_API_EMAIL, FULLY_API_TOKEN e o Device ID estão corretos." },
        { status: 502 }
      );
    }

    const responseText = await response.text();
    let data;

    try {
      data = responseText ? JSON.parse(responseText) : { status: 'Success' };
    } catch {
      data = { status: 'Success', text: responseText };
    }

    if (data && data.status === 'Error') {
      return NextResponse.json(
        { error: data.statustext || "Erro retornado pela API do Fully Cloud." },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Erro na rota /api/fully/command:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno ao processar comando do Fully Cloud." },
      { status: 500 }
    );
  }
}