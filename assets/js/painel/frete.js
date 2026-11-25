// Frete: distância da loja até o cliente (mapa gratuito), custo ida e volta por km e diluição no preço
// Regra do Dudu: o freteiro cobra R$ 2,00 por km rodado, ida e volta (LS -> BH 30 km: 60 km x 2 = R$ 120).
// Dentro de Lagoa Santa a entrega continua grátis de verdade (não soma nada no preço).

export const LOJA_COORD = { lat: -19.629, lon: -43.8998 }; // Av. Pref. João Daher, Lagoa Santa
export const VALOR_KM_PADRAO = 2;

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const ehLagoaSanta = (cidade) => semAcento(cidade).includes('lagoa santa');

/** Menor valor >= v que termina em 9,90 (ex.: 1.700 -> 1.709,90; 1.699,90 -> 1.699,90). */
export function arred990(v) {
  const c = Math.round(Number(v) * 100);
  if (c % 1000 === 990) return c / 100;
  return (Math.ceil((c - 990) / 1000) * 1000 + 990) / 100;
}

/** Custo do frete: km de ida x 2 (ida e volta) x valor do km. Lagoa Santa = 0. */
export function custoFrete(kmIda, valorKm = VALOR_KM_PADRAO, cidade = '') {
  if (ehLagoaSanta(cidade)) return 0;
  const km = Math.max(0, Number(kmIda) || 0);
  return Math.round(km * 2 * (Number(valorKm) || VALOR_KM_PADRAO) * 100) / 100;
}

/**
 * Dilui o frete nos itens, proporcional ao valor de cada um, arredondando cada preço unitário para 9,90.
 * itens: [{ preco, qtd }] -> devolve cópias com preco (novo), preco_base (original) e acrescimo.
 */
export function diluir(itens, frete) {
  const subtotal = itens.reduce((a, it) => a + it.preco * it.qtd, 0);
  if (!(frete > 0) || !(subtotal > 0)) return itens.map((it) => ({ ...it, preco_base: it.preco, acrescimo: 0 }));
  return itens.map((it) => {
    const parte = frete * (it.preco * it.qtd) / subtotal;
    const novo = arred990(it.preco + parte / it.qtd);
    return { ...it, preco_base: it.preco, preco: novo, acrescimo: Math.round((novo - it.preco) * it.qtd * 100) / 100 };
  });
}

async function json(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Serviço de mapa indisponível agora. Digite os km na mão.');
  return r.json();
}

/** Aceita CEP (8 dígitos) ou endereço/cidade. Devolve { lat, lon, cidade, rotulo }. */
export async function localizar(destino) {
  let busca = String(destino || '').trim();
  if (!busca) throw new Error('Digite o endereço, a cidade ou o CEP do cliente.');
  const cep = busca.replace(/\D/g, '');
  let cidadeCep = '';
  if (/^\d{8}$/.test(cep) && busca.replace(/[\d\s.-]/g, '') === '') {
    const v = await json(`https://viacep.com.br/ws/${cep}/json/`).catch(() => null);
    if (!v || v.erro) throw new Error('CEP não encontrado.');
    cidadeCep = v.localidade;
    busca = [v.logradouro, v.bairro, v.localidade, v.uf].filter(Boolean).join(', ');
  } else if (!/\b(mg|minas)\b/i.test(busca)) {
    busca += ', MG';
  }
  const tentar = async (q) => json(`${NOMINATIM}?format=jsonv2&countrycodes=br&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`);
  let r = await tentar(busca);
  // Se o endereço completo não for achado, tenta só bairro/cidade (fica um pouco menos preciso)
  if (!r.length && busca.includes(',')) r = await tentar(busca.split(',').slice(-3).join(','));
  if (!r.length) throw new Error('Não achei esse endereço no mapa. Tente só a cidade ou digite os km na mão.');
  const a = r[0].address || {};
  return {
    lat: Number(r[0].lat), lon: Number(r[0].lon),
    cidade: cidadeCep || a.city || a.town || a.village || a.municipality || '',
    rotulo: r[0].display_name
  };
}

/** Km de carro (só ida) da loja até o destino. Devolve { km, cidade, rotulo }. */
export async function distanciaKm(destino) {
  const d = await localizar(destino);
  const rt = await json(`${OSRM}/${LOJA_COORD.lon},${LOJA_COORD.lat};${d.lon},${d.lat}?overview=false`);
  const m = rt.routes?.[0]?.distance;
  if (!m) throw new Error('Não consegui traçar a rota. Digite os km na mão.');
  return { km: Math.round(m / 100) / 10, cidade: d.cidade, rotulo: d.rotulo };
}
