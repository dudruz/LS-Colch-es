// =====================================================================
// Tour LS · pixel art (sprites e objetos da loja), desenhada em código
// Coordenadas em pixels "virtuais" (a tela do jogo tem 180 px de largura).
// =====================================================================

export const COR = {
  ink: '#161826', navy: '#062A4F', navy2: '#003B73', noite: '#021A33',
  ouro: '#C9A65A', ouroClaro: '#E8D6A8', off: '#FAF8F2', branco: '#F7F7F5',
  royal: '#234AA6', royalClaro: '#5476C8', alu: '#B9BEC4',
  porc: '#DCDDE0', porcClaro: '#EAECEE', porcEsc: '#C8CACE',
  marrom: '#7A5442', marromEsc: '#604032', cinza: '#55565C', cinzaEsc: '#404146',
  madeira: '#D9C7A3', madeiraEsc: '#B79F78', parede: '#F7F7F5'
};

// ---------- utilitários de desenho (coordenadas inclusivas, como no PIL) ----------
export function R(c, x0, y0, x1, y1, fill, contorno) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  if (fill) { c.fillStyle = fill; c.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1); }
  if (contorno) {
    c.fillStyle = contorno;
    c.fillRect(x0, y0, x1 - x0 + 1, 1); c.fillRect(x0, y1, x1 - x0 + 1, 1);
    c.fillRect(x0, y0, 1, y1 - y0 + 1); c.fillRect(x1, y0, 1, y1 - y0 + 1);
  }
}
export function L(c, x0, y0, x1, y1, cor) { // linhas horizontais ou verticais
  R(c, Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), cor);
}
const P = (c, x, y, cor) => { c.fillStyle = cor; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
export function novoCanvas(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  return [cv, c];
}

// ---------- sprites a partir de grades de texto (mesmo desenho do vídeo) ----------
const LADO = [
  '...hhhhh....', '..hhhhhhh...', '..hhhhhhhh..', '..hhhsssss..', '..hhSsssss..', '..hhssssss..',
  '...sssssss..', '...ssssss...', '....sss.....', '...wwwwww...', '..wwwwwwww..', '..wwWwwwww..',
  '..wwWwwwww..', '..wwWwwwss..', '...pppppp...', '...pppppp...', '...pp..pp...', '...pp..pp...',
  '...pp..pp...', '...bbb.bbb..'
];
const LADO_B = ['...ppppp....', '..pp...pp...', '.pp.....pp..', '.bb.....bbb.'];
const FRENTE = [
  '....hhhh....', '..hhhhhhhh..', '..hhhhhhhh..', '..hssssssh..', '..ssssssss..', '..ssssssss..',
  '..ssssssss..', '...ssssss...', '....ssss....', '..wwwwwwww..', '.wwwwwwwwww.', '.wwwwwwwwww.',
  '.wwwWwwWwww.', '.s.wwwwww.s.', '...pppppp...', '...pppppp...', '...pp..pp...', '...pp..pp...',
  '...pp..pp...', '..bbb..bbb..'
];
const COSTAS = FRENTE.slice();
COSTAS[3] = '..hhhhhhhh..'; COSTAS[4] = '..hhhhhhhh..'; COSTAS[5] = '..hhhhhhhh..';
COSTAS[6] = '..shhhhhhs..'; COSTAS[7] = '...ssssss...';
const PERNA_A = ['...pp..pp...', '...bb..pp...', '.......bbb..'];
const PERNA_B = ['...pp..pp...', '...pp..bb...', '..bbb.......'];

const ROSTO = {
  ladoSono: [[4, 7, 'k'], [4, 8, 'k'], [5, 7, 'd'], [5, 8, 'd'], [7, 7, 'm']],
  ladoFeliz: [[3, 8, 'k'], [4, 8, 'k'], [6, 6, 'm'], [7, 7, 'm'], [6, 8, 'm']],
  frenteSono: [[5, 3, 'k'], [5, 4, 'k'], [5, 7, 'k'], [5, 8, 'k'], [6, 3, 'd'], [6, 8, 'd'], [7, 5, 'm'], [7, 6, 'm']],
  frenteFeliz: [[4, 4, 'k'], [5, 4, 'k'], [4, 7, 'k'], [5, 7, 'k'], [6, 3, 'm'], [7, 4, 'm'], [7, 5, 'm'], [7, 6, 'm'], [7, 7, 'm'], [6, 8, 'm']],
  frenteZen: [[5, 3, 'k'], [4, 4, 'k'], [5, 5, 'k'], [5, 6, 'k'], [4, 7, 'k'], [5, 8, 'k'], [7, 4, 'm'], [7, 5, 'm'], [7, 6, 'm'], [7, 7, 'm']]
};
const PAL_CLIENTE = { h: '#3B2A20', s: '#E8B48A', S: '#C98E66', w: '#8DB8DE', W: '#6A98C4', p: '#3A4A66', b: COR.ink, k: COR.ink, d: '#B98A78', m: '#8A4B3A', g: COR.ouro };
const PAL_DUDU = { ...PAL_CLIENTE, h: '#1E1E24', s: '#D9A27A', w: COR.navy2, W: COR.navy, p: '#2A2A35' };

function grade(linhas, pal, extras = [], pernas = null, iniPernas = 16, bracosCima = false) {
  const g = linhas.map((l) => l.split(''));
  if (pernas) pernas.forEach((l, i) => { g[iniPernas + i] = l.split(''); });
  if (bracosCima) {
    for (const y of [10, 11, 12, 13]) { g[y][0] = '.'; g[y][11] = '.'; }
    g[13][1] = 'w'; g[13][10] = 'w';
    for (const [y, x, ch] of [[9, 0, 'w'], [8, 0, 'w'], [7, 0, 's'], [6, 0, 's'], [9, 11, 'w'], [8, 11, 'w'], [7, 11, 's'], [6, 11, 's']]) g[y][x] = ch;
  }
  for (const [y, x, ch] of extras) g[y][x] = ch;
  const h = g.length, w = g[0].length;
  const [cv, c] = novoCanvas((w + 2) * 2, (h + 2) * 2);
  const cheio = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== '.';
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      let cor = null;
      if (cheio(x, y)) cor = pal[g[y][x]];
      else if (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1)) cor = COR.ink;
      if (cor) { c.fillStyle = cor; c.fillRect((x + 1) * 2, (y + 1) * 2, 2, 2); }
    }
  }
  return cv;
}
function espelhar(cv) {
  const [o, c] = novoCanvas(cv.width, cv.height);
  c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0); return o;
}
function girar(cv, horario) {
  const [o, c] = novoCanvas(cv.height, cv.width);
  if (horario) { c.translate(cv.height, 0); c.rotate(Math.PI / 2); } else { c.translate(0, cv.width); c.rotate(-Math.PI / 2); }
  c.drawImage(cv, 0, 0); return o;
}

/** Sprites do cliente (sono = antes de recuperar energia) e do Dudu. Todos com 28 x 44 px. */
export function criarSprites() {
  const S = {};
  for (const humor of ['sono', 'feliz']) {
    const lado = humor === 'sono' ? ROSTO.ladoSono : ROSTO.ladoFeliz;
    const frente = humor === 'sono' ? ROSTO.frenteSono : ROSTO.frenteFeliz;
    const dir = grade(LADO, PAL_CLIENTE, lado);
    const dirB = grade(LADO, PAL_CLIENTE, lado, LADO_B, 16);
    S[humor] = {
      right: [dir, dirB], left: [espelhar(dir), espelhar(dirB)],
      down: [grade(FRENTE, PAL_CLIENTE, frente, PERNA_A, 17), grade(FRENTE, PAL_CLIENTE, frente, PERNA_B, 17)],
      up: [grade(COSTAS, PAL_CLIENTE, [], PERNA_A, 17), grade(COSTAS, PAL_CLIENTE, [], PERNA_B, 17)],
      parado: { right: dir, left: espelhar(dir), down: grade(FRENTE, PAL_CLIENTE, frente), up: grade(COSTAS, PAL_CLIENTE) }
    };
  }
  const zen = grade(FRENTE, PAL_CLIENTE, ROSTO.frenteZen);
  S.deitadoEsq = girar(zen, false); // cabeça para a esquerda
  S.deitadoDir = girar(zen, true);  // cabeça para a direita
  S.festa = [grade(FRENTE, PAL_CLIENTE, ROSTO.frenteFeliz, null, 17, true), grade(FRENTE, PAL_CLIENTE, ROSTO.frenteFeliz, PERNA_B, 17, true)];
  S.dudu = grade(FRENTE, PAL_DUDU, [...ROSTO.frenteFeliz, [11, 7, 'g'], [11, 8, 'g']]);
  S.duduPisca = grade(FRENTE, PAL_DUDU, [[5, 3, 'k'], [5, 4, 'k'], [5, 7, 'k'], [5, 8, 'k'], [6, 3, 'm'], [7, 4, 'm'], [7, 5, 'm'], [7, 6, 'm'], [7, 7, 'm'], [6, 8, 'm'], [11, 7, 'g'], [11, 8, 'g']]);
  return S;
}

// ---------- cores dos produtos pelo nome ----------
export function corTecido(nome = '') {
  const n = nome.toLowerCase();
  if (n.includes('bege')) return ['#C9B08A', '#A88F6A'];
  if (n.includes('cinza')) return ['#8A8C92', '#6C6E74'];
  if (n.includes('marrom')) return ['#7A5442', '#604032'];
  if (n.includes('pret')) return ['#3C3C44', '#2A2A30'];
  if (n.includes('corino')) return ['#5A3E32', '#45302A'];
  return ['#9A8268', '#7E6852'];
}
function hash(s = '') { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

// ---------- objetos da loja (vista de cima) ----------
export const CAMA = { w: 58, d: 28, f: 8 };

/** Cama box com colchão. lado 'E' = cabeceira na parede esquerda. */
export function cama(c, x, y, lado, p) {
  const { w, d, f } = CAMA;
  const [base, baseEsc] = hash(p.nome) % 2 ? [COR.marrom, COR.marromEsc] : [COR.cinza, COR.cinzaEsc];
  const faixa = ['#C9D6E6', '#B0C4DA', '#E8D6A8', '#C9CBD0', '#AEB2BA'][(p.firmeza || 3) - 1] || '#C9CBD0';
  R(c, x + 2, y + d + f, x + w + 1, y + d + f + 2, COR.porcEsc);
  R(c, x, y + d, x + w, y + d + f, base, COR.ink);
  L(c, x + 1, y + d + 3, x + w - 1, y + d + 3, baseEsc);
  R(c, x, y, x + w, y + d, COR.branco, COR.ink);
  R(c, x + 1, y + d - 5, x + w - 1, y + d - 1, faixa);
  L(c, x + 1, y + d - 3, x + w - 1, y + d - 3, 'rgba(0,0,0,.12)');
  for (let yy = y + 4; yy < y + d - 6; yy += 5) for (let xx = x + 4 + ((yy / 5) % 2) * 2; xx < x + w - 2; xx += 5) P(c, xx, yy, '#D6D6D4');
  const xc = lado === 'E' ? x - 4 : x + w - 3;
  R(c, xc, y - 5, xc + 7, y + d + f, baseEsc, COR.ink);
  L(c, xc + 1, y - 4, xc + 6, y - 4, base);
  for (const py of [y + 3, y + 14]) {
    const px = lado === 'E' ? x + 7 : x + w - 16;
    R(c, px, py, px + 9, py + 9, '#FFFFFF', COR.ink);
  }
  etiqueta(c, lado === 'E' ? x + w - 12 : x + 4, y + d - 12);
}
function etiqueta(c, x, y) { R(c, x, y, x + 8, y + 5, '#FFFFFF', COR.ink); L(c, x + 1, y + 1, x + 7, y + 1, COR.royal); }

/** Base baú. aberto: 0 (fechado) → 1 (tampa erguida, mostrando o espaço de guardar). */
export function bau(c, x, y, lado, p, aberto = 0) {
  const { w, d } = CAMA; const f = 10;
  const [cor, esc] = corTecido(p.nome);
  R(c, x + 2, y + d + f, x + w + 1, y + d + f + 2, COR.porcEsc);
  R(c, x, y + d, x + w, y + d + f, esc, COR.ink);
  L(c, x + 2, y + d + 4, x + w - 2, y + d + 4, cor);
  R(c, x + 3, y + d + f + 1, x + 5, y + d + f + 2, COR.ink); R(c, x + w - 5, y + d + f + 1, x + w - 3, y + d + f + 2, COR.ink);
  if (aberto <= 0.02) {
    R(c, x, y, x + w, y + d, cor, COR.ink);
    R(c, x + 3, y + 3, x + w - 3, y + d - 3, null, esc);
    for (let i = x + 8; i < x + w - 6; i += 10) P(c, i, y + d / 2, esc);
    etiqueta(c, lado === 'E' ? x + w - 13 : x + 5, y + d - 11);
    return;
  }
  // espaço interno
  R(c, x, y, x + w, y + d, '#2B2620', COR.ink);
  R(c, x + 2, y + 2, x + w - 2, y + d - 2, '#3A332B');
  R(c, x + 6, y + 8, x + 30, y + 20, '#9FB6D6', COR.ink); L(c, x + 7, y + 12, x + 29, y + 12, '#7E98BE'); L(c, x + 7, y + 16, x + 29, y + 16, '#7E98BE');
  R(c, x + 34, y + 9, x + 50, y + 19, '#FFFFFF', COR.ink);
  // tampa subindo
  const sobe = Math.round(16 * aberto), alt = Math.round(d * (1 - 0.45 * aberto));
  const ty = y - sobe;
  L(c, x + 4, y + 4, x + 4, ty + alt, '#9AA0A8'); L(c, x + w - 4, y + 4, x + w - 4, ty + alt, '#9AA0A8');
  R(c, x - 1, ty, x + w + 1, ty + alt, cor, COR.ink);
  R(c, x + 2, ty + 2, x + w - 2, ty + alt - 2, null, esc);
  L(c, x, ty + alt - 1, x + w, ty + alt - 1, esc);
}

/** Base sommier sem colchão (mostra o tecido). */
export function baseBox(c, x, y, lado, p) {
  const { w, d } = CAMA; const f = 7;
  const [cor, esc] = corTecido(p.nome);
  R(c, x + 2, y + d + f, x + w + 1, y + d + f + 2, COR.porcEsc);
  R(c, x, y + d, x + w, y + d + f, esc, COR.ink);
  R(c, x, y + 4, x + w, y + d, cor, COR.ink);
  L(c, x + 2, y + 7, x + w - 2, y + 7, esc);
  for (let i = x + 6; i < x + w - 4; i += 7) P(c, i, y + 16, esc);
  etiqueta(c, lado === 'E' ? x + w - 13 : x + 5, y + d - 10);
}

export const MESA = { w: 58, d: 18, f: 6 };
/** Mesa de exposição com dois itens (travesseiros e acessórios). */
export function mesa(c, x, y, itens) {
  const { w, d, f } = MESA;
  R(c, x + 2, y + d + f, x + w + 1, y + d + f + 2, COR.porcEsc);
  R(c, x, y + d, x + w, y + d + f, COR.madeiraEsc, COR.ink);
  R(c, x, y, x + w, y + d, COR.madeira, COR.ink);
  itens.forEach((p, i) => { if (p) item(c, x + 3 + i * 28, y + 3, p); });
}
function item(c, x, y, p) {
  const n = (p.nome || '').toLowerCase();
  const tons = ['#FFFFFF', '#E3ECF7', '#F4ECDC', '#EDEFF2'];
  if (p.categoria_slug === 'travesseiros') {
    const cor = n.includes('visco') || n.includes('nuvem') ? '#E3ECF7' : tons[hash(p.nome) % tons.length];
    R(c, x + 1, y + 1, x + 22, y + 11, cor, COR.ink);
    L(c, x + 3, y + 3, x + 20, y + 3, '#FFFFFF'); L(c, x + 3, y + 9, x + 20, y + 9, 'rgba(0,0,0,.10)');
    if (n.includes('anat')) L(c, x + 4, y + 6, x + 19, y + 6, '#C9CED6');
    return;
  }
  if (n.includes('protetor')) { R(c, x + 2, y + 1, x + 21, y + 11, '#FFFFFF', COR.ink); R(c, x + 2, y + 1, x + 21, y + 3, COR.royal); return; }
  if (n.includes('alveol')) { R(c, x + 1, y + 1, x + 22, y + 11, '#9EA2A8', COR.ink); for (let i = x + 3; i < x + 21; i += 3) for (let j = y + 3; j < y + 10; j += 3) P(c, i, j, '#7E8288'); return; }
  if (n.includes('cabeceira')) { const [cor, esc] = corTecido(p.nome); R(c, x + 1, y, x + 22, y + 11, cor, COR.ink); for (let i = x + 5; i < x + 21; i += 5) L(c, i, y + 1, i, y + 10, esc); return; }
  if (n.includes('mochila') || n.includes('camping')) { R(c, x + 4, y + 2, x + 19, y + 11, '#2E5E3E', COR.ink); L(c, x + 4, y + 5, x + 19, y + 5, '#1E4029'); return; }
  if (n.includes('physical') || n.includes('colchonete')) { R(c, x + 1, y + 2, x + 22, y + 10, COR.royal, COR.ink); L(c, x + 2, y + 6, x + 21, y + 6, COR.royalClaro); return; }
  R(c, x + 3, y + 1, x + 20, y + 11, '#E9DFC9', COR.ink); L(c, x + 3, y + 5, x + 20, y + 5, COR.ouro);
}

/** Balcão do Dudu (a frente, desenhada por cima dele). */
export function balcao(c, x0, y, x1) {
  R(c, x0, y - 14, x1, y - 9, COR.branco, COR.ink);
  R(c, x0, y - 9, x1, y + 8, COR.navy, COR.ink);
  L(c, x0 + 1, y - 1, x1 - 1, y - 1, COR.ouro);
  R(c, x0 + 6, y - 23, x0 + 18, y - 15, COR.ink); R(c, x0 + 7, y - 22, x0 + 17, y - 16, '#7CA4CC'); R(c, x0 + 11, y - 15, x0 + 13, y - 14, COR.ink);
}

export function bandeirolas(c, w, y0, curva, sem = 0) {
  const pts = [];
  for (let x = -4; x < w + 6; x += 8) pts.push([x, y0 + curva * 4 * (x / w) * (1 - x / w)]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x, yy] = pts[i]; const y = Math.round(yy);
    L(c, x, y, x + 8, y, '#787C82');
    c.fillStyle = COR.ink; c.beginPath(); c.moveTo(x + 1, y); c.lineTo(x + 7, y); c.lineTo(x + 4, y + 9); c.closePath(); c.fill();
    c.fillStyle = (i + sem) % 5 === 2 ? COR.ouro : COR.royal; c.beginPath(); c.moveTo(x + 2, y + 1); c.lineTo(x + 6, y + 1); c.lineTo(x + 4, y + 7); c.closePath(); c.fill();
  }
}

/** Símbolo do logo em pixel (cabeceira azul, colchão creme, base dourada). */
export function simboloLS(c, x, y, k = 1) {
  const r = (a, b, cc, d, cor, ct) => R(c, x + a * k, y + b * k, x + cc * k + k - 1, y + d * k + k - 1, cor, ct);
  r(0, 2, 15, 16, COR.royal); r(1, 0, 14, 2, COR.royal);
  r(3, 5, 6, 7, COR.branco); r(9, 5, 12, 7, COR.branco);
  r(2, 10, 13, 13, '#F4ECD6'); r(-1, 17, 16, 19, COR.ouro);
}

export function lua(c, cx, cy, r, cor, fundo) {
  c.fillStyle = cor; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = fundo; c.beginPath(); c.arc(cx + r * 0.55, cy - 1, r, 0, Math.PI * 2); c.fill();
}
