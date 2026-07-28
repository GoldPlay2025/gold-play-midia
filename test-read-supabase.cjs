require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Supabase config missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
supabase.from('whatsapp_sessions').select('id, updated_at').limit(10).then(({ data, error }) => {
  if (error) console.error("Error:", error);
  else console.log("Sessions:", data);
});
