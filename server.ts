import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { whatsappRouter } from "./src/server/whatsappRoutes";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Rotas do WhatsApp
  app.use('/api/whatsapp', whatsappRouter);

  // CORS Middleware to allow cross-origin requests (e.g. from Vercel frontend deployments)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

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


  // Fully Cloud API Routes
  app.post("/api/fully/command", async (req, res) => {
    try {
      const { deviceId, action, newUrl } = req.body;
      const apiToken = process.env.FULLY_API_TOKEN || process.env.FULLY_API_KEY;
      const apiEmail = process.env.FULLY_API_EMAIL;

      if (!apiToken) {
        return res.status(503).json({ error: "FULLY_API_TOKEN (ou FULLY_API_KEY) não configurado no servidor." });
      }
      
      if (!deviceId || !action) {
        return res.status(400).json({ error: "O deviceId e a action são obrigatórios." });
      }

      // Mapeamento das actions para o cmd do Fully Cloud
      let fullyCmd = action;
      if (action === 'reload') fullyCmd = 'loadStartUrl';
      if (action === 'restart') fullyCmd = 'restartApp';

      let extraParams = "";
      if (action === 'change_url' || action === 'loadURL') {
        if (!newUrl) {
          return res.status(400).json({ error: "A propriedade newUrl é obrigatória para alterar a URL." });
        }
        fullyCmd = 'loadURL';
        extraParams = `&url=${encodeURIComponent(newUrl)}`;
      }

      // Endpoint oficial da REST API do Fully Kiosk Cloud
      const emailParam = apiEmail ? `&apiemail=${encodeURIComponent(apiEmail)}` : '';
      const fullyUrl = `https://api.fully-kiosk.com/remote/?cmd=${fullyCmd}&devid=${encodeURIComponent(deviceId)}${emailParam}&apikey=${encodeURIComponent(apiToken)}${extraParams}&type=json`;

      // Dispara a requisição GET para o endpoint oficial da API do Fully Kiosk
      const response = await fetch(fullyUrl, {
        method: 'GET',
      });

      const responseText = await response.text();
      
      // Verificação de tela de login / acesso negado / sessão expirada
      if (responseText.includes("Sign in") || responseText.includes("Login") || responseText.includes("Access Denied") || responseText.includes("Logged out")) {
        return res.status(401).json({ 
          requiresLogin: true,
          error: "Sessão do Fully Cloud expirada ou acesso negado. Faça login na sua conta da Fully Cloud para revalidar." 
        });
      }

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : { status: 'Success', statustext: 'Comando enviado com sucesso' };
      } catch (e) {
        // Se a requisição retornou 200 OK e texto/HTML de confirmação (ex: "String loaded" ou "OK"), considera sucesso
        data = { status: 'Success', statustext: 'Comando enviado para a Tela com sucesso.', rawResponse: responseText };
      }

      if (data && (data.status === 'Error' || data.statustext?.toLowerCase().includes('error'))) {
        return res.status(400).json({ error: data.statustext || "Erro retornado pela API do Fully Kiosk." });
      }

      return res.json(data);
    } catch (err: any) {
      console.error("Erro no comando Fully Cloud:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao enviar comando ao Fully Cloud." });
    }
  });

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
