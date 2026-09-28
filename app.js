(() => {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const clean = s => String(s ?? '').trim().replace(/\s+/g, ' ');
  const norm = s => clean(s).toLowerCase();
  const fmt = v => brl.format(Number(v) || 0);
  let chart = null;
  const FILE_LIMIT = 8 * 1024 * 1024;
  const categoryOrder = ['Colchões','Base','Cabeceira','Travesseiro','Acessórios'];
  const canonicalCategory = v => { const n=norm(v); if(n.includes('cabeceira')) return 'Cabeceira'; if(n.includes('travesseiro')) return 'Travesseiro'; if(n.includes('base')) return 'Base'; if(n.includes('acess')) return 'Acessórios'; if(n.includes('colch')||n.includes('mola')||n.includes('espuma')||n.includes('orthofort')||n.includes('ortho')) return 'Colchões'; return 'Acessórios'; };
  const fileToData = async file => {
    if(!file) return null;
    if(file.size>FILE_LIMIT) throw new Error('Arquivo maior que 8 MB.');
    if(window.LS_UPLOAD_FILE){
      return await window.LS_UPLOAD_FILE(file);
    }
    return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve({name:file.name,type:file.type,size:file.size,data:r.result}); r.onerror=reject; r.readAsDataURL(file); });
  };
  const downloadFile = f => {
    if(!f) return;
    if(window.LS_OPEN_FILE){ window.LS_OPEN_FILE(f); return; }
    if(f.url){ window.open(f.url,'_blank','noopener'); return; }
    if(f.data){ const a=document.createElement('a'); a.href=f.data; a.download=f.name||'arquivo'; a.click(); }
  };
  const sellerRate = name => Number(state.commissions?.[name] ?? 0) / 100;
  const saleCost = s => (s.items||[]).reduce((a,i)=>{const p=productByName(i.product); return a + Number(i.qty||0)*Number(p?.cost||0);},0);
  const saleCommission = s => saleReceived(s) * sellerRate(s.seller);
  const saleProfit = s => saleReceived(s) - saleCost(s) - saleCommission(s);

  const defaultMethods = ['PIX', 'Débito', ...Array.from({length:12}, (_,i)=>`Crédito ${i+1}x`)];
  function reportPaymentName(method) {
    const n = norm(method).replace(/\s+/g,'');
    if (n === 'debito' || n === 'débito') return 'Débito';
    if (n.includes('pix')) return 'PIX';
    if (n.includes('cartao') || n.includes('cartão') || n.includes('credito') || n.includes('crédito')) return 'Crédito';
    return clean(method) || 'Outros';
  }
  function normalizePayment(p) { return { method: clean(p?.method || 'PIX'), amount: Number(p?.amount) || 0 }; }
  function dedupeProducts(list) {
    const seen = new Set(); const out = [];
    list.map(normalizeProduct).forEach(p => {
      const key = [norm(p.name), norm(p.size), norm(p.height), Number(p.cost||0).toFixed(2), norm(p.type), norm(p.category)].join('|');
      if (seen.has(key)) return;
      seen.add(key); out.push(p);
    });
    return out;
  }

  function normalizeProduct(p, i=0) {
    const size = p.size || inferSize(p.name);
    const reportName = p.reportName || p.report || p.name;
    return {
      id: Number(p.id) || i + 1,
      name: clean(p.name || `Produto ${i+1}`),
      reportName: clean(reportName),
      type: p.type || 'Outro', size, height: p.height ?? '',
      category: canonicalCategory(p.category || p.originalCategory || ''), description: p.description || '',
      initial: Number(p.initial ?? p.stock ?? 0) || 0,
      min: Number(p.min ?? 0) || 0, cost: Number(p.cost ?? 0) || 0,
      margin: Number(p.margin ?? 0) || 0, promo: p.promo || '',
      originalCategory: p.originalCategory || p.category || ''
    };
  }

  function inferSize(name) {
    const n = norm(name);
    if (n.includes('king') || n.includes('1930') || n.includes('2030')) return 'king';
    if (n.includes('queen') || n.includes('1580') || n.includes('1590')) return 'queen';
    if (n.includes('viúvo') || n.includes('viuvo') || n.includes('1080')) return 'viúvo';
    if (n.includes('casal') || n.includes('1380') || n.includes('1400')) return 'casal';
    if (n.includes('solteiro') || n.includes('0880') || n.includes('880')) return 'solteiro';
    return '';
  }

  function migrateSales(rows) {
    if (!Array.isArray(rows)) return [];
    // V2 stored one row per item. Group rows with the same sale id/client/date/seller into one order.
    const map = new Map();
    rows.forEach((r, idx) => {
      const id = Number(r.id) || idx + 1;
      const key = `${id}|${r.date || ''}|${norm(r.client)}|${norm(r.seller)}`;
      if (!map.has(key)) {
        map.set(key, {
          id, date: r.date || new Date().toISOString().slice(0,10),
          seller: clean(r.seller), client: clean(r.client), customerId: '',
          customer: {}, items: [], payment: [], received: 0, notes: r.notes || '', attachment: r.attachment || null
        });
      }
      const o = map.get(key);
      o.items.push({ product: clean(r.product), qty: Number(r.qty) || 1, unit: Number(r.unit) || 0 });
      (r.payment || []).forEach(p => o.payment.push(normalizePayment(p)));
      if (!r.payment?.length && r.received != null) o.payment.push({method: r.legacyPayment || 'Pix', amount: Number(r.received) || 0});
      o.received += Number(r.received) || 0;
    });
    return [...map.values()].map(o => {
      // If legacy rows repeated the same payment in each item, payment values are still intentionally summed;
      // imported source data has per-item received values, which is what we want for the historical total.
      o.total = o.items.reduce((a, x) => a + x.qty * x.unit, 0);
      if (!o.received) o.received = o.payment.reduce((a,p)=>a+p.amount,0);
      return o;
    });
  }

  const initial = window.LS_INITIAL_DATA || {};
  const state = {
    products: dedupeProducts(initial.products || []),
    sales: migrateSales(initial.sales || []),
    clients: Array.isArray(initial.clients) ? initial.clients : [],
    sellers: Array.from(new Set(['Dudu', 'LOJA', ...(initial.sellers || []), ...(initial.sales || []).map(s=>s.seller).filter(Boolean)])),
    paymentMethods: [...defaultMethods],
    invoices: Array.isArray(initial.invoices) ? initial.invoices : [],
    commissions: initial.commissions || {}
  };

  function load() {
    const x = window.LS_INITIAL_DATA || {};
    if (Array.isArray(x.products)) state.products = dedupeProducts(x.products);
    if (Array.isArray(x.sales)) state.sales = migrateSales(x.sales);
    if (Array.isArray(x.clients)) state.clients = x.clients;
    if (Array.isArray(x.sellers)) state.sellers = x.sellers;
    state.paymentMethods = [...defaultMethods];
    state.invoices = Array.isArray(x.invoices) ? x.invoices : [];
    state.commissions = x.commissions || {};
  }
  function save() {
    if (window.LS_SHARED_SAVE) window.LS_SHARED_SAVE(state);
  }

  function dimensionsFromName(name){
    const n=norm(name).replace(/,/g,'.');
    let m=n.match(/(\d{3,4})[x×](\d{3,4})[x×](\d{3,4})/);
    if(!m) m=n.match(/(\d{2,4})[x×](\d{2,4})[x×](\d{2,4})/);
    if(!m) return null;
    const a=[Number(m[1]),Number(m[2]),Number(m[3])];
    const cm=a.map(v=>v>=100?v/100:v);
    const height=cm[0]; const long=Math.max(cm[1],cm[2]); const width=Math.min(cm[1],cm[2]);
    let size=''; if(width<=90) size='solteiro'; else if(width<=145) size='casal'; else if(width<=175) size='queen'; else if(width>=185) size='king';
    return {height,size};
  }
  function baseProductName(name){ return norm(name).replace(/\s*(?:[-–—]\s*R\$?\s*[\d.,]+|(?:\d{2,4}[x×]\d{2,4}[x×]\d{2,4})|\d{2,3}x\d{2,3}x\d{1,3})\s*$/i,'').trim(); }
  function productByName(name) {
    const raw = clean(name);
    if (!raw) return undefined;
    const exact=state.products.find(p => norm(p.name) === norm(raw)); if(exact) return exact;
    const d=dimensionsFromName(raw), base=baseProductName(raw);
    const candidates=state.products.filter(p=>{const pn=baseProductName(p.name);return pn===base || base.includes(pn) || pn.includes(base);});
    if(d){ const same=candidates.find(p=>norm(p.size)===d.size && Number(p.height||0)===Number(d.height)); if(same)return same; const bySize=candidates.find(p=>norm(p.size)===d.size); if(bySize)return bySize; }
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  // O nome salvo na venda é a fonte de verdade. Se o produto não casar com o
  // cadastro atual, preservamos o texto original em vez de cair no primeiro produto.
  function reportName(name) { const raw=clean(name); return raw || 'Produto não informado'; }
  function canonicalProduct(name) { const raw=clean(name); if(!raw) return ''; return productByName(raw)?.name || raw; }
  function saleTotal(s) { return Number(s.total ?? (s.items || []).reduce((a,i)=>a+Number(i.qty||0)*Number(i.unit||0),0)) || 0; }
  function saleReceived(s) { return Number(s.received ?? (s.payment||[]).reduce((a,p)=>a+Number(p.amount||0),0)) || 0; }
  function itemQty(s) { return (s.items || []).reduce((a,i)=>a+Number(i.qty||0),0); }
  function periodDates() { const p=$('#period').value,t=new Date();t.setHours(23,59,59,999);let s=new Date(t);if(p==='month')s=new Date(t.getFullYear(),t.getMonth(),1);if(p==='last30')s.setDate(t.getDate()-29);if(p==='all')s=new Date('2000-01-01');return[s,t]; }
  function inPeriod(d) { const [a,b]=periodDates(),x=new Date((d||'2000-01-01')+'T12:00:00');return x>=a&&x<=b; }
  function salesPeriod() { return state.sales.filter(s=>inPeriod(s.date)); }
  function soldMap() { const m={};state.sales.forEach(s=>(s.items||[]).forEach(i=>{const n=canonicalProduct(i.product);m[n]=(m[n]||0)+Number(i.qty||0);}));return m; }
  function productState(p) { const sold=soldMap()[p.name]||0; return {...p,sold,current:Number(p.initial||0)-sold,price:Number(p.cost||0)*(1+Number(p.margin||0))}; }
  function paymentText(s) { return (s.payment||[]).map(p=>`${p.method} ${fmt(p.amount)}`).join(' + '); }
  function itemText(s) { return (s.items||[]).map(i=>`${reportName(i.product)} (${i.qty}x)`).join(' • '); }

  function renderKpis(){const ss=salesPeriod(),rev=ss.reduce((a,s)=>a+saleReceived(s),0),orders=ss.length,avg=orders?rev/orders:0,c=state.products.map(productState).filter(p=>p.current<p.min).length;$('#kpis').innerHTML=[['Faturamento',fmt(rev),'Recebido no período'],['Vendas',orders,'Pedidos'],['Ticket médio',fmt(avg),'Por venda'],['Reposição',c,'Produtos abaixo do mínimo']].map(x=>`<div class="card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join('');}
  function renderChart(){const canvas=$('#salesChart');if(!canvas)return;const m={};salesPeriod().forEach(s=>m[s.date]=(m[s.date]||0)+saleReceived(s));const l=Object.keys(m).sort();if(typeof Chart==='undefined'){canvas.parentElement.insertAdjacentHTML('beforeend',`<div class="muted">Faturamento no período: ${fmt(l.reduce((a,x)=>a+m[x],0))}</div>`);return}if(chart)chart.destroy();chart=new Chart(canvas,{type:'line',data:{labels:l.map(x=>new Date(x+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})),datasets:[{label:'Recebido',data:l.map(x=>m[x]),tension:.35,fill:true}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>fmt(v)}}}}});}
  function renderStockSummary(){const ps=state.products.map(productState),c=ps.filter(p=>p.current<p.min),z=ps.filter(p=>p.current<=0);$('#stockSummary').innerHTML=[['Produtos',ps.length],['Abaixo do mínimo',c.length],['Sem estoque',z.length],['Custo em estoque',fmt(ps.reduce((a,p)=>a+Math.max(0,p.current)*p.cost,0))]].map(x=>`<div class="row"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');}
  function renderTop(){const m={};salesPeriod().forEach(s=>(s.items||[]).forEach(i=>{const n=reportName(i.product);m[n]=(m[n]||0)+Number(i.qty||0)*Number(i.unit||0);}));const a=Object.entries(m).sort((x,y)=>y[1]-x[1]).slice(0,6),max=a[0]?.[1]||1;$('#topProducts').innerHTML=a.length?a.map(([n,v])=>`<div class="bar"><div class="bar-top"><span>${n}</span><b>${fmt(v)}</b></div><div class="track"><div class="fill" style="width:${v/max*100}%"></div></div></div>`).join(''):'<span class="muted">Sem vendas.</span>';}
  function renderSellers(){const m={};salesPeriod().forEach(s=>m[s.seller]=(m[s.seller]||0)+saleReceived(s));$('#sellerSummary').innerHTML=Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<div class="row"><span>${n}</span><b>${fmt(v)}</b></div>`).join('')||'<span class="muted">Sem vendas.</span>';}

  function renderSales(){
    const q=norm($('#saleSearch').value),sf=$('#sellerFilter').value,pf=$('#paymentFilter').value;
    const a=state.sales.filter(s=>(!q||[s.client,s.seller,s.notes,itemText(s)].some(x=>norm(x).includes(q)))&&(!sf||s.seller===sf)&&(!pf||(s.payment||[]).some(x=>x.method===pf)));
    $('#saleCount').textContent=`${a.length} vendas`;
    $('#salesTable').innerHTML=a.slice().reverse().map(s=>`<tr><td>#${s.id}</td><td>${new Date(s.date+'T12:00:00').toLocaleDateString('pt-BR')}</td><td><b>${s.client||'—'}</b><br><small>${s.customer?.phone||''}</small></td><td>${s.seller}</td><td class="wrap-cell">${itemText(s)}</td><td>${itemQty(s)}</td><td class="wrap-cell">${paymentText(s)}</td><td>${fmt(saleReceived(s))}</td><td>${s.attachment?`<button class="table-btn" data-sale-file="${s.id}">Abrir</button>`:'—'}</td><td class="actions"><button class="table-btn edit-sale" data-id="${s.id}">Editar</button><button class="table-btn danger delete-sale" data-id="${s.id}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="10" class="muted">Nenhuma venda encontrada.</td></tr>';
  }

  function renderStock(){const f=$('#stockFilter').value,a=state.products.map(productState).filter(p=>!f||(f==='critical'?p.current<p.min:p.current>=p.min));$('#stockTable').innerHTML=a.map(p=>`<tr><td>${p.name}</td><td>${p.category}</td><td><input class="stock-input" data-id="${p.id}" type="number" min="0" step="1" value="${p.current}"></td><td>${p.min}</td><td>${fmt(p.cost)}</td><td><span class="status ${p.current<p.min?'bad':'ok'}">${p.current<p.min?'REPOR':'OK'}</span></td><td><button class="table-btn" data-min="${p.id}">Definir mínimo</button></td></tr>`).join('');const ps=state.products.map(productState),c=ps.filter(p=>p.current<p.min).length;$('#stockKpis').innerHTML=[['Produtos',ps.length,''],['Abaixo do mínimo',c,''],['Custo em estoque',fmt(ps.reduce((a,p)=>a+Math.max(0,p.current)*p.cost,0)),''],['Valor potencial',fmt(ps.reduce((a,p)=>a+Math.max(0,p.current)*p.price,0)),'']].map(x=>`<div class="card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join('');}
  function renderProducts(){const q=norm($('#productSearch').value),cat=$('#categoryFilter').value,a=state.products.filter(p=>(!q||[p.name,p.reportName,p.description].some(x=>norm(x).includes(q)))&&(!cat||p.category===cat));$('#productsTable').innerHTML=a.map(p=>`<tr><td><b>${p.name}</b><br><small>Relatório: ${p.reportName}</small></td><td>${p.size||'—'}</td><td>${p.type||'—'}</td><td>${p.height?p.height+' cm':'—'}</td><td>${p.category}</td><td>${fmt(p.cost)}</td><td>${productState(p).current}</td><td><button class="table-btn edit-product" data-id="${p.id}">Editar</button></td></tr>`).join('');}
  function renderReports(){
    const ss=salesPeriod(),rev=ss.reduce((a,s)=>a+saleReceived(s),0),orders=ss.length,qty=ss.reduce((a,s)=>a+itemQty(s),0),avg=orders?rev/orders:0;
    $('#reportText').innerHTML=`<h2>Resumo comercial</h2><p>No período selecionado: <span class="metric">${fmt(rev)}</span> recebidos, <span class="metric">${orders}</span> venda(s), <span class="metric">${qty}</span> item(ns) e ticket médio de <span class="metric">${fmt(avg)}</span>.</p>`;
    const pm={},cm={};ss.forEach(s=>{(s.payment||[]).forEach(p=>{const k=reportPaymentName(p.method);pm[k]=(pm[k]||0)+Number(p.amount||0);});(s.items||[]).forEach(i=>{const cat=canonicalCategory(productByName(i.product)?.category||'');cm[cat]=(cm[cat]||0)+Number(i.qty||0)*Number(i.unit||0);});});
    $('#paymentSummary').innerHTML=Object.entries(pm).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<div class="row"><span>${n}</span><b>${fmt(v)}</b></div>`).join('')||'<span class="muted">Sem dados.</span>';
    $('#categorySummary').innerHTML=categoryOrder.map(n=>[n,cm[n]||0]).map(([n,v])=>`<div class="row"><span>${n}</span><b>${fmt(v)}</b></div>`).join('');
    const prod={},sizes={},matt={};ss.forEach(s=>(s.items||[]).forEach(i=>{const p=productByName(i.product),q=Number(i.qty||0);prod[reportName(i.product)]=(prod[reportName(i.product)]||0)+q;if(p?.size)sizes[p.size]=(sizes[p.size]||0)+q;if(canonicalCategory(p?.category||'')==='Colchões')matt[reportName(i.product)]=(matt[reportName(i.product)]||0)+q;}));
    const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,v])=>`<div class="row"><span>${n}</span><b>${v} un.</b></div>`).join('')||'<span class="muted">Sem dados.</span>';
    $('#analyticsProduct').innerHTML=top(prod);$('#analyticsSize').innerHTML=top(sizes);$('#analyticsMattress').innerHTML=top(matt);
  }
  function renderFinancial(){
    const ss=salesPeriod(), revenue=ss.reduce((a,s)=>a+saleReceived(s),0),cost=ss.reduce((a,s)=>a+saleCost(s),0),comm=ss.reduce((a,s)=>a+saleCommission(s),0),profit=revenue-cost-comm;
    $('#financialKpis').innerHTML=[['Faturamento',fmt(revenue),'Recebido'],['Custo dos produtos',fmt(cost),'Custo estimado'],['Comissões',fmt(comm),'Vendedores'],['Lucro líquido',fmt(profit),'Após custo + comissão']].map(x=>`<div class="card"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join('');
    const names=Array.from(new Set([...state.sellers,...ss.map(s=>s.seller).filter(Boolean)])).sort();
    $('#commissionTable').innerHTML=names.map(n=>{const a=ss.filter(s=>s.seller===n),r=a.reduce((x,s)=>x+saleReceived(s),0),c=a.reduce((x,s)=>x+saleCommission(s),0);return `<tr><td><b>${n}</b></td><td><input class="commission-input" data-seller="${escapeHtml(n)}" type="number" min="0" max="100" step="0.1" value="${Number(state.commissions?.[n]||0)}">%</td><td>${a.length}</td><td>${fmt(r)}</td><td>${fmt(c)}</td></tr>`}).join('')||'<tr><td colspan="5" class="muted">Sem vendas.</td></tr>';
    $('#profitTable').innerHTML=ss.slice().reverse().map(s=>`<tr><td>#${s.id}</td><td>${s.seller||'—'}</td><td>${fmt(saleReceived(s))}</td><td>${fmt(saleCost(s))}</td><td>${fmt(saleCommission(s))}</td><td><b>${fmt(saleProfit(s))}</b></td></tr>`).join('')||'<tr><td colspan="6" class="muted">Sem vendas.</td></tr>';
  }
  function renderInvoices(){ $('#invoiceTable').innerHTML=(state.invoices||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map((x,i)=>`<tr><td>${new Date(x.date+'T12:00:00').toLocaleDateString('pt-BR')}</td><td>${escapeHtml(x.description)}</td><td>${escapeHtml(x.file?.name||'—')}</td><td class="actions"><button class="table-btn" data-invoice-file="${i}">Abrir</button><button class="table-btn danger" data-invoice-del="${i}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="4" class="muted">Nenhuma nota fiscal cadastrada.</td></tr>'; }

  function refresh(){renderKpis();renderChart();renderStockSummary();renderTop();renderSellers();renderSales();renderStock();renderProducts();renderReports();renderFinancial();renderInvoices();}

  function filters(){
    const sellers=Array.from(new Set([...state.sellers,...state.sales.map(s=>s.seller).filter(Boolean)])).sort();
    state.sellers=sellers;
    const cats=[...new Set(state.products.map(p=>p.category).filter(Boolean))].sort();
    const pm=[...new Set(state.paymentMethods||[])];
    $('#sellerFilter').innerHTML='<option value="">Todos os vendedores</option>'+sellers.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
    $('#saleSeller').innerHTML=sellers.map(x=>`<option>${escapeHtml(x)}</option>`).join('');
    $('#saleClientSelect').innerHTML=clientOptions();
    $('#paymentFilter').innerHTML='<option value="">Todos os pagamentos</option>'+pm.map(x=>`<option>${x}</option>`).join('');
    $('#categoryFilter').innerHTML='<option value="">Todas as categorias</option>'+cats.map(x=>`<option>${x}</option>`).join('');
  }

  function customerForSale(name){ return state.clients.find(c=>norm(c.name)===norm(name)); }
  function fillCustomer(name){const c=customerForSale(name);if(!c)return;const f=$('#saleForm');['phone','email','cpf','address','neighborhood','city','customerNotes'].forEach(k=>{if(f.elements[k])f.elements[k].value=c[k]||'';});}
  function clientOptions(selected=''){return '<option value="">Novo cliente / digite abaixo</option>'+state.clients.map(c=>`<option value="${escapeHtml(c.name)}" ${c.name===selected?'selected':''}>${escapeHtml(c.name)}${c.phone?' — '+escapeHtml(c.phone):''}</option>`).join('');}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

  function resetSaleForm(){
    const f=$('#saleForm');f.reset();f.elements.id.value='';f.elements.date.value=new Date().toISOString().slice(0,10);f.elements.seller.value=state.sellers[0]||'Dudu';f.elements.client.value='';
    $('#saleItems').innerHTML=''; addSaleItem(); $('#paymentRows').innerHTML=''; addPaymentRow('Pix',''); $('#saleModalTitle').textContent='Nova venda';
  }
  function addSaleItem(item={product:state.products[0]?.name||'',qty:1,unit:null}){
    const d=document.createElement('div');d.className='sale-item-row';
    const price=item.unit ?? (()=>{const p=productByName(item.product);return p?(p.cost*(1+p.margin)).toFixed(2):''})();
    const savedProduct=clean(item.product);
    const hasExact=state.products.some(p=>norm(p.name)===norm(savedProduct));
    const legacyOption=savedProduct && !hasExact ? `<option value="${escapeHtml(savedProduct)}" selected>${escapeHtml(savedProduct)}</option>` : '';
    d.innerHTML=`<select class="item-product">${legacyOption}${state.products.map(p=>`<option value="${escapeHtml(p.name)}" ${p.name===savedProduct?'selected':''}>${escapeHtml(p.name)}${p.size?' — '+escapeHtml(p.size):''}${p.height?' — '+escapeHtml(p.height)+' cm':''}</option>`).join('')}</select><input class="item-qty" type="number" min="1" step="1" value="${item.qty||1}"><input class="item-unit" type="number" min="0" step="0.01" value="${price}"><button type="button" title="Remover item">×</button>`;
    d.querySelector('.item-product').onchange=e=>{const p=productByName(e.target.value);d.querySelector('.item-unit').value=p?(p.cost*(1+p.margin)).toFixed(2):'';updateSaleTotal();};
    d.querySelectorAll('input').forEach(x=>x.oninput=updateSaleTotal);d.querySelector('button').onclick=()=>{d.remove();updateSaleTotal();};$('#saleItems').appendChild(d);updateSaleTotal();
  }
  function addPaymentRow(method='Pix',amount=''){const d=document.createElement('div');d.className='payment-row';d.innerHTML=`<select class="pay-method">${state.paymentMethods.map(x=>`<option ${x===method?'selected':''}>${escapeHtml(x)}</option>`).join('')}</select><input class="pay-amount" type="number" min="0" step=".01" placeholder="R$" value="${amount}"><button type="button">×</button>`;d.querySelector('button').onclick=()=>{d.remove();updatePaymentTotal()};d.querySelector('.pay-amount').oninput=updatePaymentTotal;$('#paymentRows').appendChild(d);updatePaymentTotal();}
  function updateSaleTotal(){const total=[...$$('.item-unit')].reduce((a,x,i)=>a+Number(x.value||0)*Number($$('.item-qty')[i]?.value||0),0);$('#saleTotal').textContent=fmt(total);updatePaymentTotal(total);}
  function updatePaymentTotal(total){const t=total ?? [...document.querySelectorAll('.pay-amount')].reduce((a,x)=>a+Number(x.value||0),0);const paid=[...document.querySelectorAll('.pay-amount')].reduce((a,x)=>a+Number(x.value||0),0);$('#paymentTotal').textContent=fmt(paid);$('#paymentDifference').textContent=fmt(t-paid);$('#paymentDifference').className=Math.abs(t-paid)<.01?'good-text':'bad-text';}

  function openSale(s=null){
    const f=$('#saleForm');f.reset();f.elements.id.value=s?.id||'';f.elements.date.value=s?.date||new Date().toISOString().slice(0,10);f.elements.seller.value=s?.seller||state.sellers[0]||'Dudu';f.elements.client.value=s?.client||'';
    if(s?.customer){['phone','email','cpf','address','neighborhood','city','customerNotes'].forEach(k=>{if(f.elements[k])f.elements[k].value=s.customer[k]||'';});}
    $('#saleItems').innerHTML='';(s?.items?.length?s.items:[{product:state.products[0]?.name||'',qty:1,unit:null}]).forEach(addSaleItem);
    $('#paymentRows').innerHTML='';(s?.payment?.length?s.payment:[{method:'Pix',amount:''}]).forEach(p=>addPaymentRow(p.method,p.amount));
    window._saleAttachment=s?.attachment||null;$('#saleAttachment').value='';$('#saleAttachmentInfo').textContent=window._saleAttachment?`Arquivo atual: ${window._saleAttachment.name}`:'';$('#saleModalTitle').textContent=s?'Editar venda #'+s.id:'Nova venda';$('#saleModal').classList.add('show');updateSaleTotal();
  }

  function collectSale(){
    const f=new FormData($('#saleForm'));const items=[...$$('.sale-item-row')].map(r=>({product:clean(r.querySelector('.item-product').value),qty:Number(r.querySelector('.item-qty').value||0),unit:Number(r.querySelector('.item-unit').value||0)})).filter(i=>i.qty>0);
    const payment=[...$$('.payment-row')].map(r=>normalizePayment({method:r.querySelector('.pay-method').value,amount:Number(r.querySelector('.pay-amount').value||0)})).filter(p=>p.amount>0);
    const total=items.reduce((a,i)=>a+i.qty*i.unit,0),received=payment.reduce((a,p)=>a+p.amount,0);return {f,items,payment,total,received};
  }

  function upsertClient(f){
    const name=clean(f.get('client'));if(!name)return '';
    const data={name,phone:clean(f.get('phone')),email:clean(f.get('email')),cpf:clean(f.get('cpf')),address:clean(f.get('address')),neighborhood:clean(f.get('neighborhood')),city:clean(f.get('city')),notes:clean(f.get('customerNotes'))};
    let c=state.clients.find(x=>norm(x.name)===norm(name));if(c)Object.assign(c,data);else{c={id:Date.now(),...data};state.clients.push(c);}return c.id;
  }

  async function saveSale(e){
    e.preventDefault();const {f,items,payment,total,received}=collectSale();
    if(!items.length){alert('Adicione pelo menos um item à venda.');return;}
    if(!payment.length||Math.abs(received-total)>0.01){alert(`O pagamento precisa fechar com o total da venda.\\nTotal: ${fmt(total)}\\nRecebido: ${fmt(received)}`);return;}
    let attachment=window._saleAttachment||null; try { const file=$('#saleAttachment')?.files?.[0]; if(file) attachment=await fileToData(file); } catch(err){ alert(err.message); return; }
    const id=f.get('id')?Number(f.get('id')):Math.max(0,...state.sales.map(s=>Number(s.id)||0))+1;
    const customerId=upsertClient(f);const customer={name:clean(f.get('client')),phone:clean(f.get('phone')),email:clean(f.get('email')),cpf:clean(f.get('cpf')),address:clean(f.get('address')),neighborhood:clean(f.get('neighborhood')),city:clean(f.get('city')),notes:clean(f.get('customerNotes'))};
    const obj={id,date:f.get('date'),seller:clean(f.get('seller')),client:clean(f.get('client')),customerId,customer,items,payment,received,total,notes:clean(f.get('notes')),attachment};
    const i=state.sales.findIndex(s=>Number(s.id)===id);if(i>=0)state.sales[i]=obj;else state.sales.push(obj);
    if(!state.sellers.includes(obj.seller))state.sellers.push(obj.seller);save();filters();refresh();$('#saleModal').classList.remove('show');alert(i>=0?'Venda atualizada.':'Venda registrada.');
  }

  function openProduct(p=null){$('#productModalTitle').textContent=p?'Editar produto':'Novo produto';const f=$('#productForm');f.reset();f.elements.id.value=p?.id||'';if(p)Object.keys(p).forEach(k=>{if(f.elements[k])f.elements[k].value=p[k]??''});$('#productModal').classList.add('show');}
  function saveProduct(e){e.preventDefault();const f=new FormData(e.target);const obj={id:f.get('id')?Number(f.get('id')):Math.max(0,...state.products.map(x=>Number(x.id)||0))+1,name:clean(f.get('name')),reportName:clean(f.get('reportName'))||clean(f.get('name')),type:f.get('type'),size:f.get('size'),height:f.get('height'),category:f.get('category'),description:f.get('description'),initial:Number(f.get('initial')||0),min:Number(f.get('min')||0),cost:Number(f.get('cost')||0),margin:Number(f.get('margin')||0)/100,promo:f.get('promo'),originalCategory:f.get('category')};const i=state.products.findIndex(x=>x.id===obj.id);if(i>=0)state.products[i]=obj;else state.products.push(obj);save();filters();refresh();$('#productModal').classList.remove('show');alert('Produto salvo.');}

  function bind(){
    $$('.nav').forEach(b=>b.onclick=()=>{$$('.nav').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view).classList.add('active');$('#pageTitle').textContent=b.textContent;refresh();});
    $('#period').onchange=refresh;
    ['#saleSearch','#sellerFilter','#paymentFilter','#stockFilter','#productSearch','#categoryFilter'].forEach(s=>$(s).addEventListener('input',refresh));
    $('#newSale').onclick=()=>openSale();$('#addSaleItem').onclick=()=>addSaleItem();$('#addPayment').onclick=()=>addPaymentRow();
    $('#saleForm').onsubmit=saveSale; $('#saleAttachment').onchange=()=>{const f=$('#saleAttachment').files[0]; if(f) $('#saleAttachmentInfo').textContent=`Novo arquivo: ${f.name}`;};
    $('#saleClientSelect').innerHTML=clientOptions();
    $('#saleClientSelect').onchange=e=>{if(e.target.value){$('#saleForm').client.value=e.target.value;fillCustomer(e.target.value);}};
    $('#saleForm').client.onblur=e=>fillCustomer(e.target.value);
    $('#newProduct').onclick=()=>openProduct();$('#productForm').onsubmit=saveProduct;
    $('#productsTable').onclick=e=>{const b=e.target.closest('.edit-product');if(b)openProduct(state.products.find(x=>x.id==b.dataset.id));};
    $('#salesTable').onclick=e=>{const edit=e.target.closest('.edit-sale'),del=e.target.closest('.delete-sale');if(edit)openSale(state.sales.find(s=>Number(s.id)===Number(edit.dataset.id)));if(del){const s=state.sales.find(x=>Number(x.id)===Number(del.dataset.id));if(s&&confirm(`Excluir a venda #${s.id} de ${s.client}?\nEssa ação não pode ser desfeita.`)){state.sales=state.sales.filter(x=>Number(x.id)!==Number(s.id));save();filters();refresh();}}};
    $('#salesTable').addEventListener('click',e=>{const b=e.target.closest('[data-sale-file]');if(b){const s=state.sales.find(x=>Number(x.id)===Number(b.dataset.saleFile));if(s?.attachment)downloadFile(s.attachment);}});
    $('#stockTable').addEventListener('change',e=>{if(e.target.classList.contains('stock-input')){const id=Number(e.target.dataset.id),p=state.products.find(x=>x.id===id);if(p){const sold=soldMap()[p.name]||0;p.initial=Number(e.target.value)+sold;save();refresh();}}});
    $('#stockTable').addEventListener('click',e=>{const b=e.target.closest('[data-min]');if(b){const p=state.products.find(x=>x.id==b.dataset.min);const v=prompt('Novo estoque mínimo:',p.min);if(v!==null&&!isNaN(v)){p.min=Number(v);save();refresh();}}});
    $('#commissionTable').addEventListener('change',e=>{if(e.target.classList.contains('commission-input')){const seller=e.target.dataset.seller;state.commissions[seller]=Number(e.target.value||0);save();renderFinancial();}});
    $('#newInvoice').onclick=()=>{$('#invoiceForm').reset();$('#invoiceForm').elements.date.value=new Date().toISOString().slice(0,10);$('#invoiceModal').classList.add('show');};
    $('#invoiceForm').onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.target),file=await fileToData($('#invoiceFile').files[0]);state.invoices.push({id:Date.now(),date:f.get('date'),description:clean(f.get('description')),file});save();renderInvoices();$('#invoiceModal').classList.remove('show');alert('Nota fiscal salva.');}catch(err){alert(err.message);}};
    $('#invoiceTable').onclick=e=>{const b=e.target.closest('[data-invoice-file]'),d=e.target.closest('[data-invoice-del]');if(b){const x=state.invoices.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[Number(b.dataset.invoiceFile)];if(x)downloadFile(x.file);}if(d){const x=state.invoices.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[Number(d.dataset.invoiceDel)];if(x&&confirm('Excluir esta nota fiscal?')){state.invoices=state.invoices.filter(v=>v.id!==x.id);save();renderInvoices();}}};
    $$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.remove('show'));
    $('#exportBtn').onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='ls-colchoes-backup.json';a.click();};
    $('#importBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=e=>{const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);state.sales=migrateSales(x.sales||[]);state.products=dedupeProducts(x.products||[]);state.clients=x.clients||[];state.sellers=x.sellers||state.sellers;state.paymentMethods=[...defaultMethods];state.invoices=x.invoices||[];state.commissions=x.commissions||{};save();filters();refresh();alert('Backup importado.');}catch{alert('Arquivo inválido.');}};if(e.target.files[0])r.readAsText(e.target.files[0]);};
  }

  load();
  filters();
  bind();
  refresh();

  window.addEventListener('ls:state', event => {
    const x = event.detail || {};
    if (Array.isArray(x.products)) state.products = dedupeProducts(x.products);
    if (Array.isArray(x.sales)) state.sales = migrateSales(x.sales);
    if (Array.isArray(x.clients)) state.clients = x.clients;
    if (Array.isArray(x.sellers)) state.sellers = x.sellers;
    state.paymentMethods = [...defaultMethods];
    state.invoices = Array.isArray(x.invoices) ? x.invoices : [];
    state.commissions = x.commissions || {};
    filters();
    refresh();
  });
})();
