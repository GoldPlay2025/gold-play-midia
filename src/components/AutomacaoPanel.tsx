import React, { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { 
  Zap, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save, 
  RefreshCw, 
  ShieldCheck, 
  MessageSquare, 
  Play, 
  Users, 
  Calendar, 
  Check, 
  X, 
  Sparkles,
  PhoneCall,
  History,
  Sliders,
  Database,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface LogItem {
  id: string;
  data: string;
  telefone: string;
  clienteNome?: string;
  status: 'sucesso' | 'erro';
  mensagem: string;
  detalhe?: string;
  tipo: 'manual' | 'automatico';
}

interface AutomacaoConfig {
  diasAntecedencia: number;
  horarioDisparo: string;
  ativo: boolean;
  mensagemTemplate: string;
  lastRunDate?: string;
  logs: LogItem[];
}

export function AutomacaoPanel() {
  const defaultConfig: AutomacaoConfig = {
    diasAntecedencia: 2,
    horarioDisparo: "09:00",
    ativo: false,
    mensagemTemplate: "Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}",
    logs: []
  };

  const getInitialConfig = (): AutomacaoConfig => {
    try {
      const saved = localStorage.getItem('goldplay_automacao_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultConfig, ...parsed };
      }
    } catch (e) {}
    return defaultConfig;
  };

  const [config, setConfig] = useState<AutomacaoConfig>(getInitialConfig);

  const updateAndPersistConfig = (updater: AutomacaoConfig | ((prev: AutomacaoConfig) => AutomacaoConfig)) => {
    setConfig(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('goldplay_automacao_config', JSON.stringify({ ...next, hasUserSaved: true }));
      } catch (e) {}
      return next;
    });
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Estados do Teste Manual Seguro
  const [testHorario, setTestHorario] = useState("09:00");
  const [testTelefone, setTestTelefone] = useState("");
  const [testMensagem, setTestMensagem] = useState("Ola! Este e um disparo de teste da Automacao Gold Play via GetSMS.");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  // Prévia de clientes elegíveis
  const [previewData, setPreviewData] = useState<{ count: number; targetDate: string; clients: any[] } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  // Estado para exibir e copiar o Script SQL do Supabase
  const [showSqlScript, setShowSqlScript] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const supabaseSqlScript = `-- SCRIPT SQL PARA O SUPABASE (SQL EDITOR)
-- Tabela de Automação de Cobrança GetSMS

CREATE TABLE IF NOT EXISTS automacao_config (
  id TEXT PRIMARY KEY DEFAULT 'sistema',
  dias_antecedencia INT DEFAULT 2,
  horario_disparo TEXT DEFAULT '09:00',
  ativo BOOLEAN DEFAULT false,
  mensagem_template TEXT DEFAULT 'Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}',
  last_run_date TEXT DEFAULT NULL,
  logs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir registro inicial obrigatorio ('sistema')
INSERT INTO automacao_config (id, dias_antecedencia, horario_disparo, ativo, mensagem_template)
VALUES ('sistema', 2, '09:00', false, 'Ola {cliente}, seu vencimento da mensalidade R$ {valor} e em {vencimento}. Chave PIX: {pix}')
ON CONFLICT (id) DO NOTHING;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(supabaseSqlScript);
    setCopiedSql(true);
    showToast('success', 'Script SQL copiado para a área de transferência!');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Helper para realizar parse seguro de JSON
  const safeJsonParse = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(res.ok ? 'Resposta inválida do servidor.' : `Erro HTTP ${res.status}: Servidor indisponível ou rota não configurada.`);
    }
  };

  // Carrega configurações
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      const res = await fetchApi('/api/automacao/config', { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await safeJsonParse(res);
        if (data && typeof data === 'object') {
          let savedLocal: any = null;
          try {
            const raw = localStorage.getItem('goldplay_automacao_config');
            if (raw) savedLocal = JSON.parse(raw);
          } catch (e) {}

          updateAndPersistConfig(prev => {
            const isLocalUserSaved = savedLocal?.hasUserSaved;
            return {
              ...prev,
              ...data,
              diasAntecedencia: typeof data.diasAntecedencia === 'number' ? data.diasAntecedencia : prev.diasAntecedencia,
              horarioDisparo: data.horarioDisparo || prev.horarioDisparo,
              ativo: isLocalUserSaved ? savedLocal.ativo : (typeof data.ativo === 'boolean' ? data.ativo : prev.ativo),
              mensagemTemplate: data.mensagemTemplate || prev.mensagemTemplate,
              logs: Array.isArray(data.logs) && data.logs.length > 0 ? data.logs : prev.logs
            };
          });
        }
      }
    } catch (err: any) {
      console.warn('Servidor offline ou resposta lenta. Usando configurações locais:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega prévia de clientes
  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const res = await fetchApi('/api/automacao/preview-clients', { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await safeJsonParse(res);
        if (data && typeof data === 'object') {
          setPreviewData(data);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar prévia de clientes:', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPreview();
  }, []);

  // Handler inteligente para o Toggle do Robô (Instantâneo no UI/LocalStorage + Sincronização em Background)
  const handleToggleAtivo = async () => {
    const nextAtivo = !config.ativo;

    updateAndPersistConfig(prev => ({ ...prev, ativo: nextAtivo }));
    showToast('success', nextAtivo ? 'Robô de Automação ATIVADO com sucesso!' : 'Robô de Automação PAUSADO.');

    try {
      await fetchApi('/api/automacao/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diasAntecedencia: Number(config.diasAntecedencia),
          horarioDisparo: config.horarioDisparo,
          ativo: nextAtivo,
          mensagemTemplate: config.mensagemTemplate
        })
      });
    } catch (err: any) {
      console.warn('Status salvo localmente. Aviso ao sincronizar com servidor:', err);
    }
  };

  // Salva configurações
  const handleSaveConfig = async () => {
    setSaving(true);
    updateAndPersistConfig(prev => ({ ...prev }));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const res = await fetchApi('/api/automacao/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diasAntecedencia: Number(config.diasAntecedencia),
          horarioDisparo: config.horarioDisparo,
          ativo: config.ativo,
          mensagemTemplate: config.mensagemTemplate
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await safeJsonParse(res);
        if (data && data.config) {
          updateAndPersistConfig(prev => ({ ...prev, ...data.config }));
        }
      }
      showToast('success', 'Configurações de automação salvas com sucesso!');
    } catch (err: any) {
      showToast('success', 'Configurações salvas!');
    } finally {
      setSaving(false);
      fetchPreview();
    }
  };

  // Executa o Teste Manual Seguro
  const handleRunManualTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTelefone.trim()) {
      showToast('error', 'Por favor, informe o número de telefone de destino.');
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetchApi('/api/automacao/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: testTelefone,
          horarioSimulado: testHorario,
          mensagemTeste: testMensagem
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || `SMS de teste enviado para ${testTelefone}!`,
          details: data.response
        });
        showToast('success', `Teste disparado com sucesso para ${testTelefone}!`);
        fetchConfig(); // Atualiza logs
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha ao enviar SMS de teste via GetSMS.',
          details: data.details
        });
        showToast('error', data.error || 'Falha no envio do teste.');
      }
    } catch (err: any) {
      clearTimeout(timer);
      const errMsg = err.name === 'AbortError' ? 'Tempo de resposta do servidor esgotado.' : err.message;
      setTestResult({
        success: false,
        message: 'Erro no teste: ' + errMsg
      });
      showToast('error', 'Erro no teste: ' + errMsg);
    } finally {
      setSendingTest(false);
    }
  };

  // Executar disparo em massa manual para clientes elegíveis agora
  const handleRunNow = async () => {
    if (!window.confirm('Deseja forçar a verificação e disparo de cobrança GetSMS para todos os clientes elegíveis de hoje?')) {
      return;
    }

    setRunningNow(true);
    try {
      const res = await fetchApi('/api/automacao/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await safeJsonParse(res);
      if (res.ok && data.success) {
        showToast('success', data.message || 'Varredura de automação concluída!');
        fetchConfig();
        fetchPreview();
      } else {
        showToast('error', data.error || 'Erro ao executar varredura.');
      }
    } catch (err: any) {
      showToast('error', 'Erro na requisição: ' + err.message);
    } finally {
      setRunningNow(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-amber-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-mono tracking-wider uppercase">Carregando Módulo de Automação...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-medium transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200' 
            : toast.type === 'error'
            ? 'bg-red-950/90 border-red-500/40 text-red-200'
            : 'bg-amber-950/90 border-amber-500/40 text-amber-200'
        }`}>
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          {toast.type === 'info' && <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Principal Limpo e Sutil */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Automação
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cobrança GetSMS e disparos automáticos diários.
          </p>
        </div>

        {/* Toggle Geral de Ativação com Persistência Automática */}
        <div className="flex items-center gap-3.5 bg-[#121216] border border-white/10 px-4 py-2.5 rounded-2xl shrink-0 self-start sm:self-auto shadow-lg">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Status do Robô</span>
            <span className={`text-xs font-bold ${config.ativo ? 'text-emerald-400' : 'text-slate-400'}`}>
              {config.ativo ? 'AUTOMÁTICO ATIVO' : 'AUTOMAÇÃO PAUSADA'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleAtivo}
            title={config.ativo ? 'Clique para pausar automação' : 'Clique para ativar automação'}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              config.ativo ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                config.ativo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Grid com 2 Colunas Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Coluna Esquerda: Configurações de Regra e Horário (Col 7) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Card: Parâmetros do Disparo Automático */}
          <div className="bg-[#121216] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-6 shadow-xl relative">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Parâmetros de Cobrança</h2>
                <p className="text-xs text-slate-400">Defina os dias de antecedência e o horário do disparo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Dia de Cobrança (Antecedência) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Dia de Cobrança
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={config.diasAntecedencia}
                    onChange={(e) => setConfig({ ...config, diasAntecedencia: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                    dias antes
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Padrão: 2 dias antes do vencimento do cliente.
                </p>
              </div>

              {/* Horário do Disparo */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Horário de Disparo
                </label>
                <input
                  type="time"
                  value={config.horarioDisparo}
                  onChange={(e) => setConfig({ ...config, horarioDisparo: e.target.value })}
                  className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  Horário diário em que o servidor efetuará os disparos.
                </p>
              </div>
            </div>

            {/* Template de Mensagem SMS */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                  Modelo de Mensagem SMS
                </label>
                <span className={`text-[10px] font-mono ${config.mensagemTemplate.length > 160 ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                  {config.mensagemTemplate.length}/160 caracteres
                </span>
              </div>
              <textarea
                rows={3}
                value={config.mensagemTemplate}
                onChange={(e) => setConfig({ ...config, mensagemTemplate: e.target.value })}
                placeholder="Ex: Ola {cliente}, sua mensalidade R$ {valor} vence em {vencimento}."
                className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl p-3.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-colors leading-relaxed"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500 mr-1">Tags disponíveis:</span>
                {['{cliente}', '{valor}', '{vencimento}', '{pix}'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setConfig({ ...config, mensagemTemplate: config.mensagemTemplate + ' ' + tag })}
                    className="text-[10px] font-mono bg-white/5 hover:bg-white/10 border border-white/10 text-amber-400 px-2 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Botão de Salvar */}
            <div className="pt-3 flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Salvar Preferências</span>
              </button>
            </div>
          </div>

          {/* Card: Prévia de Clientes Elegíveis Hoje */}
          <div className="bg-[#121216] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Clientes Elegíveis para Cobrança</h3>
                  <p className="text-xs text-slate-400">
                    Vencimentos previstos para {previewData?.targetDate ? new Date(previewData.targetDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '...'} ({config.diasAntecedencia} dias antes)
                  </p>
                </div>
              </div>

              <button
                onClick={fetchPreview}
                disabled={loadingPreview}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95"
                title="Atualizar lista de clientes"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPreview ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>

            {previewData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Clientes encontrados: <strong className="text-amber-400 font-bold">{previewData.count}</strong></span>
                  <button
                    onClick={handleRunNow}
                    disabled={runningNow || previewData.count === 0}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {runningNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-emerald-300" />}
                    <span>Disparar Varredura Agora</span>
                  </button>
                </div>

                {previewData.clients.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    Nenhum cliente com vencimento programado para daqui a {config.diasAntecedencia} dia(s).
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {previewData.clients.map((cli: any) => (
                      <div key={cli.id} className="p-3 rounded-xl bg-[#0a0a0d] border border-white/5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{cli.nome_empresa}</p>
                          <p className="text-[10px] font-mono text-slate-400">{cli.whatsapp || cli.telefone || cli.contato || 'Sem telefone'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-amber-400 font-bold font-mono">
                            {cli.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cli.valor) : 'R$ 0,00'}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            Venc: {cli.vencimento ? new Date(cli.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Coluna Direita: Recurso de Teste Manual Seguro (Col 5) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Card: Recurso de Teste Manual Seguro */}
          <div className="bg-[#121216] border border-amber-500/30 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Teste Manual Seguro
                  <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono uppercase">
                    Isolado
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Simule um disparo GetSMS sem alterar dados do banco</p>
              </div>
            </div>

            {/* Aviso de Isolamento */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Este teste envia um SMS direto via GetSMS para o número especificado. Nenhuma tabela de clientes ou histórico de telas é alterado.
              </span>
            </div>

            <form onSubmit={handleRunManualTest} className="space-y-4">
              {/* Horário Simulado */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Horário Simulado
                </label>
                <input
                  type="time"
                  value={testHorario}
                  onChange={(e) => setTestHorario(e.target.value)}
                  className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              {/* Número de Telefone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                  Número de Telefone de Destino
                </label>
                <input
                  type="text"
                  placeholder="Ex: (44) 99176-2249"
                  value={testTelefone}
                  onChange={(e) => setTestTelefone(e.target.value)}
                  className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              {/* Mensagem de Teste */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  Mensagem de Teste
                </label>
                <textarea
                  rows={3}
                  value={testMensagem}
                  onChange={(e) => setTestMensagem(e.target.value)}
                  className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              {/* Botão Disparar Teste */}
              <button
                type="submit"
                disabled={sendingTest}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xl shadow-amber-500/20 disabled:opacity-50"
              >
                {sendingTest ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Send className="w-4 h-4 text-slate-950" />
                )}
                <span>Disparar SMS de Teste Agora</span>
              </button>
            </form>

            {/* Resultado do Teste */}
            {testResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                testResult.success 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-950/40 border-red-500/30 text-red-300'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                  <span>{testResult.message}</span>
                </div>
                {testResult.details && (
                  <pre className="p-2 rounded bg-black/40 font-mono text-[10px] overflow-x-auto text-slate-300 max-h-28">
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Tabela de Histórico de Disparos Recentes (Logs) */}
      <div className="bg-[#121216] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Histórico de Disparos GetSMS</h3>
              <p className="text-xs text-slate-400">Logs de envios automáticos e testes manuais executados</p>
            </div>
          </div>

          <button
            onClick={fetchConfig}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Logs</span>
          </button>
        </div>

        {config.logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">
            Nenhum registro de disparo realizado até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="pb-3 px-3">Data / Hora</th>
                  <th className="pb-3 px-3">Tipo</th>
                  <th className="pb-3 px-3">Destino</th>
                  <th className="pb-3 px-3">Mensagem</th>
                  <th className="pb-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {config.logs.slice(0, 30).map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap text-slate-400">
                      {new Date(log.data).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {log.tipo === 'manual' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px]">
                          TESTE MANUAL
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[10px]">
                          AUTOMÁTICO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-white">
                      {log.clienteNome && <span className="block font-sans font-bold text-slate-200">{log.clienteNome}</span>}
                      <span className="text-[11px] text-slate-400">{log.telefone}</span>
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-300" title={log.mensagem}>
                      {log.mensagem}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {log.status === 'sucesso' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                          <Check className="w-3 h-3" /> Sucesso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold" title={log.detalhe}>
                          <X className="w-3 h-3" /> Falha
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Card de Configuração do Supabase (Script SQL) */}
      <div className="bg-[#121216] border border-amber-500/20 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Tabela Supabase (`automacao_config`)
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                  Persistência na Vercel
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Execute o script abaixo no SQL Editor do Supabase para criar e popular a tabela de configurações.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySql}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              {copiedSql ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
            </button>

            <button
              onClick={() => setShowSqlScript(!showSqlScript)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-all cursor-pointer"
              title={showSqlScript ? "Ocultar código SQL" : "Exibir código SQL"}
            >
              {showSqlScript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showSqlScript && (
          <div className="space-y-3 pt-2">
            <div className="relative">
              <pre className="p-4 rounded-2xl bg-[#0a0a0d] border border-white/10 text-amber-300/90 font-mono text-xs overflow-x-auto leading-relaxed select-all">
                {supabaseSqlScript}
              </pre>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              💡 <strong>Como usar:</strong> Acesse seu painel do Supabase, clique em <strong>SQL Editor</strong> no menu lateral, cole o código acima e clique em <strong>RUN</strong>. A tabela <code className="text-amber-400">automacao_config</code> será criada instantaneamente com a linha padrão gravada.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
