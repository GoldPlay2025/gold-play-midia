-- Script SQL para criar a tabela de sessões do WhatsApp no Supabase

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Configurar RLS (Row Level Security) se necessário
-- ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Apenas admin pode acessar" ON whatsapp_sessions FOR ALL USING (auth.role() = 'authenticated');
