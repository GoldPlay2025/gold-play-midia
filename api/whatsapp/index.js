export default async function handler(req, res) {
  // 1. Se abrir direto no navegador (GET), exibe um Painel de Teste Visual
  if (req.method === 'GET') {
    const htmlPainel = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Painel de Teste - WhatsApp Vercel</title>
          <style>
              body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
              .card { background: #1e293b; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 450px; border: 1px solid #334155; }
              h2 { color: #38bdf8; margin-top: 0; font-size: 18px; border-bottom: 1px solid #334155; padding-bottom: 10px; }
              .form-group { margin-bottom: 15px; }
              label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 5px; }
              input, textarea { width: 100%; background: #0f172a; border: 1px solid #475569; color: #fff; padding: 10px; border-radius: 6px; box-sizing: border-box; font-size: 13px; }
              button { background: #0ea5e9; border: none; color: white; padding: 12px; width: 100%; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; margin-top: 5px; }
              button:hover { background: #0284c7; }
              .btn-lote { background: #10b981; margin-top: 10px; }
              .btn-lote:hover { background: #059669; }
              .log-box { margin-top: 15px; font-size: 12px; padding: 10px; background: #0f172a; border-radius: 6px; min-height: 30px; word-break: break-all; }
          </style>
      </head>
      <body>
          <div class="card">
              <h2>Painel de Teste - Botbot.chat</h2>
              <div class="form-group">
                  <label>Número (com DDD):</label>
                  <input type="text" id="numero" placeholder="Ex: 5544999999999" value="5544991762249">
              </div>
              <div class="form-group">
                  <label>Mensagem:</label>
                  <textarea id="mensagem" rows="3">Teste de envio direto pela Vercel com botbot.chat!</textarea>
              </div>
              <button onclick="enviarTeste()">Enviar Mensagem de Teste</button>
              <button class="btn-lote" onclick="dispararLoteSupabase()">Disparar Lote (Puxar do Supabase)</button>
              <div id="resultado" class="log-box" style="color: #64748b;">Aguardando ação...</div>
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
                      if (data.sucesso) {
                          resDiv.style.color = '#34d399';
                          resDiv.innerText = 'Sucesso! Mensagem enviada.';
                      } else {
                          resDiv.style.color = '#f87171';
                          resDiv.innerText = 'Erro: ' + (data.erro || 'Falha ao enviar');
                      }
                  } catch (e) {
                      resDiv.style.color = '#f87171';
                      resDiv.innerText = 'Erro de conexão com a API.';
                  }
              }

              async function dispararLoteSupabase() {
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
                      if (data.sucesso) {
                          resDiv.style.color = '#34d399';
                          resDiv.innerText = 'Lote finalizado! Total processados: ' + data.totalProcessados;
                      } else {
                          resDiv.style.color = '#f87171';
                          resDiv.innerText = 'Erro: ' + (data.erro || 'Falha no lote');
                      }
                  } catch (e) {
                      resDiv.style.color = '#f87171';
                      resDiv.innerText = 'Erro ao processar lote do Supabase.';
                  }
              }
          </script>
      </body>
      </html>
    `;
    return res.status(200).setHeader('Content-Type', 'text/html').send(htmlPainel);
  }

  // 2. Executa os disparos (POST)
  if (req.method === 'POST') {
    try {
      const { phone, message, disparar_lote } = req.body;
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY;

      // OPÇÃO A: Disparar em lote puxando direto do Supabase
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

          const textoMensagem = message || `Olá ${nome}, passamos para lembrar que o seu vencimento é em ${vencimento} no valor de R$ ${valor}. Regularize para evitar o bloqueio!`;

          const respostaBot = await fetch('https://api.botbot.chat/api/v2/sendText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'appKey': process.env.BOTBOT_APP_KEY,
              'authKey': process.env.BOTBOT_AUTH_KEY
            },
            body: JSON.stringify({
              phone: numeroLimpo,
              message: textoMensagem
            })
          });

          const dadosBot = await respostaBot.json();
          resultados.push({ 
            cliente: nome, 
            status: respostaBot.ok ? 'Enviado com sucesso' : 'Falha', 
            detalhe: dadosBot 
          });
        }

        return res.status(200).json({ 
          sucesso: true, 
          totalProcessados: resultados.length, 
          resultados 
        });
      }

      // OPÇÃO B: Envio Individual / Teste Direto
      if (!phone || !message) {
        return res.status(400).json({ 
          sucesso: false, 
          erro: 'Informe o "phone" e a "message".' 
        });
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
