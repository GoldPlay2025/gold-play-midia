import express from "express";
import path from "path";
import fs from "fs";
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
      const { deviceId, action, newUrl, customApiToken, customApiEmail } = req.body || {};
      
      let apiToken = (customApiToken || process.env.FULLY_API_TOKEN || process.env.FULLY_API_KEY || '').trim();
      let apiEmail = (customApiEmail || process.env.FULLY_API_EMAIL || '').trim();

      // Clean default placeholders
      if (apiToken === 'YOUR_FULLY_API_TOKEN' || apiToken === 'MY_FULLY_API_TOKEN') {
        apiToken = '';
      }

      if (!apiToken) {
        return res.status(400).json({ 
          requiresConfig: true,
          error: "O Token de API do Fully Cloud não está configurado. Por favor, clique em 'Login / Configurar Fully Cloud' para salvar seu API Token e E-mail da conta." 
        });
      }
      
      if (!deviceId || !action) {
        return res.status(400).json({ error: "O deviceId e a action são obrigatórios." });
      }

      const cleanDeviceId = String(deviceId).trim();

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
        extraParams = `&url=${encodeURIComponent(newUrl.trim())}`;
      }

      const emailParam = apiEmail ? `&email=${encodeURIComponent(apiEmail)}&apiemail=${encodeURIComponent(apiEmail)}` : '';

      // Tenta 1º endpoint: Cloud REST API Oficial
      const cloudUrl = `https://cloud.fully-kiosk.com/api/?cmd=${fullyCmd}&devid=${encodeURIComponent(cleanDeviceId)}&password=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}${emailParam}${extraParams}&type=json`;

      let response = await fetch(cloudUrl, { method: 'GET' });
      let responseText = await response.text();

      let data: any;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        data = { status: 'Success', statustext: responseText };
      }

      // Se falhar no 1º endpoint com erro de Login/Auth, tenta 2º endpoint: Remote Admin REST API
      if (data?.status === 'Error' || (data?.statustext && data.statustext.toLowerCase().includes('login'))) {
        const remoteUrl = `https://api.fully-kiosk.com/remote/?cmd=${fullyCmd}&devid=${encodeURIComponent(cleanDeviceId)}&password=${encodeURIComponent(apiToken)}&apikey=${encodeURIComponent(apiToken)}${emailParam}${extraParams}&type=json`;
        const remoteResp = await fetch(remoteUrl, { method: 'GET' });
        const remoteText = await remoteResp.text();
        try {
          const remoteData = JSON.parse(remoteText);
          if (remoteData?.status === 'Success' || (remoteData?.statustext && !remoteData.statustext.toLowerCase().includes('login'))) {
            data = remoteData;
          }
        } catch (e) {}
      }

      if (data && (data.status === 'Error' || data.statustext?.toLowerCase().includes('error') || data.statustext?.toLowerCase().includes('login'))) {
        if (data.statustext?.toLowerCase().includes('login') || data.statustext?.toLowerCase().includes('key') || data.statustext?.toLowerCase().includes('access')) {
          return res.status(400).json({ 
            requiresConfig: true,
            error: `Erro de Autenticação no Fully Cloud: "${data.statustext}". Por favor, clique no botão 'Login / Configurar Fully Cloud' e salve seu API Token/Senha e E-mail da conta.` 
          });
        }
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

  // File-backed persistent storage for costs
  const CUSTOS_FILE_PATH = path.join(process.cwd(), "custos_data.json");

  function readCustosFromFile(): Array<{
    id: string;
    descricao: string;
    valor: number;
    data_pagamento: string;
    recorrencia: string;
    categoria: string;
    observacoes?: string;
    criado_em: string;
  }> {
    try {
      if (fs.existsSync(CUSTOS_FILE_PATH)) {
        const fileContent = fs.readFileSync(CUSTOS_FILE_PATH, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Erro ao ler custos_data.json:", e);
    }
    const initialCosts = [
      {
        id: "cost-1",
        descricao: "Licenciamento Anual Fully Kiosk (10 Telas)",
        valor: 820.00,
        data_pagamento: "2026-01-15",
        recorrencia: "Anual",
        categoria: "Licença Fully Kiosk",
        observacoes: "Pagamento para renovação anual de licenças de exibição",
        criado_em: new Date().toISOString()
      },
      {
        id: "cost-2",
        descricao: "Hospedagem & Servidor Cloud",
        valor: 150.00,
        data_pagamento: "2026-07-01",
        recorrencia: "Mensal",
        categoria: "Servidor",
        observacoes: "Infraestrutura de streaming e API Gold Play",
        criado_em: new Date().toISOString()
      }
    ];
    saveCustosToFile(initialCosts);
    return initialCosts;
  }

  function saveCustosToFile(custosList: any[]) {
    try {
      fs.writeFileSync(CUSTOS_FILE_PATH, JSON.stringify(custosList, null, 2), "utf-8");
    } catch (e) {
      console.warn("Erro ao gravar custos_data.json:", e);
    }
  }

  // API Endpoints para Gestão de Custos com Timeout Seguro & Persistência Local Garantida
  app.get("/api/custos", async (req, res) => {
    try {
      let persistentCustos = readCustosFromFile();
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
          const resp = await fetch(`${supabaseUrl}/rest/v1/custos?select=*&order=data_pagamento.desc`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const dbData = await resp.json();
            if (Array.isArray(dbData) && dbData.length > 0) {
              const existingIds = new Set(persistentCustos.map(c => c.id));
              let updated = false;
              dbData.forEach((item: any) => {
                if (!existingIds.has(item.id)) {
                  persistentCustos.push(item);
                  updated = true;
                }
              });
              if (updated) saveCustosToFile(persistentCustos);
            }
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
        }
      }
      return res.json(persistentCustos);
    } catch (err) {
      return res.json(readCustosFromFile());
    }
  });

  app.post("/api/custos", async (req, res) => {
    try {
      const { id, descricao, valor, data_pagamento, recorrencia, categoria, observacoes } = req.body;
      if (!descricao || valor === undefined) {
        return res.status(400).json({ error: "Descrição e Valor são obrigatórios." });
      }

      let persistentCustos = readCustosFromFile();
      const costId = id || ("cost-" + Date.now());

      const newCost = {
        id: costId,
        descricao,
        valor: Number(valor),
        data_pagamento: data_pagamento || new Date().toISOString().split('T')[0],
        recorrencia: recorrencia || "Anual",
        categoria: categoria || "Licença Fully Kiosk",
        observacoes: observacoes || "",
        criado_em: new Date().toISOString()
      };

      // Se já existir item com esse ID, atualiza. Se não, adiciona no topo.
      const existingIdx = persistentCustos.findIndex(c => c.id === costId);
      if (existingIdx >= 0) {
        persistentCustos[existingIdx] = newCost;
      } else {
        persistentCustos.unshift(newCost);
      }
      saveCustosToFile(persistentCustos);

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
          const resp = await fetch(`${supabaseUrl}/rest/v1/custos`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              id: newCost.id,
              descricao: newCost.descricao,
              valor: newCost.valor,
              data_pagamento: newCost.data_pagamento,
              recorrencia: newCost.recorrencia,
              categoria: newCost.categoria,
              observacoes: newCost.observacoes
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const inserted = await resp.json();
            if (inserted && inserted[0]) {
              return res.json(inserted[0]);
            }
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
        }
      }

      return res.json(newCost);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao salvar custo." });
    }
  });

  app.delete("/api/custos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let persistentCustos = readCustosFromFile();
      persistentCustos = persistentCustos.filter(c => c.id !== id);
      saveCustosToFile(persistentCustos);

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
          await fetch(`${supabaseUrl}/rest/v1/custos?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (fetchErr) {
          clearTimeout(timeoutId);
        }
      }

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Erro ao remover custo." });
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
