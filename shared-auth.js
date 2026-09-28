(() => {
  const { createClient } = window.supabase;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let channel = null;
  let saveTimer = null;
  let lastServerUpdatedAt = null;
  let bootedSessionUser = null;
  const authScreen = document.getElementById('authScreen');
  const appShell = document.getElementById('appShell');
  const form = document.getElementById('authForm');
  const errorEl = document.getElementById('authError');
  const logoutBtn = document.getElementById('logoutBtn');

  function showError(msg){ errorEl.textContent = msg || ''; }
  function showAuth(){ authScreen.classList.remove('hidden'); appShell.classList.add('hidden'); }
  function showApp(){ authScreen.classList.add('hidden'); appShell.classList.remove('hidden'); }

  async function loadSharedState(){
    const { data, error } = await client.from('ls_dashboard_state').select('data,updated_at').eq('id','main').maybeSingle();
    if(error) throw error;
    if(data?.data) {
      const remote = JSON.parse(JSON.stringify(data.data));
      // Estados antigos não tinham versão. A partir daqui, toda gravação feita
      // pelo painel usa uma versão monotônica dentro do próprio JSON.
      if(!Number.isFinite(Number(remote._syncVersion))) remote._syncVersion = 1;
      window.LS_INITIAL_DATA = remote;
      lastServerUpdatedAt = data.updated_at || null;
    }
    else {
      window.LS_INITIAL_DATA = window.LS_INITIAL_DATA || {};
      window.LS_INITIAL_DATA._syncVersion = Number(window.LS_INITIAL_DATA._syncVersion) || 1;
      const seed = JSON.parse(JSON.stringify(window.LS_INITIAL_DATA));
      const { data: inserted, error: insertError } = await client.from('ls_dashboard_state').insert({id:'main', data:seed}).select('updated_at').maybeSingle();
      if(insertError && insertError.code !== '23505') throw insertError;
      if(inserted?.updated_at) lastServerUpdatedAt = inserted.updated_at;
    }
  }

  async function startRealtime(){
    if(channel) await client.removeChannel(channel);
    channel = client.channel('ls-dashboard-state')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ls_dashboard_state',filter:'id=eq.main'},payload=>{
        if(!payload.new?.data) return;
        const incoming = payload.new.data;
        const incomingVersion = Number(incoming._syncVersion || 0);
        const currentVersion = Number(window.LS_INITIAL_DATA?._syncVersion || 0);
        const incomingUpdatedAt = payload.new.updated_at || null;

        // Não aceita payload legado (sem versão) depois que o painel já está
        // carregado. Isso impede clientes antigos/cacheados de devolverem o
        // estado antigo e transformarem todas as vendas em FIT 33 novamente.
        if(currentVersion >= 1 && incomingVersion < 1) return;
        if(incomingVersion <= currentVersion) return;
        if(lastServerUpdatedAt && incomingUpdatedAt && incomingUpdatedAt <= lastServerUpdatedAt) return;

        lastServerUpdatedAt = incomingUpdatedAt || lastServerUpdatedAt;
        window.LS_INITIAL_DATA = JSON.parse(JSON.stringify(incoming));
        window.dispatchEvent(new CustomEvent('ls:state',{detail:window.LS_INITIAL_DATA, updatedAt:lastServerUpdatedAt}));
      })
      .subscribe();
  }

  window.LS_SHARED_SAVE = (state) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        // Busca a versão atual antes de gravar. Assim, uma aba antiga ou outro
        // usuário não consegue sobrescrever silenciosamente uma alteração nova.
        const { data: remote, error: readError } = await client.from('ls_dashboard_state').select('data,updated_at').eq('id','main').maybeSingle();
        if(readError) throw readError;

        const remoteVersion = Number(remote?.data?._syncVersion || 0);
        const localVersion = Number(window.LS_INITIAL_DATA?._syncVersion || 1);
        const localUpdatedAt = lastServerUpdatedAt;

        if(remote && ((localUpdatedAt && remote.updated_at && remote.updated_at !== localUpdatedAt) || remoteVersion > localVersion)) {
          console.warn('Estado remoto mudou antes deste salvamento; atualização local cancelada para evitar sobrescrita.');
          await loadSharedState();
          window.dispatchEvent(new CustomEvent('ls:state',{detail:window.LS_INITIAL_DATA, updatedAt:lastServerUpdatedAt, conflict:true}));
          return;
        }

        const cleanState = JSON.parse(JSON.stringify(state));
        const nextVersion = Math.max(localVersion, remoteVersion, 1) + 1;
        cleanState._syncVersion = nextVersion;
        const user = (await client.auth.getUser()).data.user;
        const newUpdatedAt = new Date().toISOString();
        let query = client.from('ls_dashboard_state').update({data:cleanState,updated_by:user?.id || null,updated_at:newUpdatedAt}).eq('id','main');
        if(localUpdatedAt) query = query.eq('updated_at',localUpdatedAt);
        const { data: saved, error } = await query.select('updated_at').maybeSingle();
        if(error) throw error;
        if(!saved){
          await loadSharedState();
          window.dispatchEvent(new CustomEvent('ls:state',{detail:window.LS_INITIAL_DATA, updatedAt:lastServerUpdatedAt, conflict:true}));
          return;
        }
        lastServerUpdatedAt = saved.updated_at || newUpdatedAt;
        window.LS_INITIAL_DATA = cleanState;
      } catch(e) {
        console.error('Falha ao salvar no Supabase:', e);
        alert('Não foi possível salvar a alteração. O estado remoto foi preservado.');
      }
    }, 250);
  };

  window.LS_UPLOAD_FILE = async (file) => {
    const user = (await client.auth.getUser()).data.user;
    if(!user) throw new Error('Sessão expirada. Entre novamente.');
    const ext=(file.name.split('.').pop()||'bin').toLowerCase();
    const path=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error } = await client.storage.from('ls-documentos').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(error) throw error;
    return {name:file.name,type:file.type,size:file.size,path};
  };

  window.LS_OPEN_FILE = async (file) => {
    if(!file?.path) {
      if(file?.url) window.open(file.url,'_blank','noopener');
      return;
    }
    const { data, error } = await client.storage.from('ls-documentos').createSignedUrl(file.path,3600);
    if(error) { alert('Não foi possível abrir o arquivo.'); return; }
    window.open(data.signedUrl,'_blank','noopener');
  };

  async function boot(session){
    if(!session){ showAuth(); return; }
    if(bootedSessionUser === session.user.id) return;
    bootedSessionUser = session.user.id;
    try {
      showError('');
      await loadSharedState();
      showApp();
      if(!document.querySelector('script[data-dashboard-app]')){
        const s=document.createElement('script');
        s.src='app.js?v=11';
        s.dataset.dashboardApp='1';
        document.body.appendChild(s);
      }
      await startRealtime();
    } catch(e) {
      console.error(e);
      showError('Não foi possível conectar ao banco. Confira o Supabase e o setup do painel.');
      showAuth();
    }
  }

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const email=document.getElementById('authEmail').value.trim();
    const password=document.getElementById('authPassword').value;
    showError('Entrando...');
    const { error } = await client.auth.signInWithPassword({email,password});
    if(error){ showError(error.message || 'E-mail ou senha inválidos.'); return; }
    document.getElementById('authPassword').value='';
  });

  logoutBtn.addEventListener('click', async ()=>{
    await client.auth.signOut();
    location.reload();
  });

  client.auth.onAuthStateChange((_event,session)=>boot(session));
  client.auth.getSession().then(({data})=>boot(data.session));
})();