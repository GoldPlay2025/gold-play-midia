export default async function handler(req, res) {
  if (req.method === 'GET') {
    const htmlPainel = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Painel Definitivo - Botbot.chat</title>
          <style>
              body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
              .card { background: #1e293b; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 500px; border: 1px solid #334155; }
              h2 { color: #38bdf8; margin-top: 0; font-size: 18px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
              .form-group { margin-bottom: 15px; }
              label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px; }
              input, textarea { width: 100%; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px; box-sizing: border-box; font-size: 13px; }
              button { background: #0ea5e9; border: none; color: white; padding: 12px; width: 100%; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; margin-top: 5px; }
              button:hover { background: #0284c7; }
              .btn-lote { background: #10b981; margin-top: 10px; }
              .btn-lote:hover { background: #059669; }
              .log-box { margin-top: 15px; font-size: 12px; padding: 12px; background: #0f172a; border-radius: 6px; min-height: 60px; max-height: 150px; overflow-y: auto; word-break: break-all; color: #38bdf8; font-family: monospace; white-space: pre-wrap; border: 1px solid #334155; }
          </style>
      </head>
      <body>
          <div class="card">
              <h2>Painel Definitivo - Botbot.chat</h2>
              <div class="form-group">
                  <label>Número de Destino (com DDD):</label>
                  <input type="text" id="numero" value="5544991762249">
              </div>
              <div class="form-group">
                  <label>Mensagem:</label>
                  <textarea id="mensagem" rows="3">Teste oficial corrigido com o campo "to"!</textarea>
              </div>
              <button onclick="enviarTeste()">Enviar Teste Individual</button>
              <button class="btn-lote" onclick="dispararLote()">Disparar Lote (Puxar do Supabase)</button>
              <div id="resultado" class="log-box">Aguardando disparo...</div>
          </div>

          <script>
              async function enviarTeste() {
                  const numero = document.getElementById('numero').value;
                  const mensagem = document.getElementById('mensagem').value;
                  const resDiv = document.getElementById('resultado');

                  resDiv.style.color = '#38bdf8';
                  resDiv.innerText = 'Enviando...';

                  try {
                      const response = await fetch('/api/whatsapp', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone: numero, message: mensagem })
                      });
                      const data = await response.json();
                      resDiv.style.color = data.sucesso ? '#34d399' : '#f87171';
                      resDiv.innerText = JSON.stringify(data, null, 2);
                  } catch (e) {
                      resDiv.style.color = '#f87171';
                      resDiv.innerText = 'Erro crítico de conexão.';
                  }
              }

              async function dispararLote() {
                  const resDiv = document.getElementById('resultado');
                  resDiv.style.color = '#38bdf8';
                  resDiv.innerText = 'Buscando clientes no Supabase e disparando...';

                  try {
                      const response = await fetch('/api/whatsapp', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ disparar_lote: true })
                      });
                      const data = await response.json();
                      resDiv.style.color = data.sucesso ? '#34d399' : '#f87171';
                      resDiv.innerText = JSON.stringify(data, null, 2);
                  } catch (e) {
                      resDiv.style.color = '#f87171';
                      resDiv.innerText = 'Erro ao processar lote.';
                  }
              }
          </script>
      </body>
      </html>
    `;
    return res.status(200).setHeader('Content-Type', 'text/html').send(htmlPainel);
  }

  if (req.method === 'POST') {
    try {
      const { phone, message, disparar_lote } = req.body;
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      // 1. DISPARO EM LOTE (Puxa do Supabase: nome, whatsapp, vencimento, valor)
      if (disparar_lote) {
        const supRes = await fetch(`${supabaseUrl}/rest/v1/clientes?select=*`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        });
        const clientes = await supRes.json();

        if (!supRes.ok) {
          throw new Error(clientes.message || 'Erro ao consultar o Supabase');
        }

        if (!clientes || clientes.length === 0) {
          return res.status(200).json({ sucesso: true, mensagem: 'Nenhum cliente encontrado na tabela.' });
        }

        let resultados = [];

        for (const cliente of clientes) {
          const telefone = cliente.whatsapp || cliente.telefone;
          const nome = cliente.nome || 'Cliente';
          const vencimento = cliente.vencimento || '';
          const valor = cliente.valor || '';

          if (!telefone) continue;

          let numeroLimpo = telefone.replace(/\D/g, '');
          if (numeroLimpo.length === 10 || numeroLimpo.length === 11) {
            numeroLimpo = '55' + numeroLimpo;
          }

          // Variáveis vindas direto do seu banco de dados Supabase
          const textoMensagem = message || `Olá ${nome}, passamos para lembrar que o seu vencimento é em ${vencimento} no valor de R$ ${valor}. Regularize para evitar o bloqueio!`;

          const respostaBot = await fetch('https://botbot.chat/api/v2/sendText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'appKey': process.env.BOTBOT_APP_KEY,
              'authKey': process.env.BOTBOT_AUTH_KEY
            },
            body: JSON.stringify({
              to: numeroLimpo, // CORRIGIDO: O botbot.chat exige "to"
              message: textoMensagem
            })
          });

          const dadosBot = await respostaBot.json();
          resultados.push({ 
            cliente: nome, 
            status: respostaBot.ok && dadosBot.success !== false ? 'Enviado com sucesso' : 'Falha', 
            respostaBot: dadosBot 
          });
        }

        return res.status(200).json({ 
          sucesso: true, 
          totalProcessados: resultados.length, 
          resultados 
        });
      }

      // 2. ENVIO INDIVIDUAL / TESTE RÁPIDO
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
          to: numeroLimpo, // CORRIGIDO: O botbot.chat exige "to"
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
