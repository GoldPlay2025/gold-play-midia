export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  // 1. PAINEL VISUAL DE CONFIGURAÇÃO E TESTES (GET)
  if (req.method === 'GET') {
    const htmlPainel = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Painel Gold Play - WhatsApp & Agendador</title>
          <style>
              body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
              .container { width: 100%; max-width: 900px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; box-sizing: border-box; }
              .card { background: #1e293b; padding: 25px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
              h2 { color: #38bdf8; margin-top: 0; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
              .form-group { margin-bottom: 15px; }
              label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px; }
              input, textarea { width: 100%; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px; box-sizing: border-box; font-size: 13px; }
              button { background: #0ea5e9; border: none; color: white; padding: 12px; width: 100%; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; margin-top: 5px; }
              button:hover { background: #0284c7; }
              .btn-lote { background: #10b981; }
              .btn-lote:hover { background: #059669; }
              .log-box { grid-column: span 2; background: #1e293b; padding: 20px; border-radius: 16px; border: 1px solid #334155; font-size: 12px; font-family: monospace; color: #38bdf8; min-height: 80px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; }
          </style>
      </head>
      <body>
          <div class="container">
              <!-- Configurações de Regra -->
              <div class="card">
                  <h2>⚙️ Configuração de Envio</h2>
                  <div class="form-group">
                      <label>Dias de Antecedência:</label>
                      <input type="number" id="diasAntes" value="2">
                  </div>
                  <div class="form-group">
                      <label>Horário do Disparador (Cron):</label>
                      <input type="time" id="horario" value="09:00">
                  </div>
                  <button class="btn-lote" onclick="executarAgendador()">🚀 Executar Disparos de Vencimento Hoje</button>
              </div>

              <!-- Teste Individual -->
              <div class="card">
                  <h2>📱 Teste Rápido</h2>
                  <div class="form-group">
                      <label>Número (com DDD):</label>
                      <input type="text" id="numero" value="5544991762249">
                  </div>
                  <div class="form-group">
                      <label>Mensagem:</label>
                      <textarea id="mensagem" rows="2">Teste de envio direto pelo painel!</textarea>
                  </div>
                  <button onclick="enviarTeste()">Enviar Teste</button>
              </div>

              <div id="resultado" class="log-box">Aguardando ações do painel...</div>
          </div>

          <script>
              async function enviarTeste() {
                  const numero = document.getElementById('numero').value;
                  const mensagem = document.getElementById('mensagem').value;
                  const resDiv = document.getElementById('resultado');
                  resDiv.innerText = 'Enviando teste...';

                  const res = await fetch('/api/whatsapp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ phone: numero, message: mensagem })
                  });
                  const data = await res.json();
                  resDiv.innerText = JSON.stringify(data, null, 2);
              }

              async function executarAgendador() {
                  const dias = document.getElementById('diasAntes').value;
                  const resDiv = document.getElementById('resultado');
                  resDiv.innerText = 'Buscando vencimentos no Supabase e disparando...';

                  const res = await fetch('/api/whatsapp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ disparar_lote: true, dias_antecedencia: Number(dias) })
                  });
                  const data = await res.json();
                  resDiv.innerText = JSON.stringify(data, null, 2);
              }
          </script>
      </body>
      </html>
    `;
    return res.status(200).setHeader('Content-Type', 'text/html').send(htmlPainel);
  }

  // 2. PROCESSAMENTO DE DISPAROS (POST)
  if (req.method === 'POST') {
    try {
      const { phone, message, disparar_lote, dias_antecedencia } = req.body;
      const isCron = req.query.cron === 'true' || disparar_lote;

      // DISPARO AUTOMATIZADO / LOTE (Baseado no Supabase e Vencimento)
      if (isCron) {
        const diasAnte = dias_antecedencia ?? 2;
        
        // Calcula a data alvo (Data de Hoje + Dias de Antecedência)
        const hoje = new Date();
        hoje.setDate(hoje.getDate() + diasAnte);
        const dataAlvoFormatada = hoje.toISOString().split('T')[0]; // Formato YYYY-MM-DD (ajuste se seu banco usa DD/MM/YYYY)

        // Busca clientes no Supabase
        const supRes = await fetch(`${supabaseUrl}/rest/v1/clientes?select=*`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        const clientes = await supRes.json();

        if (!supRes.ok) {
          throw new Error(clientes.message || 'Erro ao conectar com o Supabase');
        }

        if (!clientes || clientes.length === 0) {
          return res.status(200).json({ sucesso: true, mensagem: 'Nenhum cliente cadastrado.' });
        }

        let resultados = [];

        for (const cliente of clientes) {
          const telefone = cliente.whatsapp || cliente.telefone;
          const nome = cliente.nome || 'Cliente';
          const vencimento = cliente.vencimento; // Ex: '2026-08-03'
          const valor = cliente.valor || '0,00';

          if (!telefone || !vencimento) continue;

          // Filtra apenas os clientes cujo vencimento bate com a data alvo do agendador
          if (vencimento.startsWith(dataAlvoFormatada) || disparar_lote) { 
            let numeroLimpo = telefone.replace(/\D/g, '');
            if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
              numeroLimpo = '55' + numeroLimpo;
            }

            // Mensagem personalizada com dados do Supabase
            const textoMensagem = message || `Olá ${nome}, passamos para lembrar que o seu vencimento é em ${vencimento} no valor de R$ ${valor}. Regularize para evitar o bloqueio!`;

            const respostaBot = await fetch('https://botbot.chat/api/v2/sendText', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'appKey': process.env.BOTBOT_APP_KEY,
                'authKey': process.env.BOTBOT_AUTH_KEY
              },
              body: JSON.stringify({
                to: numeroLimpo,
                message: textoMensagem
              })
            });

            const dadosBot = await respostaBot.json();
            resultados.push({
              cliente: nome,
              vencimento: vencimento,
              status: respostaBot.ok && dadosBot.success !== false ? 'Enviado com sucesso' : 'Falha',
              respostaBot: dadosBot
            });
          }
        }

        return res.status(200).json({
          sucesso: true,
          dataAlvoCalculada: dataAlvoFormatada,
          totalProcessados: resultados.length,
          resultados
        });
      }

      // ENVIO INDIVIDUAL / TESTE DIRETO
      if (!phone || !message) {
        return res.status(400).json({ sucesso: false, erro: 'Informe o telefone e a mensagem.' });
      }

      let numeroLimpo = phone.replace(/\D/g, '');
      if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
        numeroLimpo = '55' + numeroLimpo;
      }

      const respostaBot = await fetch('https://botbot.chat/api/v2/sendText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'appKey': process.env.BOTBOT_APP_KEY,
          'authKey': process.env.BOTBOT_AUTH_KEY
        },
        body: JSON.stringify({
          to: numeroLimpo,
          message: message
        })
      });

      const dadosBot = await respostaBot.json();

      return res.status(200).json({
        sucesso: respostaBot.ok && dadosBot.success !== false,
        statusHttpBot: respostaBot.status,
        respostaDoBotBot: dadosBot
      });

    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  }

  return res.status(405).json({ erro: 'Método não permitido' });
}
