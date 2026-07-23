-- =============================================================================
-- TABELA DE CUSTOS OPERACIONAIS (GOLPLAY MANAGER - GESTÃO FINANCEIRA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS custos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao text NOT NULL,
  valor numeric(10, 2) NOT NULL,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  recorrencia text NOT NULL DEFAULT 'Anual', -- 'Único', 'Mensal', 'Anual'
  categoria text DEFAULT 'Licença Fully Kiosk', -- 'Licença Fully Kiosk', 'Servidor', 'Marketing', 'Outros'
  observacoes text,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) se necessário no Supabase
ALTER TABLE custos ENABLE ROW LEVEL SECURITY;

-- Política de Acesso Público para leitura e escrita na tabela custos (ajuste conforme autenticação)
CREATE POLICY "Acesso total a custos" ON custos FOR ALL USING (true) WITH CHECK (true);

-- Index para otimização de consultas por data e categoria
CREATE INDEX IF NOT EXISTS idx_custos_data_pagamento ON custos(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_custos_categoria ON custos(categoria);
