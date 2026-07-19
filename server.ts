import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini client using backend key
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // API Route for Architect queries
  app.post("/gateway/architect/ask", async (req, res) => {
    try {
      const { prompt, currentSchema, context } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "O campo 'prompt' é obrigatório." });
      }

      if (!ai) {
        return res.status(503).json({ 
          error: "A chave API do Gemini (GEMINI_API_KEY) não está configurada no servidor. Por favor, adicione-a em Configurações > Segredos." 
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Você é um Arquiteto de Software Sênior e especialista em banco de dados PostgreSQL e Supabase.
O usuário está analisando e refinando a estrutura de banco de dados do SaaS de Digital Signage 'Gold Play Mídia'.

Aqui está a estrutura SQL atual:
\`\`\`sql
${currentSchema}
\`\`\`

Opções arquiteturais ativas:
- UUID como chave primária: Sim (padrão)
- Auto-update de Timestamps (Gatilhos): ${context?.timestamps ? 'Ativo' : 'Inativo'}
- Índices de Desempenho Otimizados: ${context?.indexes ? 'Ativo' : 'Inativo'}
- Exclusão Lógica (Soft Delete): ${context?.softDelete ? 'Ativo' : 'Inativo'}
- Tabela de Logs de Heartbeat (TV Box): ${context?.heartbeatLogs ? 'Ativo' : 'Inativo'}

Responda à pergunta ou instrução do usuário em português do Brasil.
Forneça explicações precisas e de nível de produção sobre índices, segurança, RLS, relacionamentos ou otimizações específicas no Supabase.
Se o usuário solicitar alterações ou acréscimos na estrutura SQL, forneça os blocos de código SQL correspondentes de forma limpa e comentada.
Fale de forma sênior, instrutiva e evite lero-lero. Se houver alguma falha em potencial na modelagem do usuário, aponte construtivamente.

Pergunta ou solicitação do usuário:
"${prompt}"`,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Erro no processamento do Arquiteto AI:", error);
      res.status(500).json({ error: error.message || "Ocorreu um erro ao processar a consulta com o Arquiteto AI." });
    }
  });

  // API Route for Sending SMS via GetSMS Gateway
  app.post("/gateway/send-sms", async (req, res) => {
    try {
      const { oauthEndpoint, httpEndpoint, apiToken, to, message } = req.body;
      if (!to || !message) {
        return res.status(400).json({ error: "Campos 'to' e 'message' são obrigatórios." });
      }

      const cleanPhone = to.replace(/\D/g, '');
      const cleanToken = apiToken || '';

      // Intelligent instant conversion to strip accents, emojis, and special characters
      const sanitizeSmsMessage = (msg: string): string => {
        if (!msg) return "";
        // Normalize to decompose accents (e.g. á -> a + ´) and strip the diacritics
        let cleaned = msg.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Manual replacements for standard Portuguese edge cases
        cleaned = cleaned.replace(/ç/g, "c").replace(/Ç/g, "C");
        
        // Retain only safe, standard printable ASCII characters (range 32 to 126)
        let asciiOnly = "";
        for (let i = 0; i < cleaned.length; i++) {
          const code = cleaned.charCodeAt(i);
          if (code >= 32 && code <= 126) {
            asciiOnly += cleaned.charAt(i);
          } else if (code === 160 || code === 8201 || code === 8202) {
            // Replace common non-breaking space variants with normal space
            asciiOnly += " ";
          }
        }
        return asciiOnly.trim();
      };

      const cleanMessage = sanitizeSmsMessage(message);
      console.log(`Original SMS message: "${message}"`);
      console.log(`Sanitized SMS message: "${cleanMessage}"`);

      const results: any[] = [];
      let success = false;
      let errorDetails = '';

      // 1. Try OAuth v3 API standard POST request
      const v3Url = `${oauthEndpoint?.replace(/\/$/, '') || 'https://sms.gtisms.com/api/v3'}/sms/send`;
      try {
        console.log(`Sending SMS via v3 endpoint: ${v3Url}`);
        const response = await fetch(v3Url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            recipient: cleanPhone,
            to: cleanPhone,
            message: cleanMessage,
            body: cleanMessage
          })
        });

        const status = response.status;
        const text = await response.text();
        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}

        results.push({ endpoint: 'v3', status, data: json || text || "Resposta vazia do gateway" });
        if (status >= 200 && status < 300) {
          success = true;
        } else {
          errorDetails += `[V3 API returned status ${status}: ${text.substring(0, 200) || "Empty body"}] `;
        }
      } catch (err: any) {
        results.push({ endpoint: 'v3', error: err.message });
        errorDetails += `[V3 API Connection failed: ${err.message}] `;
      }

      // 2. If OAuth v3 failed, try HTTP API standard GET/POST request as fallback
      if (!success && httpEndpoint) {
        const httpUrlBase = httpEndpoint.replace(/\/$/, '');
        // We try common variants for HTTP API query sending
        const httpUrlsToTry = [
          `${httpUrlBase}?token=${encodeURIComponent(cleanToken)}&to=${cleanPhone}&message=${encodeURIComponent(cleanMessage)}`,
          `${httpUrlBase}/send?token=${encodeURIComponent(cleanToken)}&to=${cleanPhone}&message=${encodeURIComponent(cleanMessage)}`,
          `${httpUrlBase}?api_token=${encodeURIComponent(cleanToken)}&to=${cleanPhone}&message=${encodeURIComponent(cleanMessage)}`
        ];

        for (const url of httpUrlsToTry) {
          if (success) break;
          try {
            console.log(`Trying fallback HTTP URL: ${url}`);
            const response = await fetch(url, { method: 'GET' });
            const status = response.status;
            const text = await response.text();
            results.push({ endpoint: 'http', status, data: text.substring(0, 200) || "Resposta vazia do gateway" });
            if (status >= 200 && status < 300) {
              success = true;
            }
          } catch (err: any) {
            results.push({ endpoint: 'http', error: err.message });
          }
        }
      }

      if (success) {
        console.log("SMS enviado com sucesso, enviando resposta JSON.");
        return res.json({ success: true, results, sanitizedMessage: cleanMessage });
      } else {
        console.log("Falha ao enviar SMS, enviando resposta 500.");
        return res.status(500).json({ success: false, error: errorDetails || "Não foi possível entregar o SMS pelo gateway.", results });
      }
    } catch (error: any) {
      console.error("Erro CRÍTICO na rota de envio de SMS:", error);
      res.status(500).json({ error: error.message || "Erro interno no processamento de SMS." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
