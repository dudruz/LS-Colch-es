// =====================================================================
// Tour LS · motor do jogo: mapa da loja, personagem, colisão, câmera e controles
// =====================================================================
import { COR, R, L, novoCanvas, criarSprites, cama, bau, baseBox, mesa, balcao, bandeirolas, simboloLS, lua, CAMA, MESA } from './arte.js';

export const LARG = 180, ALT = 320;            // tela virtual
const ESQ = 6, DIR = 116;                       // colunas de exposição
const CORR = [64, 116];                         // corredor central
const VEL = 72;                                 // px por segundo
const ALCANCE = 15;                             // distância para interagir

export const ZONAS = { colchoes: 'Colchões', bases: 'Bases e baús', travesseiros: 'Travesseiros e acessórios', balcao: 'Balcão do Dudu', entrada: 'Entrada' };

/** Monta o mapa a partir dos produtos do painel. */
function construirMundo(produtos) {
  const por = (f) => produtos.filter(f);
  const colchoes = por((p) => p.categoria_slug === 'colchoes').sort((a, b) => (a.firmeza || 3) - (b.firmeza || 3) || a.preco_a_partir - b.preco_a_partir);
  const baus = por((p) => p.categoria_slug === 'box-bau');
  const bases = por((p) => ['bases', 'conjuntos-box'].includes(p.categoria_slug));
  const travs = por((p) => p.categoria_slug === 'travesseiros').concat(por((p) => p.categoria_slug === 'acessorios'));

  const itens = [], obst = [], zonas = [];
  let y = 120;
  const faixa = (nome, chave) => { zonas.push({ chave, nome, y0: y }); y += 10; };
  const fila = (lista, tipo, altLinha, prof) => {
    for (let i = 0; i < lista.length; i += 2) {
      [lista[i], lista[i + 1]].forEach((p, j) => {
        if (!p) return;
        const x = j === 0 ? ESQ : DIR;
        const lado = j === 0 ? 'E' : 'D';
        const it = { p, tipo, x, y, lado, aberto: 0, abrirAlvo: 0, rect: [x - 4, y - (tipo === 'bau' ? 4 : 5), x + CAMA.w + 4, y + prof] };
        itens.push(it); obst.push(it.rect);
      });
      y += altLinha;
    }
  };
  if (travs.length) { faixa(ZONAS.travesseiros, 'travesseiros'); fila(travs, 'mesa', MESA.d + MESA.f + 12, MESA.d + MESA.f); y += 6; }
  if (baus.length || bases.length) { faixa(ZONAS.bases, 'bases'); fila(baus.concat(bases), 'base', 46, CAMA.d + 10); y += 6; }
  if (colchoes.length) { faixa(ZONAS.colchoes, 'colchoes'); fila(colchoes, 'cama', 48, CAMA.d + CAMA.f); }
  zonas.push({ chave: 'entrada', nome: ZONAS.entrada, y0: y + 6 });
  const H = Math.max(y + 84, ALT);
  zonas.unshift({ chave: 'balcao', nome: ZONAS.balcao, y0: 0 });

  // paredes e balcão
  obst.push([0, 0, LARG, 99], [0, 0, 3, H], [LARG - 3, 0, LARG, H], [0, H - 12, LARG, H], [50, 70, 130, 112]);
  // totens da entrada
  obst.push([40, H - 52, 52, H - 40], [128, H - 52, 140, H - 40]);

  return { H, itens, obst, zonas, inicio: [90, H - 22], dudu: { x: 90, y: 92, rect: [56, 110, 124, 124] } };
}

function desenharEstatico(m) {
  const [cv, c] = novoCanvas(LARG, m.H);
  // piso porcelanato
  R(c, 0, 0, LARG, m.H, COR.porc);
  for (let y = 100; y < m.H; y += 22) L(c, 0, y, LARG, y, COR.porcEsc);
  for (let x = 2; x < LARG; x += 22) L(c, x, 100, x, m.H, COR.porcEsc);
  for (let y = 130; y < m.H; y += 70) { L(c, 76, y, 86, y, COR.porcClaro); L(c, 98, y + 30, 106, y + 30, COR.porcClaro); }
  // parede do fundo
  R(c, 0, 0, LARG, 99, COR.parede);
  R(c, 0, 0, LARG, 18, '#E8E8E6'); L(c, 0, 8, LARG, 8, COR.ink);
  for (let x = 14; x < LARG; x += 30) { R(c, x, 7, x + 3, 13, COR.ink); R(c, x + 1, 13, x + 2, 14, COR.ouroClaro); }
  R(c, 0, 96, LARG, 99, '#CECECC');
  bandeirolas(c, LARG, 20, 7);
  // quadros: logo e lua
  R(c, 6, 36, 46, 70, COR.navy, COR.ink); R(c, 8, 38, 44, 68, null, COR.ouro); simboloLS(c, 18, 44, 1);
  R(c, 134, 36, 174, 70, COR.navy, COR.ink); R(c, 136, 38, 172, 68, null, COR.ouro); lua(c, 154, 53, 9, COR.ouro, COR.navy);
  // faixas das zonas
  for (const z of m.zonas) {
    if (z.chave === 'balcao') continue;
    R(c, 3, z.y0 + 1, LARG - 4, z.y0 + 6, COR.navy); L(c, 3, z.y0, LARG - 4, z.y0, COR.ouro); L(c, 3, z.y0 + 7, LARG - 4, z.y0 + 7, COR.ouro);
  }
  // produtos
  for (const it of m.itens) {
    if (it.tipo === 'cama') cama(c, it.x, it.y, it.lado, it.p);
    else if (it.tipo === 'base') (it.p.categoria_slug === 'box-bau' ? bau : baseBox)(c, it.x, it.y, it.lado, it.p, 0);
    else mesa(c, it.x, it.y, [it.p, it.p]);
  }
  // entrada: vitrine vista de dentro, porta e capacho
  const H = m.H;
  R(c, 0, H - 12, LARG, H, '#A9C0CF', COR.ink);
  for (const x of [30, 60, 120, 150]) L(c, x, H - 12, x, H, COR.alu);
  R(c, 72, H - 12, 108, H, '#C4D6E2', COR.alu);
  R(c, 70, H - 30, 110, H - 16, '#3C4250', COR.ink); R(c, 73, H - 27, 107, H - 19, null, '#545C6C');
  for (const x of [40, 128]) { R(c, x, H - 76, x + 12, H - 40, COR.navy, COR.ink); R(c, x + 1, H - 75, x + 11, H - 72, COR.ouro); R(c, x + 1, H - 44, x + 11, H - 41, COR.ouro); simboloLS(c, x + 2, H - 66, 0.5); }
  // cantos
  R(c, 0, 99, 3, H, '#D2D3D6'); R(c, LARG - 4, 99, LARG, H, '#D2D3D6');
  return cv;
}

const dentro = (px, py, r) => px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3];
function distRect(px, py, r) {
  const dx = Math.max(r[0] - px, 0, px - r[2]); const dy = Math.max(r[1] - py, 0, py - r[3]);
  return Math.hypot(dx, dy);
}

export class Jogo {
  constructor(canvas, produtos, cb = {}) {
    this.cv = canvas; this.c = canvas.getContext('2d'); this.c.imageSmoothingEnabled = false;
    canvas.width = LARG; canvas.height = ALT;
    this.cb = cb;
    this.m = construirMundo(produtos);
    this.fundo = desenharEstatico(this.m);
    this.S = criarSprites();
    const [x, y] = this.m.inicio;
    this.pl = { x, y, dir: 'up', t: 0, anda: false, estado: 'livre' };
    this.cam = Math.max(0, this.m.H - ALT);
    this.teclas = new Set(); this.toque = { up: 0, down: 0, left: 0, right: 0 };
    this.pausado = true; this.feliz = false; this.alvo = null; this.zona = null;
    this.destaques = new Set(); this.festaAte = 0; this.t = 0;
    this._loop = this._loop.bind(this);
  }

  iniciar() { this.pausado = false; this.ultimo = performance.now(); requestAnimationFrame(this._loop); }
  pausar(v) { this.pausado = v; if (!v) { this.teclas.clear(); this._desde = {}; } }
  set humor(feliz) { this.feliz = feliz; }

  // ---------- controles ----------
  tecla(e, baixo) {
    const mapa = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    const d = mapa[e.code];
    if (d) { this._segurar(this.teclas, d, baixo, (x) => this.teclas.add(x), (x) => this.teclas.delete(x)); return true; }
    if (baixo && ['Space', 'Enter', 'KeyE'].includes(e.code)) { this.acao(); return true; }
    return false;
  }
  direcaoToque(d, v) { this._segurar(this.toque, d, v, (x) => { this.toque[x] = 1; }, (x) => { this.toque[x] = 0; }); }
  // um toque rápido ainda dá um passo: a direção fica ativa por pelo menos 160 ms
  _segurar(alvo, d, baixo, liga, desliga) {
    this._desde = this._desde || {};
    const k = (alvo === this.teclas ? 'k' : 't') + d;
    if (baixo) { if (!this._desde[k]) { this._desde[k] = performance.now(); liga(d); } return; }
    const passou = performance.now() - (this._desde[k] || 0);
    const soltar = () => { delete this._desde[k]; desliga(d); };
    if (passou < 160) setTimeout(soltar, 160 - passou); else soltar();
  }
  acao() {
    if (this.pausado || this.pl.estado !== 'livre') return;
    if (this.alvo) this.cb.interagir?.(this.alvo);
  }

  // ---------- ações chamadas pela interface ----------
  abrirBau(item, abrir) { item.abrirAlvo = abrir ? 1 : 0; }
  deitar(item, segundos = 2.4) {
    const pl = this.pl;
    pl.volta = { x: pl.x, y: pl.y, dir: pl.dir };
    pl.estado = 'deitado'; pl.cama = item; pl.ate = this.t + segundos;
    this.cb.som?.('pulo');
  }
  destacar(ids) { this.destaques = new Set(ids); }
  festa(seg = 3) { this.festaAte = this.t + seg; }
  irPara(item) { // leva a câmera até o produto (usado pela indicação do Dudu)
    this.cam = Math.max(-46, Math.min(this.m.H - ALT, item.y - 160));
  }

  // ---------- atualização ----------
  _loop(agora) {
    const dt = Math.min(0.05, (agora - this.ultimo) / 1000); this.ultimo = agora;
    if (!this.pausado) this._atualizar(dt);
    this._desenhar();
    requestAnimationFrame(this._loop);
  }
  _livre(x, y) {
    const caixa = [x - 7, y - 5, x + 7, y];
    return !this.m.obst.some((r) => caixa[0] < r[2] && caixa[2] > r[0] && caixa[1] < r[3] && caixa[3] > r[1]);
  }
  _atualizar(dt) {
    this.t += dt;
    const pl = this.pl;
    for (const it of this.m.itens) {
      if (it.aberto !== it.abrirAlvo) it.aberto = it.abrirAlvo > it.aberto ? Math.min(1, it.aberto + dt * 3) : Math.max(0, it.aberto - dt * 3);
    }
    if (pl.estado === 'deitado') {
      if (this.t >= pl.ate) {
        Object.assign(pl, pl.volta, { estado: 'livre' });
        this.cb.levantou?.(pl.cama);
      }
      return;
    }
    const k = this.teclas, tq = this.toque;
    let dx = (k.has('right') || tq.right ? 1 : 0) - (k.has('left') || tq.left ? 1 : 0);
    let dy = (k.has('down') || tq.down ? 1 : 0) - (k.has('up') || tq.up ? 1 : 0);
    pl.anda = !!(dx || dy);
    if (pl.anda) {
      if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
      pl.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const nx = pl.x + dx * VEL * dt, ny = pl.y + dy * VEL * dt;
      if (this._livre(nx, pl.y)) pl.x = nx;
      if (this._livre(pl.x, ny)) pl.y = ny;
      pl.t += dt;
    }
    // câmera suave
    const alvoCam = Math.max(-46, Math.min(this.m.H - ALT, pl.y - 196)); // -46: o HUD não cobre o balcão
    this.cam += (alvoCam - this.cam) * Math.min(1, dt * 8);
    // o que está perto para interagir
    let melhor = null, dMin = ALCANCE;
    for (const it of this.m.itens) {
      const d = distRect(pl.x, pl.y - 3, it.rect);
      if (d < dMin) { dMin = d; melhor = { tipo: 'produto', item: it, p: it.p }; }
    }
    if (distRect(pl.x, pl.y, this.m.dudu.rect) < 6) melhor = { tipo: 'dudu' };
    if ((melhor?.item || melhor?.tipo) !== (this.alvo?.item || this.alvo?.tipo)) { this.alvo = melhor; this.cb.alvo?.(melhor); }
    // zona atual
    const z = this.m.zonas.filter((zz) => pl.y >= zz.y0).pop() || this.m.zonas[0];
    if (z && z.chave !== this.zona) { this.zona = z.chave; this.cb.zona?.(z); }
  }

  // ---------- desenho ----------
  _desenhar() {
    const c = this.c, cam = Math.round(this.cam), t = this.t, pl = this.pl;
    c.fillStyle = '#E8E8E6'; c.fillRect(0, 0, LARG, ALT);
    c.drawImage(this.fundo, 0, -cam);
    c.save(); c.translate(0, -cam);
    for (const it of this.m.itens) if (it.aberto > 0) bau(c, it.x, it.y, it.lado, it.p, it.aberto);
    // Dudu atrás do balcão
    const pisca = (t % 4) > 3.85;
    c.drawImage(pisca ? this.S.duduPisca : this.S.dudu, 76, 44 + Math.round(Math.sin(t * 2) * 0.6));
    balcao(c, 50, 88, 130);
    // setas nos produtos indicados
    for (const it of this.m.itens) {
      if (!this.destaques.has(it.p.id)) continue;
      const ax = it.x + CAMA.w / 2, ay = it.y - 12 + Math.round(Math.sin(t * 6) * 2);
      c.fillStyle = COR.ink; c.beginPath(); c.moveTo(ax - 6, ay - 5); c.lineTo(ax + 6, ay - 5); c.lineTo(ax, ay + 3); c.closePath(); c.fill();
      c.fillStyle = COR.ouro; c.beginPath(); c.moveTo(ax - 4, ay - 4); c.lineTo(ax + 4, ay - 4); c.lineTo(ax, ay + 1); c.closePath(); c.fill();
    }
    // personagem
    const humor = this.feliz ? 'feliz' : 'sono';
    if (pl.estado === 'deitado') {
      const it = pl.cama, spr = it.lado === 'E' ? this.S.deitadoEsq : this.S.deitadoDir;
      c.drawImage(spr, it.x + (it.lado === 'E' ? 4 : 10), it.y);
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1;
        c.globalAlpha = 1 - ph; c.fillStyle = COR.navy2;
        const zx = it.x + 29 + ph * 14, zy = it.y - 2 - ph * 18;
        c.fillRect(zx, zy, 4, 1); c.fillRect(zx + 3 - 1, zy + 1, 1, 1); c.fillRect(zx + 1, zy + 2, 1, 1); c.fillRect(zx, zy + 3, 4, 1);
        c.globalAlpha = 1;
      }
    } else if (t < this.festaAte) {
      const f = this.S.festa[Math.floor(t * 6) % 2];
      c.drawImage(f, Math.round(pl.x - 14), Math.round(pl.y - 42 - Math.abs(Math.sin(t * 9)) * 5));
    } else {
      const s = this.S[humor];
      const quadro = pl.anda ? s[pl.dir][Math.floor(pl.t * 8) % 2] : s.parado[pl.dir];
      c.drawImage(quadro, Math.round(pl.x - 14), Math.round(pl.y - 42 + (pl.anda && Math.floor(pl.t * 8) % 2 ? -1 : 0)));
      // botão "A" sobre a cabeça quando dá para interagir
      if (this.alvo && !this.pausado) {
        const bx = Math.round(pl.x), by = Math.round(pl.y - 50 + Math.sin(t * 6));
        c.fillStyle = COR.ink; c.fillRect(bx - 5, by - 5, 11, 11);
        c.fillStyle = COR.ouro; c.fillRect(bx - 4, by - 4, 9, 9);
        c.fillStyle = COR.navy; // letra A em pixels
        c.fillRect(bx - 1, by - 2, 3, 1); c.fillRect(bx - 2, by - 1, 1, 4); c.fillRect(bx + 2, by - 1, 1, 4); c.fillRect(bx - 1, by + 1, 3, 1);
      }
    }
    c.restore();
    // confete da missão completa
    if (t < this.festaAte) {
      for (let i = 0; i < 40; i++) {
        const x = (i * 47 + 13) % LARG, sp = 60 + (i * 37) % 80;
        const y = ((i * 71 + (t * sp)) % (ALT + 20)) - 10;
        c.fillStyle = [COR.ouro, COR.ouroClaro, COR.royal][i % 3];
        c.fillRect(x, Math.round(y), (Math.floor(t * 10) + i) % 2 ? 2 : 1, 2);
      }
    }
  }
}
