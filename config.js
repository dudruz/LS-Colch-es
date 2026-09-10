// Configuração do banco de dados (Supabase) usado pelas Promoções e pelo Feedback.
// Sem preencher isso, o site funciona normalmente, só que a seção de
// Promoções fica vazia e o formulário de Feedback mostra um aviso.
//
// COMO PREENCHER — veja o passo a passo completo no README.txt
const SUPABASE_URL = "https://llvmvdosautpzlmeggcr.supabase.co"; // ex: "https://xxxxxxxxxxxx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsdm12ZG9zYXV0cHpsbWVnZ2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjk0MDMsImV4cCI6MjEwNDY0NTQwM30.0_kEtB0W6_wAeOrWAnJRZDNBD_uHZW0lzPan-OjKQOU"; // a "anon public key" do seu projeto Supabase

// Senha para entrar no painel (admin.html) — pode trocar quando quiser.
// Atenção: isso só afasta curiosos, não é uma segurança forte (veja o README).
const ADMIN_PASSWORD = "Bela2669";
