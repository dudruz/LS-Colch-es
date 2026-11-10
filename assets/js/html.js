// Montagem de HTML segura: tudo que entra em h`` é escapado, exceto raw()
class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s ?? ''));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));

export function h(partes, ...valores) {
  let s = partes[0];
  for (let i = 0; i < valores.length; i++) s += val(valores[i]) + partes[i + 1];
  return new Raw(s);
}

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/** Só deixa passar links http(s), relativos e âncoras */
export function urlSegura(u) {
  const s = String(u || '').trim();
  if (/^javascript:/i.test(s)) return '#';
  return /^(https?:\/\/|\/|\.\.?\/|#|[\w-]+\.html)/i.test(s) ? s : '#';
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// Ícones de traço (2 pt, cantos arredondados, como pede o brandbook)
const svg = (d, w = 20) => raw(`<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
export const ic = {
  zap: (w) => svg('<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2a8.5 8.5 0 1 1 15.6-4.7z"/><path d="M9.2 8.4h1.1l1 2.3-.9 1a6 6 0 0 0 2.8 2.8l1-.9 2.3 1v1.1c-1.8 1-4.6-.1-6.2-2s-2.4-4-1.1-5.3z"/>', w),
  seta: (w = 18) => raw(`<svg class="seta" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`),
  voltar: (w = 18) => svg('<path d="M19 12H5M11 6l-6 6 6 6"/>', w),
  pin: (w) => svg('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', w),
  relogio: (w) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', w),
  escudo: (w) => svg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>', w),
  caminhao: (w) => svg('<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>', w),
  cartao: (w) => svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>', w),
  chat: (w) => svg('<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>', w),
  medida: (w) => svg('<rect x="3" y="9" width="18" height="6" rx="1.5"/><path d="M7 9v3M11 9v2M15 9v3M19 9v2"/>', w),
  insta: (w) => svg('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>', w),
  camera: (w = 28) => svg('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', w),
  menu: (w) => svg('<path d="M4 7h16M4 12h16M4 17h10"/>', w),
  fechar: (w = 16) => svg('<path d="M6 6l12 12M18 6L6 18"/>', w),
  play: (w = 64) => raw(`<svg width="${w}" height="${w}" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="31" stroke="#E8D6A8" stroke-opacity=".6"/><path d="M27 22l15 10-15 10z" fill="#E8D6A8"/></svg>`)
};

/** Selo circular girando com a lua do brandbook */
export function selo(texto, id) {
  return raw(`<svg width="100%" height="100%" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="${id}" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs><circle cx="60" cy="60" r="57" fill="none" stroke="#C9A65A" stroke-opacity=".7"/><circle cx="60" cy="60" r="33" fill="none" stroke="#C9A65A" stroke-opacity=".4"/><text font-family="Montserrat, sans-serif" font-size="8.4" font-weight="600" letter-spacing="2.6" fill="#E8D6A8"><textPath href="#${id}">${esc(texto)}</textPath></text><circle cx="60" cy="60" r="14" fill="#C9A65A"/><circle cx="66" cy="55" r="12" fill="#062A4F"/></svg>`);
}
