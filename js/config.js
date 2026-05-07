const SUPABASE_URL = 'https://vjckeuippxlisfsztwfu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_grGOqTa-sbe5djKkaJtSQQ_dBTk0TxQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
