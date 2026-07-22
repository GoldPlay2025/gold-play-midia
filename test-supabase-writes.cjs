require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("No config");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
supabase.from('whatsapp_sessions').select('id').limit(5).then(res => console.log("Rows in whatsapp_sessions:", res));
