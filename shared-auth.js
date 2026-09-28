(() => {
  const { createClient } = window.supabase;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let channel = null;
  let saveTimer = null;
  const authScreen = document.getElementById('authScreen');
  const appShell = document.getElementById('appShell');
  const form = document.getElementById('authForm');
  const errorEl = document.getElementById('authError');
  const logoutBtn = document.getElementById('logoutBtn');

  function showError(msg){ errorEl.textContent = msg || ''; }
  function showAuth(){ authScreen.classList.remove('hidden'); appShell.classList.add('hidden'); }
  function showApp(){ authScreen.classList.add('hidden'); appShell.classList.remove('hidden'); }

  async function loadSharedState(){
    const { data, error } = await client.from('ls_dashboard_state').select('data').eq('id','main').maybeSingle();
    if(error) throw error;
    if(data?.data) window.LS_INITIAL_DATA = data.data;
    else {
      window.LS_INITIAL_DATA = window.LS_INITIAL_DATA || {};
      const seed = window.LS_INITIAL_DATA;
      const { error: insertError } = await client.from('ls_dashboard_state').insert({id:'main', data:seed});
      if(insertError && insertError.code !== '23505') throw insertError;
    }
  }

  async function startRealtime(){
    if(channel) await client.removeChannel(channel);
    channel = client.channel('ls-dashboard-state')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'ls_dashboard_state',filter:'id=eq.main'},payload=>{
        if(payload.new?.data){
          window.LS_INITIAL_DATA = payload.new.data;
          window.dispatchEvent(new CustomEvent('ls:state',{detail:payload.new.data}));
        }
      })
      .subscribe();
  }

  window.LS_SHARED_SAVE = (state) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const cleanState = JSON.parse(JSON.stringify(state));
      const { error } = await client.from('ls_dashboard_state').upsert({id:'main',data:cleanState,updated_by:(await client.auth.getUser()).data.user?.id || null,updated_at:new Date().toISOString()});
      if(error) console.error('Falha ao salvar no Supabase:', error);
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
    try {
      showError('');
      await loadSharedState();
      showApp();
      if(!document.querySelector('script[data-dashboard-app]')){
        const s=document.createElement('script');
        s.src='app.js?v=6';
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