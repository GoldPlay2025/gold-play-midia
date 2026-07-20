import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { deviceId, action } = await req.json();
    const apiToken = process.env.FULLY_API_TOKEN;

    if (!apiToken) {
      return NextResponse.json(
        { error: "FULLY_API_TOKEN não configurado no servidor (Vercel Secrets)." },
        { status: 503 }
      );
    }
    
    if (!deviceId || !action) {
      return NextResponse.json(
        { error: "O deviceId e a action são obrigatórios." },
        { status: 400 }
      );
    }

    // A URL padrão para enviar comandos usando o Token
    const url = `https://cloud.fully-kiosk.com/api/v2/device/runCommand?token=${apiToken}`;
    
    // O corpo da requisição
    const payload = {
      cmd: action,
      deviceId: deviceId
    };
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      // Se a resposta for um erro HTTP, envia a mensagem e o corpo da resposta
      return NextResponse.json(
        { error: `Erro na API do Fully Cloud (${response.status}): ${responseText}` },
        { status: response.status }
      );
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // Captura o erro específico que apareceu no Toast (HTML ao invés de JSON)
      return NextResponse.json(
        { error: `A API do Fully Cloud retornou uma resposta inválida (HTML em vez de JSON). Verifique se a URL da API está correta no backend.` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("Erro no comando Fully Cloud:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno ao comandar o dispositivo." },
      { status: 500 }
    );
  }
}
