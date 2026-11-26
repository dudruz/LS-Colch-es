// =====================================================================
// Tour LS · trilha e efeitos em estilo chiptune (WebAudio, sem arquivos)
// =====================================================================
let ctx = null, mestre = null, musicaTimer = null, ligado = true;

const nota = (n) => { // 'C5' → Hz
  const m = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  return 440 * 2 ** ((m[n[0]] + (n.includes('#') ? 1 : 0) + (Number(n.at(-1)) - 4) * 12) / 12);
};

function iniciarAudio() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    mestre = ctx.createGain(); mestre.gain.value = ligado ? 0.5 : 0; mestre.connect(ctx.destination);
    return true;
  } catch { return false; }
}

function tom(freq, ini, dur, { tipo = 'square', vol = 0.12, ate = null } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, ini);
  if (ate) o.frequency.linearRampToValueAtTime(ate, ini + dur);
  g.gain.setValueAtTime(0.0001, ini);
  g.gain.exponentialRampToValueAtTime(vol, ini + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, ini + dur);
  o.connect(g); g.connect(mestre); o.start(ini); o.stop(ini + dur + 0.02);
}

const EFEITOS = {
  blip: (t) => tom(1200, t, 0.04, { vol: 0.06 }),
  abrir: (t) => tom(300, t, 0.25, { ate: 900, vol: 0.08 }),
  fechar: (t) => tom(800, t, 0.15, { ate: 300, vol: 0.06 }),
  pulo: (t) => tom(300, t, 0.3, { ate: 900, vol: 0.09 }),
  moeda: (t) => { tom(nota('B5'), t, 0.08, { vol: 0.1 }); tom(nota('E6'), t + 0.08, 0.35, { vol: 0.1 }); },
  ok: (t) => { tom(nota('E6'), t, 0.08, { vol: 0.09 }); tom(nota('A6'), t + 0.08, 0.15, { vol: 0.09 }); },
  festa: (t) => {
    ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tom(nota(n), t + i * 0.09, 0.1, { vol: 0.09 }));
    tom(nota('C7'), t + 0.54, 0.8, { vol: 0.08 }); tom(nota('C4'), t + 0.54, 0.8, { tipo: 'triangle', vol: 0.2 });
  }
};

export function efeito(nome) {
  if (!ligado || !iniciarAudio() || !EFEITOS[nome]) return;
  if (ctx.state === 'suspended') ctx.resume();
  EFEITOS[nome](ctx.currentTime + 0.01);
}

// tema principal (o mesmo do reels), em loop
const MEL = [['C5', 'E5', 'G5', 'E5', 'C6', null, 'G5', 'E5'], ['D5', 'G5', 'B5', 'G5', 'D6', null, 'B5', 'G5'],
  ['C5', 'E5', 'A5', 'E5', 'C6', null, 'A5', 'E5'], ['F5', 'A5', 'C6', 'A5', 'G5', null, 'E5', 'D5']];
const BAIXO = ['C3', 'G2', 'A2', 'F2'];
export function musica(tocar) {
  if (musicaTimer) { clearInterval(musicaTimer); musicaTimer = null; }
  if (!tocar || !ligado || !iniciarAudio()) return;
  if (ctx.state === 'suspended') ctx.resume();
  const passo = 0.22; let compasso = 0;
  const agenda = () => {
    const t0 = ctx.currentTime + 0.05;
    const m = MEL[compasso % 4], b = BAIXO[compasso % 4];
    for (let k = 0; k < 8; k++) {
      if (m[k]) tom(nota(m[k]), t0 + k * passo, passo * 0.85, { vol: 0.035, tipo: 'square' });
      tom(nota(k % 2 ? b[0] + (Number(b.at(-1)) + 1) : b), t0 + k * passo, passo * 0.8, { vol: 0.07, tipo: 'triangle' });
    }
    compasso++;
  };
  agenda(); musicaTimer = setInterval(agenda, passo * 8 * 1000);
}

export function somLigado(v) {
  if (v === undefined) return ligado;
  ligado = v;
  if (mestre) mestre.gain.value = v ? 0.5 : 0;
  if (!v) musica(false);
  try { localStorage.setItem('ls_tour_som', v ? '1' : '0'); } catch { /* sem armazenamento */ }
  return ligado;
}
try { ligado = localStorage.getItem('ls_tour_som') !== '0'; } catch { /* padrão: ligado */ }
