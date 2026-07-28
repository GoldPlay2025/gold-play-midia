export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action, newUrl } = body || {};

    const apiToken = process.env.FULLY_API_TOKEN || process.env.FULLY_API_KEY;
    const apiEmail = process.env.FULLY_API_EMAIL;

    if (!apiToken) {
      return Response.json(
        { error: 'FULLY_API_TOKEN (ou FULLY_API_KEY) não configurado nas variáveis de ambiente.' },
        { status: 503 }
      );
    }

    if (!deviceId || !action) {
      return Response.json(
        { error: 'O deviceId e a action são obrigatórios.' },
        { status: 400 }
      );
    }

    // Mapeamento de comandos
    let fullyCmd = action;
    if (action === 'reload') fullyCmd = 'loadStartUrl';
    if (action === 'restart') fullyCmd = 'restartApp';

    let extraParams = '';
    if (action === 'change_url' || action === 'loadURL') {
      if (!newUrl) {
        return Response.json(
          { error: 'A propriedade newUrl é obrigatória para alterar a URL.' },
          { status: 400 }
        );
      }
      fullyCmd = 'loadURL';
      extraParams = `&url=${encodeURIComponent(newUrl)}`;
    }

    const emailParam = apiEmail ? `&apiemail=${encodeURIComponent(apiEmail)}` : '';
    const fullyUrl = `https://api.fully-kiosk.com/remote/?cmd=${fullyCmd}&devid=${encodeURIComponent(deviceId)}${emailParam}&apikey=${encodeURIComponent(apiToken)}${extraParams}&type=json`;

    const response = await fetch(fullyUrl, {
      method: 'GET',
    });

    const responseText = await response.text();

    if (responseText.includes('Sign in') || responseText.includes('Login') || responseText.includes('Access Denied')) {
      return Response.json(
        { error: 'Acesso negado pelo Fully Cloud. Verifique se FULLY_API_EMAIL, FULLY_API_TOKEN e o Device ID estão corretos.' },
        { status: 401 }
      );
    }

    let data;
    try {
      data = responseText ? JSON.parse(responseText) : { status: 'Success', statustext: 'Comando enviado com sucesso' };
    } catch (e) {
      data = { status: 'Success', statustext: 'Comando enviado para a Tela com sucesso.', rawResponse: responseText };
    }

    if (data && (data.status === 'Error' || data.statustext?.toLowerCase().includes('error'))) {
      return Response.json(
        { error: data.statustext || 'Erro retornado pela API do Fully Kiosk.' },
        { status: 400 }
      );
    }

    return Response.json(data);
  } catch (error: any) {
    console.error('Erro na API do Fully:', error);
    return Response.json(
      { error: error.message || 'Falha de comunicação com o Fully Kiosk Cloud' },
      { status: 500 }
    );
  }
}
