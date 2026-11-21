// Supabase connection. The publishable key is meant to be public; the database rules in
// schema.sql (only the two allowed emails, and each person's own review rows) are what protect the data.
// Leave both empty to run in local-only mode (data stays on this device).
window.APP_CONFIG = {
  SUPABASE_URL: "https://jxvklhndrobcxiigwkko.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_FvU8WPC06PnyCPAKvcljWw_x-oTPZhk"
};
