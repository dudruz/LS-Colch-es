// Configuração do Supabase (Project Settings → API).
// A "anon public key" pode ficar no código: ela é pública por natureza e o banco
// está protegido pelas regras de segurança (RLS). NUNCA coloque aqui a service_role key.
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'COLE-AQUI-A-ANON-PUBLIC-KEY';

// Fuso e país usados em datas e links de WhatsApp
export const FUSO = 'America/Sao_Paulo';
export const DDI = '55';

// Logo oficial da Ortobom (ex.: 'assets/img/ortobom.svg'). Vazio = mostra o nome em texto.
export const LOGO_ORTOBOM = '';

// Rastreamento para o tráfego pago. Deixe vazio até ter os IDs.
export const META_PIXEL_ID = '';
export const GA4_ID = '';
