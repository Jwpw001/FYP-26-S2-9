const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL.replace("/rest/v1/", ""),
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabaseAdmin;
