const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL.replace("/rest/v1/", "");

// Use the anon key for user-facing auth operations (signInWithPassword)
const supabaseAuth = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);

module.exports = supabaseAuth;
