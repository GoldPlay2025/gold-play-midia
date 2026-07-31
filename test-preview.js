import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const configData = { dias_antecedencia: 0 };
    const diasAntecedencia = configData && typeof configData.dias_antecedencia === 'number' ? configData.dias_antecedencia : 2;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + diasAntecedencia);
    const targetIsoDate = targetDate.toISOString().split('T')[0];
    
    console.log("Target ISO date:", targetIsoDate);

    const { data: allClients, error } = await supabase
      .from('clientes')
      .select('*');
      
    if (error) {
      console.error(error);
      return;
    }

    const clients = (allClients || []).filter(cli => {
      if (!cli.vencimento) return false;
      try {
        const cliVencStr = new Date(cli.vencimento).toISOString().split('T')[0];
        return cliVencStr === targetIsoDate;
      } catch (e) {
        return String(cli.vencimento).startsWith(targetIsoDate);
      }
    });
    
    console.log("Found:", clients.length);
    console.log("Clients:", clients.map(c => c.nome_empresa));
}
run();
