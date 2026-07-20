import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Recebe qual tela e qual ação o usuário clicou no painel
    const { deviceId, action } = await request.json();
    
    // Puxa a chave mestra escondida na Vercel
    const token = process.env.FULLY_API_TOKEN;

    if (!token) {
      return NextResponse.json({ error: 'Token da API não configurado na Vercel' }, { status: 500 });
    }

    // A URL no formato exato exigido pela documentação do Fully Cloud
    const fullyUrl = `https://cloud.fully-kiosk.com/?cmd=${action}&deviceId=${deviceId}&token=${token}&type=json`;

    // Dispara a ordem para o servidor deles
    const response = await fetch(fullyUrl, {
      method: 'POST', 
      headers: {
        'Accept': 'application/json',
      }
    });

    // Pega a resposta em JSON
    const data = await response.json();

    // Se o Fully Cloud retornar erro, repassa para o painel
    if (data.status === 'Error') {
       return NextResponse.json({ error: data.statustext }, { status: 400 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Erro na API do Fully:", error);
    return NextResponse.json({ error: 'Falha de comunicação com o Fully Cloud' }, { status: 500 });
  }
}
