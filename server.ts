import { connectToWhatsApp, getWhatsAppStatus, logoutWhatsApp, sendWhatsAppMessage, startBillingJob } from "./whatsappService.js";
import cron from "node-cron";
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


  // WhatsApp API Routes
  app.get("/api/whatsapp/status", (req, res) => {
    res.json(getWhatsAppStatus());
  });

  app.post("/api/whatsapp/connect", (req, res) => {
    connectToWhatsApp();
    res.json({ message: "Connecting..." });
  });

  app.post("/api/whatsapp/logout", (req, res) => {
    logoutWhatsApp();
    res.json({ message: "Logged out" });
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { number, message } = req.body;
      if (!number || !message) {
        return res.status(400).json({ error: "Number and message are required" });
      }
      await sendWhatsAppMessage(number, message);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post("/api/whatsapp/trigger-billing", async (req, res) => {
    try {
        const { clients, template } = req.body;
        if (!clients || !template) return res.status(400).json({ error: "Missing clients or template" });
        
        startBillingJob(clients, template);
        res.json({ success: true, message: "Job started" });
    } catch(err: any) {
        res.status(500).json({ error: err.message });
    }
  });

  // Fully Cloud API Routes
  app.post("/api/fully/command", async (req, res) => {
    try {
      const { deviceId, action } = req.body;
      const apiToken = process.env.FULLY_API_TOKEN;

      if (!apiToken) {
        return res.status(503).json({ error: "FULLY_API_TOKEN não configurado no servidor." });
      }
      
      if (!deviceId || !action) {
        return res.status(400).json({ error: "O deviceId e a action são obrigatórios." });
      }

      // A URL no formato exato exigido pela documentação do Fully Cloud
      const fullyUrl = `https://cloud.fully-kiosk.com/?cmd=${action}&deviceId=${deviceId}&token=${apiToken}&type=json`;

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
