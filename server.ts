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
      const apiToken = process.env.FULLY_API_TOKEN;

      if (!apiToken) {
        return res.status(503).json({ error: "FULLY_API_TOKEN não configurado no servidor." });
      }
      
      if (!deviceId || !action) {
        return res.status(400).json({ error: "O deviceId e a action são obrigatórios." });
      }

      let fullyCmd = action;
      let extraParams = "";

      if (action === 'change_url') {
        if (!newUrl) {
          return res.status(400).json({ error: "A propriedade newUrl é obrigatória para alterar a URL." });
        }
        fullyCmd = 'loadURL';
        extraParams = `&url=${encodeURIComponent(newUrl)}`;
      }

      // A URL no formato exato exigido pela documentação do Fully Cloud
      const fullyUrl = `https://cloud.fully-kiosk.com/api/?cmd=${fullyCmd}${extraParams}&deviceId=${deviceId}&token=${apiToken}&type=json`;

      // Dispara a ordem para o servidor deles usando GET, como exigido pela API do Fully Cloud
      const response = await fetch(fullyUrl, {
        method: 'GET', 
        headers: {
          'Accept': 'application/json',
        }
      });

      // Evita o erro "Unexpected token '<'" verificando se a resposta é HTML
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
         return res.status(502).json({ error: "A API do Fully Cloud retornou uma página HTML (possivelmente página de Login). A URL ou o Token estão incorretos e causaram um redirecionamento." });
      }

      // Pega a resposta como texto primeiro para evitar erro de JSON vazio
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

      // Se o Fully Cloud retornar erro, repassa para o painel
      if (data && data.status === 'Error') {
         return res.status(400).json({ error: data.statustext });
      }

      res.json(data);
    } catch (err: any) {
      console.error("Erro no comando Fully Cloud:", err);
      res.status(500).json({ error: 'Falha de comunicação com o Fully Cloud' });
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
