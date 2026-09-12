function ready(fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn);
}

ready(() => {
  const loginView = document.querySelector("#login");
  const panelView = document.querySelector("#panel");
  const passwordInput = document.querySelector("#password-input");
  const loginButton = document.querySelector("#login-button");
  const loginError = document.querySelector("#login-error");
  const logoutButton = document.querySelector("#logout-button");
  const configWarning = document.querySelector("#config-warning");

  const prodNomeEl = document.querySelector("#prod-nome");
  const prodCategoriaEl = document.querySelector("#prod-categoria");
  const prodPrecoEl = document.querySelector("#prod-preco");
  const prodFotoEl = document.querySelector("#prod-foto");
  const prodAtivoEl = document.querySelector("#prod-ativo");
  const prodAddBtn = document.querySelector("#prod-add");
  const prodAddStatusEl = document.querySelector("#prod-add-status");
  const prodListEl = document.querySelector("#prod-list");

  const promoTituloEl = document.querySelector("#promo-titulo");
  const promoDescricaoEl = document.querySelector("#promo-descricao");
  const promoFotoEl = document.querySelector("#promo-foto");
  const promoPrecoAntigoEl = document.querySelector("#promo-preco-antigo");
  const promoPrecoNovoEl = document.querySelector("#promo-preco-novo");
  const promoAtivaEl = document.querySelector("#promo-ativa");
  const promoAddBtn = document.querySelector("#promo-add");
  const promoAddStatusEl = document.querySelector("#promo-add-status");
  const promoListEl = document.querySelector("#promo-list");
  const feedbackListEl = document.querySelector("#feedback-list");

  const supabaseUrlValida = typeof SUPABASE_URL !== "undefined" && /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL);
  const hasConfig = supabaseUrlValida && typeof SUPABASE_ANON_KEY !== "undefined" && SUPABASE_ANON_KEY;

  function headers(extra) {
    return Object.assign(
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      extra || {}
    );
  }

  function showPanel() {
    loginView.classList.add("hidden");
    panelView.classList.remove("hidden");
    if (!hasConfig) {
      configWarning.classList.remove("hidden");
      configWarning.querySelector("p").textContent =
        typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && !supabaseUrlValida
          ? "SUPABASE_URL em config.js não parece uma URL válida do Supabase (ela deve começar com https:// e terminar em .supabase.co). Confira se você não colou a chave no lugar da URL por engano — veja o README."
          : "O banco de dados ainda não foi configurado no arquivo config.js. Preencha SUPABASE_URL e SUPABASE_ANON_KEY para usar o painel — veja o README.";
      return;
    }
    loadProducts();
    loadPromotions();
    loadFeedbacks();
  }

  loginButton.addEventListener("click", () => {
    const pass = passwordInput.value;
    if (typeof ADMIN_PASSWORD !== "undefined" && pass === ADMIN_PASSWORD) {
      sessionStorage.setItem("ls_admin_ok", "1");
      showPanel();
    } else {
      loginError.textContent = "Senha incorreta.";
    }
  });

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loginButton.click();
  });

  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("ls_admin_ok");
    panelView.classList.add("hidden");
    loginView.classList.remove("hidden");
    passwordInput.value = "";
  });

  if (sessionStorage.getItem("ls_admin_ok") === "1") showPanel();

  /* ---------- Produtos ---------- */
  function parsePreco(text) {
    const n = Number(String(text).trim().replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }

  function formatPreco(value) {
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function uploadFoto(file, bucket = "produtos-fotos") {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    if (!response.ok) throw new Error("Falha ao enviar a foto");
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  }

  async function loadProducts() {
    prodListEl.innerHTML = `<p class="empty">Carregando...</p>`;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=*&order=categoria.asc,nome.asc`, {
        headers: headers(),
      });
      const data = await response.json();
      renderProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      prodListEl.innerHTML = `<p class="empty">Não foi possível carregar os produtos.</p>`;
    }
  }

  function renderProducts(items) {
    if (!items.length) {
      prodListEl.innerHTML = `<p class="empty">Nenhum produto cadastrado ainda.</p>`;
      return;
    }
    prodListEl.innerHTML = items
      .map(
        (p) => `<div class="item" data-id="${p.id}" data-foto="${p.foto_url || ""}">
          <div class="top" data-view>
            <div class="info">
              ${p.foto_url ? `<img class="thumb" src="${p.foto_url}" alt="">` : ""}
              <div><b>${p.nome || ""}</b><div>${p.categoria || ""} — ${formatPreco(p.preco || 0)}</div></div>
            </div>
            <span class="badge">${p.ativo ? "Visível" : "Oculto"}</span>
          </div>
          <div class="actions" data-view>
            <button class="ghost" data-action="edit-prod" data-id="${p.id}">Editar</button>
            <button class="ghost" data-action="toggle-prod" data-id="${p.id}" data-ativo="${p.ativo}">${p.ativo ? "Ocultar" : "Mostrar"}</button>
            <button class="danger" data-action="delete-prod" data-id="${p.id}">Excluir</button>
          </div>
        </div>`
      )
      .join("");
  }

  prodAddBtn.addEventListener("click", async () => {
    if (!hasConfig) {
      alert("O banco de dados (Supabase) ainda não está configurado corretamente em config.js. Veja o aviso no topo do painel e o README.");
      return;
    }
    const nome = prodNomeEl.value.trim();
    const categoria = prodCategoriaEl.value.trim();
    const preco = parsePreco(prodPrecoEl.value);
    const file = prodFotoEl.files[0];
    if (!nome || !categoria || !Number.isFinite(preco)) {
      alert("Preencha nome, categoria e um preço válido.");
      return;
    }
    prodAddBtn.disabled = true;
    try {
      let foto_url = null;
      if (file) {
        prodAddStatusEl.textContent = "Enviando foto...";
        foto_url = await uploadFoto(file);
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/produtos`, {
        method: "POST",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ nome, categoria, preco, foto_url, ativo: prodAtivoEl.checked }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message || `erro ${response.status} ao salvar na tabela produtos`);
      }
      prodNomeEl.value = "";
      prodCategoriaEl.value = "";
      prodPrecoEl.value = "";
      prodFotoEl.value = "";
      prodAtivoEl.checked = true;
      prodAddStatusEl.textContent = "";
      loadProducts();
    } catch (error) {
      prodAddStatusEl.textContent = "";
      alert(`Não foi possível salvar o produto: ${error.message}\n\nConfira se as tabelas e o bucket de fotos foram criados (rode o setup.sql) — veja o README.`);
    } finally {
      prodAddBtn.disabled = false;
    }
  });

  prodListEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    const itemEl = button.closest(".item");

    if (action === "toggle-prod") {
      const current = button.dataset.ativo === "true";
      await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${id}`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ ativo: !current }),
      });
      loadProducts();
    }

    if (action === "delete-prod") {
      if (!confirm("Excluir este produto?")) return;
      await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      loadProducts();
    }

    if (action === "edit-prod") {
      const nomeAtual = itemEl.querySelector(".top b").textContent;
      const [categoriaAtual, precoTexto] = itemEl.querySelector(".top .info > div:last-child > div").textContent.split(" — ");
      const fotoAtual = itemEl.dataset.foto || "";
      itemEl.querySelectorAll("[data-view]").forEach((el) => (el.style.display = "none"));
      const editRow = document.createElement("div");
      editRow.className = "editRow";
      editRow.innerHTML = `
        <input type="text" class="edit-nome" value="${nomeAtual}">
        <input type="text" class="edit-categoria" value="${categoriaAtual}">
        <input type="text" class="edit-preco" value="${precoTexto.replace(/[^\d,]/g, "")}">
        ${fotoAtual ? `<img class="thumb" src="${fotoAtual}" alt="">` : ""}
        <label>Trocar foto (opcional)<input type="file" class="edit-foto" accept="image/*"></label>
        <div class="actions">
          <button class="primary" data-action="save-prod" data-id="${id}">Salvar</button>
          <button class="ghost" data-action="cancel-prod" data-id="${id}">Cancelar</button>
        </div>`;
      itemEl.appendChild(editRow);
    }

    if (action === "cancel-prod") {
      loadProducts();
    }

    if (action === "save-prod") {
      const nome = itemEl.querySelector(".edit-nome").value.trim();
      const categoria = itemEl.querySelector(".edit-categoria").value.trim();
      const preco = parsePreco(itemEl.querySelector(".edit-preco").value);
      const file = itemEl.querySelector(".edit-foto").files[0];
      if (!nome || !categoria || !Number.isFinite(preco)) {
        alert("Preencha nome, categoria e um preço válido.");
        return;
      }
      button.disabled = true;
      try {
        const patch = { nome, categoria, preco };
        if (file) patch.foto_url = await uploadFoto(file);
        const response = await fetch(`${SUPABASE_URL}/rest/v1/produtos?id=eq.${id}`, {
          method: "PATCH",
          headers: headers({ Prefer: "return=minimal" }),
          body: JSON.stringify(patch),
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.message || `erro ${response.status} ao salvar na tabela produtos`);
        }
        loadProducts();
      } catch (error) {
        alert(`Não foi possível salvar: ${error.message}\n\nConfira se as tabelas e o bucket de fotos foram criados (rode o setup.sql) — veja o README.`);
        button.disabled = false;
      }
    }
  });

  /* ---------- Promoções ---------- */
  async function loadPromotions() {
    promoListEl.innerHTML = `<p class="empty">Carregando...</p>`;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/promocoes?select=*&order=criado_em.desc`, {
        headers: headers(),
      });
      const data = await response.json();
      renderPromotions(Array.isArray(data) ? data : []);
    } catch (error) {
      promoListEl.innerHTML = `<p class="empty">Não foi possível carregar as promoções.</p>`;
    }
  }

  function precoDestaque(p) {
    if (!p.preco_novo) return "";
    const antigo = p.preco_antigo ? `<s>${formatPreco(p.preco_antigo)}</s> ` : "";
    return `<div class="promoPrecos">${antigo}<b>${formatPreco(p.preco_novo)}</b></div>`;
  }

  function renderPromotions(promos) {
    if (!promos.length) {
      promoListEl.innerHTML = `<p class="empty">Nenhuma promoção cadastrada ainda.</p>`;
      return;
    }
    promoListEl.innerHTML = promos
      .map(
        (p) => `<div class="item" data-id="${p.id}" data-foto="${p.foto_url || ""}">
          <div class="top" data-view>
            <div class="info">
              ${p.foto_url ? `<img class="thumb" src="${p.foto_url}" alt="">` : ""}
              <div><b>${p.titulo || ""}</b><div>${p.descricao || ""}</div>${precoDestaque(p)}</div>
            </div>
            <span class="badge">${p.ativa ? "Ativa" : "Inativa"}</span>
          </div>
          <div class="actions" data-view>
            <button class="ghost" data-action="edit-promo" data-id="${p.id}">Editar</button>
            <button class="ghost" data-action="toggle" data-id="${p.id}" data-ativa="${p.ativa}">${p.ativa ? "Desativar" : "Ativar"}</button>
            <button class="danger" data-action="delete-promo" data-id="${p.id}">Excluir</button>
          </div>
        </div>`
      )
      .join("");
  }

  promoAddBtn.addEventListener("click", async () => {
    if (!hasConfig) {
      alert("O banco de dados (Supabase) ainda não está configurado corretamente em config.js. Veja o aviso no topo do painel e o README.");
      return;
    }
    const titulo = promoTituloEl.value.trim();
    const descricao = promoDescricaoEl.value.trim();
    const file = promoFotoEl.files[0];
    const precoAntigoTexto = promoPrecoAntigoEl.value.trim();
    const precoNovoTexto = promoPrecoNovoEl.value.trim();
    const preco_antigo = precoAntigoTexto ? parsePreco(precoAntigoTexto) : null;
    const preco_novo = precoNovoTexto ? parsePreco(precoNovoTexto) : null;
    if (!titulo || !descricao) {
      alert("Preencha ao menos o título e a descrição.");
      return;
    }
    if ((precoAntigoTexto && !Number.isFinite(preco_antigo)) || (precoNovoTexto && !Number.isFinite(preco_novo))) {
      alert("Preço antigo/novo inválido.");
      return;
    }
    promoAddBtn.disabled = true;
    try {
      let foto_url = null;
      if (file) {
        promoAddStatusEl.textContent = "Enviando foto...";
        foto_url = await uploadFoto(file);
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/promocoes`, {
        method: "POST",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ titulo, descricao, foto_url, preco_antigo, preco_novo, ativa: promoAtivaEl.checked }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message || `erro ${response.status} ao salvar na tabela promocoes`);
      }
      promoTituloEl.value = "";
      promoDescricaoEl.value = "";
      promoFotoEl.value = "";
      promoPrecoAntigoEl.value = "";
      promoPrecoNovoEl.value = "";
      promoAtivaEl.checked = true;
      promoAddStatusEl.textContent = "";
      loadPromotions();
    } catch (error) {
      promoAddStatusEl.textContent = "";
      alert(`Não foi possível salvar a promoção: ${error.message}\n\nConfira se rodou o setup.sql atualizado (com as colunas novas) — veja o README.`);
    } finally {
      promoAddBtn.disabled = false;
    }
  });

  promoListEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    const itemEl = button.closest(".item");

    if (action === "toggle") {
      const current = button.dataset.ativa === "true";
      await fetch(`${SUPABASE_URL}/rest/v1/promocoes?id=eq.${id}`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ ativa: !current }),
      });
      loadPromotions();
    }

    if (action === "delete-promo") {
      if (!confirm("Excluir esta promoção?")) return;
      await fetch(`${SUPABASE_URL}/rest/v1/promocoes?id=eq.${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      loadPromotions();
    }

    if (action === "edit-promo") {
      const tituloAtual = itemEl.querySelector(".top b").textContent;
      const descricaoAtual = itemEl.querySelector(".top .info > div:last-child > div").textContent;
      const fotoAtual = itemEl.dataset.foto || "";
      itemEl.querySelectorAll("[data-view]").forEach((el) => (el.style.display = "none"));
      const editRow = document.createElement("div");
      editRow.className = "editRow";
      editRow.innerHTML = `
        <input type="text" class="edit-titulo" value="${tituloAtual}">
        <textarea class="edit-descricao">${descricaoAtual}</textarea>
        <input type="text" class="edit-preco-antigo" placeholder="Preço antigo (opcional)">
        <input type="text" class="edit-preco-novo" placeholder="Preço novo (opcional)">
        ${fotoAtual ? `<img class="thumb" src="${fotoAtual}" alt="">` : ""}
        <label>Trocar foto (opcional)<input type="file" class="edit-foto" accept="image/*"></label>
        <div class="actions">
          <button class="primary" data-action="save-promo" data-id="${id}">Salvar</button>
          <button class="ghost" data-action="cancel-promo" data-id="${id}">Cancelar</button>
        </div>`;
      itemEl.appendChild(editRow);
    }

    if (action === "cancel-promo") {
      loadPromotions();
    }

    if (action === "save-promo") {
      const titulo = itemEl.querySelector(".edit-titulo").value.trim();
      const descricao = itemEl.querySelector(".edit-descricao").value.trim();
      const precoAntigoTexto = itemEl.querySelector(".edit-preco-antigo").value.trim();
      const precoNovoTexto = itemEl.querySelector(".edit-preco-novo").value.trim();
      const file = itemEl.querySelector(".edit-foto").files[0];
      if (!titulo || !descricao) {
        alert("Preencha ao menos o título e a descrição.");
        return;
      }
      button.disabled = true;
      try {
        const patch = {
          titulo,
          descricao,
          preco_antigo: precoAntigoTexto ? parsePreco(precoAntigoTexto) : null,
          preco_novo: precoNovoTexto ? parsePreco(precoNovoTexto) : null,
        };
        if (file) patch.foto_url = await uploadFoto(file);
        const response = await fetch(`${SUPABASE_URL}/rest/v1/promocoes?id=eq.${id}`, {
          method: "PATCH",
          headers: headers({ Prefer: "return=minimal" }),
          body: JSON.stringify(patch),
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          throw new Error(detail?.message || `erro ${response.status} ao salvar na tabela promocoes`);
        }
        loadPromotions();
      } catch (error) {
        alert(`Não foi possível salvar: ${error.message}`);
        button.disabled = false;
      }
    }
  });

  /* ---------- Feedbacks ---------- */
  async function loadFeedbacks() {
    feedbackListEl.innerHTML = `<p class="empty">Carregando...</p>`;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/feedbacks?select=*&order=criado_em.desc`, {
        headers: headers(),
      });
      const data = await response.json();
      renderFeedbacks(Array.isArray(data) ? data : []);
    } catch (error) {
      feedbackListEl.innerHTML = `<p class="empty">Não foi possível carregar as avaliações.</p>`;
    }
  }

  function renderFeedbacks(items) {
    if (!items.length) {
      feedbackListEl.innerHTML = `<p class="empty">Nenhuma avaliação recebida ainda.</p>`;
      return;
    }
    feedbackListEl.innerHTML = items
      .map(
        (f) => `<div class="item" data-id="${f.id}">
          <div class="top">
            <div><b>${f.nome || ""}</b><div class="stars">${"★".repeat(f.nota || 0)}${"☆".repeat(5 - (f.nota || 0))}</div><div>${f.mensagem || ""}</div></div>
            <span class="badge">${f.aprovado ? "Aprovado" : "Pendente"}</span>
          </div>
          <div class="actions">
            <button class="ghost" data-action="toggle-feedback" data-id="${f.id}" data-aprovado="${f.aprovado}">${f.aprovado ? "Remover do site" : "Aprovar e publicar"}</button>
            <button class="danger" data-action="delete-feedback" data-id="${f.id}">Excluir</button>
          </div>
        </div>`
      )
      .join("");
  }

  feedbackListEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;

    if (action === "toggle-feedback") {
      const current = button.dataset.aprovado === "true";
      await fetch(`${SUPABASE_URL}/rest/v1/feedbacks?id=eq.${id}`, {
        method: "PATCH",
        headers: headers({ Prefer: "return=minimal" }),
        body: JSON.stringify({ aprovado: !current }),
      });
      loadFeedbacks();
    }

    if (action === "delete-feedback") {
      if (!confirm("Excluir esta avaliação?")) return;
      await fetch(`${SUPABASE_URL}/rest/v1/feedbacks?id=eq.${id}`, {
        method: "DELETE",
        headers: headers(),
      });
      loadFeedbacks();
    }
  });
});
