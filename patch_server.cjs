const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const importStatement = `import { connectToWhatsApp, getWhatsAppStatus, logoutWhatsApp, sendWhatsAppMessage, startBillingJob } from "./whatsappService.js";\nimport cron from "node-cron";\n`;

content = importStatement + content;

const routes = `
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
`;

content = content.replace('  // API Route for Architect queries', routes + '\n  // API Route for Architect queries');

fs.writeFileSync('server.ts', content);
