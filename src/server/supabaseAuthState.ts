import { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

const getSupabase = () => {
    if (!supabaseClient) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
        if (!supabaseUrl || !supabaseKey) {
            console.error("Supabase URL and Key must be defined to use Whatsapp sessions");
        }
        supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
    return supabaseClient;
};

const writeData = async (data: any, id: string) => {
    try {
        const supabase = getSupabase();
        const jsonStr = JSON.stringify(data, BufferJSON.replacer);
        const { error } = await supabase
            .from('whatsapp_sessions')
            .upsert({ id, data: jsonStr, updated_at: new Date().toISOString() });
        
        if (error) {
            console.error(`Erro ao salvar sessão ${id} no Supabase:`, error);
        }
    } catch (err) {
        console.error(`Erro ao escrever no Supabase (${id}):`, err);
    }
};

const readData = async (id: string) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('data')
            .eq('id', id)
            .single();

        if (error || !data) {
            return null;
        }

        return JSON.parse(data.data, BufferJSON.reviver);
    } catch (err) {
        console.error(`Erro ao ler do Supabase (${id}):`, err);
        return null;
    }
};

const removeData = async (id: string) => {
    try {
        const supabase = getSupabase();
        await supabase
            .from('whatsapp_sessions')
            .delete()
            .eq('id', id);
    } catch (err) {
        console.error(`Erro ao deletar do Supabase (${id}):`, err);
    }
};

/**
 * Adaptador customizado do Baileys para salvar a sessão no Supabase.
 * Ideal para persistir dados em ambientes Serverless como a Vercel.
 */
export const useSupabaseAuthState = async (): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
                    const data: { [id: string]: SignalDataTypeMap[T] } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value as SignalDataTypeMap[T];
                        })
                    );
                    return data;
                },
                set: async (data: any) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
};

export const clearSupabaseAuth = async () => {
    try {
        const supabase = getSupabase();
        // Remove todos os registros da tabela whatsapp_sessions
        const { error } = await supabase
            .from('whatsapp_sessions')
            .delete()
            .neq('id', 'avoid-empty-delete'); // Deleta todos

        if (error) {
            console.error("Erro ao limpar sessões:", error);
        }
    } catch (err) {
        console.error("Erro ao limpar Supabase:", err);
    }
};
