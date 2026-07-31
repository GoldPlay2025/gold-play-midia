# 🚀 Guia de Instalação e Implantação — Gold Play Mídia

> **Documento Oficial de Reinstalação e Implantação do Sistema Gold Play Mídia**  
> *Versão:* 1.1.0  
> *Este arquivo é estritamente documental para futuras reinstalações ou migrações do sistema.*

---

## 📋 Sumário
1. [Pré-requisitos do Sistema](#1-pré-requisitos-do-sistema)
2. [Passo 1: Configuração do Banco de Dados no Supabase](#passo-1-configuração-do-banco-de-dados-no-supabase)
3. [Passo 2: Obtenção e Organização das Chaves de API](#passo-2-obtenção-e-organização-das-chaves-de-api)
4. [Passo 3: Configuração do Servidor e Implantação na Vercel](#passo-3-configuração-do-servidor-e-implantação-na-vercel)
5. [Passo 4: Verificação Pós-Instalação](#passo-4-verificação-pós-instalação)
6. [Anexo: Script SQL Unificado do Banco de Dados](#anexo-script-sql-unificado-do-banco-de-dados)

---

## 1. ⚙️ Pré-requisitos do Sistema

Para realizar a implantação do Gold Play Mídia a partir do zero em um novo ambiente ou conta, você precisará de:

* **Conta no Supabase** ([supabase.com](https://supabase.com)) — Banco de dados PostgreSQL & Storage de Mídias.
* **Conta na Vercel** ([vercel.com](https://vercel.com)) ou provedor Node.js compatível.
* **Chave da API do Google Gemini** ([aistudio.google.com](https://aistudio.google.com)) — Recursos inteligentes de conteúdo e análise.
* **Token da API Fully Kiosk Cloud** (*opcional, caso utilize integração remota com TVs/Players Android*).
* **Node.js (versão 18 ou superior)** para desenvolvimento ou execução local.

---

## 🗄️ Passo 1: Configuração do Banco de Dados no Supabase

1. Acesse o painel do **Supabase** e clique em **New Project**.
2. Defina o nome do projeto (ex: `Gold Play Midia`), crie uma senha forte para o banco e selecione a região mais próxima (ex: *São Paulo / America-South*).
3. Após a inicialização do projeto, vá no menu **SQL Editor** na barra lateral esquerda.
4. Clique em **New Query**, cole o **Script SQL Unificado** (disponível no [Anexo](#anexo-script-sql-unificado-do-banco-de-dados)) e clique em **Run**.
5. Vá até o menu **Storage** -> **Buckets**:
   * Verifique se o bucket `midias` foi criado.
   * Certifique-se de que a opção **Public Bucket** está ativada (para que as TVs e players consigam reproduzir os vídeos/imagens).
6. Vá no menu **Project Settings** -> **API**:
   * Guarde a **Project URL** (exemplo: `https://xxxxxx.supabase.co`).
   * Guarde a **anon / public key** (chave de acesso pública).

---

## 🔑 Passo 2: Obtenção e Organização das Chaves de API

Para o funcionamento completo do sistema (autenticação, banco, inteligência, módulo financeiro e WhatsApp), configure as seguintes chaves de ambiente:

### 1. Banco de Dados (Supabase)
* `VITE_SUPABASE_URL`: URL do projeto obtida no Supabase (ex: `https://sua-url.supabase.co`).
* `VITE_SUPABASE_ANON_KEY`: Chave pública `anon` do Supabase.

### 2. Google Gemini IA (Servidor)
* `GEMINI_API_KEY`: Chave gerada no Google AI Studio para recursos inteligentes.

### 3. Integração Fully Kiosk (Controle Remoto de Displays)
* `FULLY_API_TOKEN`: Token gerado em *Fully Kiosk Cloud Account Settings* para sincronização automática com displays.

### 4. Segurança da API WhatsApp & App
* `VITE_WHATSAPP_API_KEY`: Chave interna de segurança para comunicação com os endpoints do WhatsApp.
* `APP_URL`: URL principal da sua aplicação implantada (ex: `https://seu-dominio.vercel.app`).

---

## 🌐 Passo 3: Configuração do Servidor e Implantação na Vercel

1. **Importação do Repositório**:
   * Faça o login no painel da **Vercel**.
   * Clique em **Add New...** -> **Project**.
   * Selecione o repositório Git do sistema **Gold Play Mídia**.

2. **Configuração do Projeto na Vercel**:
   * **Framework Preset**: *Vite* (ou *Other*).
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm install`

3. **Inclusão das Variáveis de Ambiente (Environment Variables)**:
   Adicione cada uma das chaves no painel da Vercel em **Environment Variables**:

   | Nome da Variável | Valor | Descrição |
   | :--- | :--- | :--- |
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | URL do Supabase |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Chave Anon do Supabase |
   | `GEMINI_API_KEY` | `AIzaSy...` | Chave da API do Google Gemini |
   | `FULLY_API_TOKEN` | `xxxx-xxxx-xxxx` | Token do Fully Kiosk Cloud |
   | `VITE_WHATSAPP_API_KEY` | `sua_chave_secreta_aqui` | Chave de segurança interna da API |
   | `APP_URL` | `https://seu-dominio.vercel.app` | URL de produção da Vercel |

4. Clique em **Deploy** e aguarde a finalização do processo de build.

---

## ✅ Passo 4: Verificação Pós-Instalação

Após a conclusão da implantação:

1. **Acesso ao Painel Admin**:
   * Acesse `https://seu-dominio.vercel.app/admin`.
   * Verifique se as telas, clientes, mídias e gestão de custos estão carregando sem erros de conexão com o banco.
2. **Mídias e Playlist**:
   * Faça o upload de uma mídia de teste na biblioteca.
   * Crie uma tela de exibição e vincule a mídia.
3. **Módulo Financeiro & Custos**:
   * Teste a inclusão de um novo custo (ex: Licença Fully Kiosk) e a remoção com confirmação em tempo real.
4. **Conexão WhatsApp (Baileys)**:
   * Acessar o painel WhatsApp e verificar a leitura do QR Code para pairing.

---

## 📜 Anexo: Script SQL Unificado do Banco de Dados

Copie e cole este código no **SQL Editor** do Supabase para estruturar todas as tabelas, relacionamentos, tabela de custos operacionais e permissões de storage necessárias:

```sql
-- =============================================================================
-- SCRIPT DE INSTALAÇÃO COMPLETO - GOLD PLAY MÍDIA (SUPABASE)
-- =============================================================================

-- 1. Tabela de Clientes / Empresas
CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_empresa text NOT NULL,
  whatsapp text,
  endereco_fisico text,
  valor numeric,
  vencimento date,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Telas / Displays
CREATE TABLE IF NOT EXISTS telas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_local text NOT NULL,
  identificador_unico text NOT NULL UNIQUE,
  status_online boolean DEFAULT false,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  endereco text,
  whatsapp text,
  fully_device_id varchar(255),
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Biblioteca de Mídias
CREATE TABLE IF NOT EXISTS midias (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo_video text NOT NULL,
  url_storage text NOT NULL,
  tamanho_mb numeric,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Playlists (Associação Tela x Mídia)
CREATE TABLE IF NOT EXISTS playlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tela_id uuid REFERENCES telas(id) ON DELETE CASCADE NOT NULL,
  midia_id uuid REFERENCES midias(id) ON DELETE CASCADE NOT NULL,
  ordem_exibicao integer DEFAULT 0 NOT NULL,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela de Sessões WhatsApp (Baileys Persistence)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id text PRIMARY KEY,
  data text NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 6. Tabela de Custos Operacionais (Gestão Financeira)
CREATE TABLE IF NOT EXISTS custos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao text NOT NULL,
  valor numeric(10, 2) NOT NULL,
  data_pagamento date DEFAULT current_date NOT NULL,
  recorrencia text DEFAULT 'Anual' NOT NULL,
  categoria text DEFAULT 'Licença Fully Kiosk',
  observacoes text,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Configuração do Bucket no Supabase Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('midias', 'midias', true)
ON CONFLICT (id) DO NOTHING;

-- Permissão de leitura pública para o bucket de mídias
CREATE POLICY "Acesso público de leitura para midias" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'midias');

-- Permissão de inserção pública/autenticada no bucket de mídias
CREATE POLICY "Acesso público de escrita para midias" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'midias');
```

---
*Gold Play Mídia — Sistema de Gestão de Mídias e Digital Signage.*
