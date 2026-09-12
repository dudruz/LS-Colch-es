// Configuração do banco de dados (Supabase) usado pelos Produtos, Promoções e Feedback.
// Sem preencher isso certinho, essas seções ficam vazias/com aviso no site.
//
// COMO PREENCHER — veja o passo a passo completo no README.txt
// Os dois valores ficam em: Project Settings → API, no painel do Supabase.

// 1) "Project URL" — sempre começa com https:// e termina em .supabase.co
//    Exemplo: "https://abcdefghijklmno.supabase.co"
//    NÃO é a chave, é o endereço do projeto.
const SUPABASE_URL = "https://llvmvdosautpzlmeggcr.supabase.co";

// 2) A chave pública do projeto. O Supabase pode chamar isso de duas
//    formas (as duas funcionam aqui, use a que aparecer no seu painel):
//    - chave antiga "anon public": um texto longo que começa com "eyJ..."
//    - chave nova "publishable key": começa com "sb_publishable_..."
//    NÃO é a Project URL, é a chave — não misture os dois campos.
const SUPABASE_ANON_KEY = "";

// Senha para entrar no painel (admin.html) — pode trocar quando quiser.
// Atenção: isso só afasta curiosos, não é uma segurança forte (veja o README).
const ADMIN_PASSWORD = "Bela2669";
