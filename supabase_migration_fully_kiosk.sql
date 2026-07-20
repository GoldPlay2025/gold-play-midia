-- ETAPA 1: ATUALIZAÇÃO DO BANCO DE DADOS (SUPABASE)
-- Execute este script no SQL Editor do seu painel do Supabase.

ALTER TABLE telas 
ADD COLUMN IF NOT EXISTS fully_device_id VARCHAR(255);

-- Se a tabela de telas tiver Políticas de Segurança (RLS - Row Level Security),
-- certifique-se de que os usuários adequados têm permissão de UPDATE
-- e SELECT para essa coluna caso você utilize RLS rigoroso.
