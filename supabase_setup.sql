-- =========================================================================
-- SCRIPT DE CONFIGURAÇÃO COMPLETA DO BANCO DE DADOS SUPABASE
-- Gold Play Mídia - Digital Signage Workspace
-- Use este script no "SQL Editor" do seu painel Supabase para reiniciar
-- e configurar corretamente todas as tabelas e permissões do sistema.
-- =========================================================================

-- 1. LIMPAR TABELAS EXISTENTES (Reset Completo)
-- ATENÇÃO: Isso apagará todos os dados existentes para evitar conflitos!
drop table if exists playlists cascade;
drop table if exists midias cascade;
drop table if exists telas cascade;
drop table if exists clientes cascade;

-- 2. CRIAR TABELA: Clientes
create table clientes (
  id uuid default gen_random_uuid() primary key,
  nome_empresa text not null,
  whatsapp text,
  endereco_fisico text,
  valor numeric,
  vencimento date,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. CRIAR TABELA: Telas
create table telas (
  id uuid default gen_random_uuid() primary key,
  nome_local text not null,
  identificador_unico text not null unique,
  status_online boolean default false,
  cliente_id uuid references clientes(id) on delete cascade not null,
  endereco text,
  whatsapp text,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. CRIAR TABELA: Mídias (Gerenciar Mídias)
create table midias (
  id uuid default gen_random_uuid() primary key,
  titulo_video text not null,
  url_storage text not null,
  tamanho_mb numeric,
  cliente_id uuid references clientes(id) on delete cascade not null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. CRIAR TABELA: Playlists (Relação entre Telas e Mídias)
create table playlists (
  id uuid default gen_random_uuid() primary key,
  tela_id uuid references telas(id) on delete cascade not null,
  midia_id uuid references midias(id) on delete cascade not null,
  ordem_exibicao integer default 0 not null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. CONFIGURAÇÃO DE SEGURANÇA (Row Level Security - RLS)
-- Para garantir o funcionamento irrestrito do painel, desativamos o RLS por padrão.
alter table clientes disable row level security;
alter table telas disable row level security;
alter table midias disable row level security;
alter table playlists disable row level security;

-- Caso o RLS seja reativado ou mantido ativo pelo Supabase, criamos políticas públicas irrestritas (CRUD completo)
-- para permitir que as requisições anônimas funcionem normalmente.

-- Políticas para Clientes
drop policy if exists "Acesso público total clientes" on clientes;
create policy "Acesso público total clientes" on clientes for all using (true) with check (true);

-- Políticas para Telas
drop policy if exists "Acesso público total telas" on telas;
create policy "Acesso público total telas" on telas for all using (true) with check (true);

-- Políticas para Mídias
drop policy if exists "Acesso público total midias" on midias;
create policy "Acesso público total midias" on midias for all using (true) with check (true);

-- Políticas para Playlists
drop policy if exists "Acesso público total playlists" on playlists;
create policy "Acesso público total playlists" on playlists for all using (true) with check (true);

-- 7. CONFIGURAÇÃO DO BUCKET DE ARMAZENAMENTO (Storage)
-- Cria o bucket "midias" caso ele ainda não exista no Supabase.
insert into storage.buckets (id, name, public) 
values ('midias', 'midias', true)
on conflict (id) do nothing;

-- Criar políticas de acesso público para o bucket de mídias (uploads e downloads livres)
-- Primeiro removemos políticas antigas para evitar erros de duplicidade
drop policy if exists "Permitir uploads publicos de midias" on storage.objects;
drop policy if exists "Permitir leitura publica de midias" on storage.objects;
drop policy if exists "Permitir deletar midias" on storage.objects;

-- Criamos políticas atualizadas
create policy "Permitir uploads publicos de midias" on storage.objects
  for insert with check (bucket_id = 'midias');

create policy "Permitir leitura publica de midias" on storage.objects
  for select using (bucket_id = 'midias');

create policy "Permitir deletar midias" on storage.objects
  for delete using (bucket_id = 'midias');
