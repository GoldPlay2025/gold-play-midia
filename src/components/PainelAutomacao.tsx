import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Save, Bot, Clock, CalendarDays, AlertTriangle } from 'lucide-react';
import { PillProgressButton } from './PillProgressButton';

export function AutomacaoPanel({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'loading' | 'error' | 'ok'>('loading');
  const [showSqlInstruction, setShowSqlInstruction] = useState(false);

  const [form, setForm] = useState({
    automacao_cobranca_ativa: false,
    automacao_dias_antes: 1,
    automacao_horario: '09:00',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'sistema')
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('column')) {
          setShowSqlInstruction(true);
        }
        setDbStatus('error');
        return;
      }

      if (data) {
        setForm({
          automacao_cobranca_ativa: data.automacao_cobranca_ativa ?? false,
          automacao_dias_antes: data.automacao_dias_antes ?? 1,
          automacao_horario: data.automacao_horario ?? '09:00',
        });
      }
      setDbStatus('ok');
    } catch (err) {
      console.error(err);
      setDbStatus('error');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('configuracoes')
        .update({
          automacao_cobranca_ativa: form.automacao_cobranca_ativa,
          automacao_dias_antes: Number(form.automacao_dias_antes),
          automacao_horario: form.automacao_horario,
        })
        .eq('id', 'sistema');

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01' || error.code === '42703') {
           setShowSqlInstruction(true);
           throw new Error('Colunas de automação não encontradas. Execute o SQL.');
        }
        throw error;
      }

      showToast('success', 'Configurações de automação salvas com sucesso!');
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao salvar automação');
    } finally {
      setLoading(false);
    }
  };

  const sqlQuery = `ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS automacao_cobranca_ativa BOOLEAN DEFAULT false;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS automacao_dias_antes INTEGER DEFAULT 1;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS automacao_horario TEXT DEFAULT '09:00';`;

  if (dbStatus === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-3xl font-display font-light text-white mb-2 tracking-tight">Automação</h2>
        <p className="text-sm text-slate-500 font-light">Configure tarefas automáticas do sistema, como alertas e cobranças.</p>
      </div>

      {showSqlInstruction && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-2xl mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-1" />
            <div>
              <h3 className="text-amber-500 font-bold mb-2">Atualização de Banco de Dados Necessária</h3>
              <p className="text-amber-200/70 text-sm mb-4">
                Para ativar as automações de cobrança, é necessário adicionar as novas colunas à tabela <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300">configuracoes</code> no Supabase.
              </p>
              <div className="bg-black/50 p-4 rounded-xl border border-amber-500/20 font-mono text-xs text-amber-400 overflow-x-auto whitespace-pre">
                {sqlQuery}
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(sqlQuery);
                  showToast('success', 'SQL copiado!');
                }}
                className="mt-4 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 text-sm rounded-lg transition-colors border border-amber-500/30"
              >
                Copiar SQL
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#0c0c10]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/10 flex items-center justify-center border border-indigo-500/20">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-display text-white">Lembretes de Cobrança</h3>
            <p className="text-sm text-slate-400 mt-1">Envio automático de e-mails de vencimento.</p>
          </div>
        </div>

        <div className="space-y-6">
          <label className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                checked={form.automacao_cobranca_ativa}
                onChange={(e) => setForm({ ...form, automacao_cobranca_ativa: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </div>
            <div>
              <p className="text-white font-medium">Ativar E-mails Automáticos</p>
              <p className="text-xs text-slate-400">Quando ativado, o sistema enviará alertas de cobrança antes e no dia do vencimento.</p>
            </div>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                Dias antes do Vencimento
              </label>
              <select
                value={form.automacao_dias_antes}
                onChange={(e) => setForm({ ...form, automacao_dias_antes: Number(e.target.value) })}
                className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all appearance-none"
              >
                <option value={1}>1 Dia antes</option>
                <option value={2}>2 Dias antes</option>
                <option value={3}>3 Dias antes</option>
                <option value={5}>5 Dias antes</option>
                <option value={7}>7 Dias antes</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Horário de Envio (Aproximado)
              </label>
              <input
                type="time"
                value={form.automacao_horario}
                onChange={(e) => setForm({ ...form, automacao_horario: e.target.value })}
                className="w-full bg-[#0a0a0d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
              <p className="text-[10px] text-slate-500 ml-1">O Vercel executa o cron a cada hora, então será enviado na hora mais próxima.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-end">
          <PillProgressButton
            label="Salvar Automação"
            loadingLabel="Salvando..."
            isLoading={loading}
            onClick={handleSave}
            icon={<Save className="w-4 h-4" />}
            variant="amber"
          />
        </div>
      </div>
    </div>
  );
}

