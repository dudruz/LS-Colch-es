document.querySelectorAll(".faqList article").forEach((article) => {
  const button = article.querySelector("button");
  const icon = button.querySelector("i");

  button.addEventListener("click", () => {
    const shouldOpen = !article.classList.contains("open");

    document.querySelectorAll(".faqList article").forEach((item) => {
      item.classList.remove("open");
      item.querySelector("button").setAttribute("aria-expanded", "false");
      item.querySelector("button i").textContent = "+";
    });

    if (shouldOpen) {
      article.classList.add("open");
      button.setAttribute("aria-expanded", "true");
      icon.textContent = "−";
    }
  });
});

const menuButton = document.querySelector(".menuButton");
const nav = document.querySelector(".nav");

function closeMenu() {
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Abrir menu");
}

menuButton.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
});

nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const revealElements = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const progressBar = document.querySelector(".progressBar");
function updateScrollProgress() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  const progress = total > 0 ? (window.scrollY / total) * 100 : 0;
  progressBar.style.width = `${progress}%`;
  document.documentElement.style.setProperty("--page-scroll", `${window.scrollY}px`);
}

updateScrollProgress();
window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("resize", updateScrollProgress);

function formatPrice(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function bancoConfigurado() {
  return (
    typeof SUPABASE_URL !== "undefined" &&
    /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
    typeof SUPABASE_ANON_KEY !== "undefined" &&
    SUPABASE_ANON_KEY
  );
}

/* ---------- Produtos ---------- */
// O preço NÃO é exibido publicamente — fica só no catálogo interno (admin.html),
// para os consultores consultarem e passarem o valor ao cliente.
const productGrid = document.querySelector("#product-grid");
const productFiltersEl = document.querySelector("#product-filters");
let activeCategory = "Todos";
let produtosAtuais = typeof produtosFallback !== "undefined" ? produtosFallback : [];

function renderProductFilters() {
  if (!productFiltersEl) return;
  const categories = ["Todos", ...new Set(produtosAtuais.map((item) => item.categoria))];
  productFiltersEl.innerHTML = categories
    .map((cat) => `<button type="button" class="${cat === activeCategory ? "active" : ""}" data-cat="${cat}">${cat}</button>`)
    .join("");
}

function renderProducts() {
  if (!productGrid) return;
  const list = activeCategory === "Todos" ? produtosAtuais : produtosAtuais.filter((item) => item.categoria === activeCategory);
  productGrid.innerHTML = list
    .map((item) => `<article class="productCard">
      ${item.foto_url ? `<img class="productPhoto" src="${item.foto_url}" alt="${item.nome}" loading="lazy">` : `<div class="productPhoto productPhotoEmpty" aria-hidden="true"></div>`}
      <span class="productCat">${item.categoria}</span>
      <h3>${item.nome}</h3>
    </article>`)
    .join("") || `<p class="promoEmpty">Nenhum produto nessa categoria no momento.</p>`;
}

async function loadProducts() {
  if (bancoConfigurado()) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/produtos?select=nome,categoria,foto_url&ativo=eq.true&order=categoria.asc,nome.asc`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length) produtosAtuais = data;
      }
    } catch (error) {
      /* mantém o catálogo de reserva (products.js) se a busca falhar */
    }
  }
  renderProductFilters();
  renderProducts();
}

if (productFiltersEl) {
  renderProductFilters();
  renderProducts();
  loadProducts();
  productFiltersEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-cat]");
    if (!button) return;
    activeCategory = button.dataset.cat;
    renderProductFilters();
    renderProducts();
  });
}

/* ---------- Promoções ---------- */
const promoListEl = document.querySelector("#promo-list");

function renderPromotions(promos) {
  if (!promoListEl) return;
  if (!promos || promos.length === 0) {
    promoListEl.innerHTML = `<p class="promoEmpty">Sem promoções ativas no momento. Fale com a gente para saber as condições atuais.</p>`;
    return;
  }
  promoListEl.innerHTML = promos
    .map((promo) => `<article class="promoCard">
      ${promo.foto_url ? `<img class="promoPhoto" src="${promo.foto_url}" alt="${promo.titulo || ""}" loading="lazy">` : ""}
      <p class="eyebrow dark">${promo.titulo || ""}</p>
      <p>${promo.descricao || ""}</p>
      ${promo.preco_novo ? `<p class="promoPrecos">${promo.preco_antigo ? `<s>${formatPrice(promo.preco_antigo)}</s>` : ""} <b>${formatPrice(promo.preco_novo)}</b></p>` : ""}
    </article>`)
    .join("");
}

async function loadPromotions() {
  if (!promoListEl) return;
  if (!bancoConfigurado()) return;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/promocoes?select=titulo,descricao,foto_url,preco_antigo,preco_novo&ativa=eq.true&order=criado_em.desc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!response.ok) return;
    const data = await response.json();
    renderPromotions(data);
  } catch (error) {
    /* mantém a mensagem padrão se a busca falhar */
  }
}

loadPromotions();

/* ---------- Depoimentos (feedbacks aprovados) ---------- */
const testimonialListEl = document.querySelector("#testimonial-list");

function renderTestimonials(items) {
  if (!testimonialListEl) return;
  if (!items || items.length === 0) {
    testimonialListEl.innerHTML = `<p class="testimonialEmpty">Em breve, depoimentos de quem já comprou com a gente.</p>`;
    return;
  }
  testimonialListEl.innerHTML = items
    .map(
      (f) => `<article class="testimonialCard">
        <span class="stars">${"★".repeat(f.nota || 0)}${"☆".repeat(5 - (f.nota || 0))}</span>
        <p>${f.mensagem || ""}</p>
        <b>${f.nome || ""}</b>
      </article>`
    )
    .join("");
}

async function loadTestimonials() {
  if (!testimonialListEl || !bancoConfigurado()) return;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/feedbacks?select=nome,nota,mensagem&aprovado=eq.true&order=criado_em.desc&limit=9`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!response.ok) return;
    const data = await response.json();
    renderTestimonials(data);
  } catch (error) {
    /* mantém a mensagem padrão se a busca falhar */
  }
}

loadTestimonials();

/* ---------- Feedback ---------- */
const feedbackForm = document.querySelector("#feedback-form");
const ratingStars = document.querySelector("#rating-stars");
const ratingValue = document.querySelector("#rating-value");
const feedbackStatus = document.querySelector("#feedback-status");

if (ratingStars) {
  ratingStars.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    const value = Number(button.dataset.value);
    ratingValue.value = value;
    ratingStars.querySelectorAll("button").forEach((star) => {
      star.classList.toggle("filled", Number(star.dataset.value) <= value);
    });
  });
}

if (feedbackForm) {
  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(feedbackForm);
    const nome = formData.get("nome")?.toString().trim();
    const mensagem = formData.get("mensagem")?.toString().trim();
    const nota = Number(formData.get("nota"));

    if (!nome || !mensagem || !nota) {
      feedbackStatus.textContent = "Preencha seu nome, uma nota e uma mensagem.";
      return;
    }

    if (!bancoConfigurado()) {
      feedbackStatus.textContent = "O envio ainda não está configurado. Fale com a gente pelo WhatsApp por enquanto.";
      return;
    }

    feedbackStatus.textContent = "Enviando...";
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/feedbacks`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ nome, nota, mensagem, aprovado: false }),
      });

      if (!response.ok) throw new Error("Falha ao enviar");

      feedbackStatus.textContent = "Obrigado! Sua avaliação foi enviada e vai aparecer no site após ser revisada pela loja.";
      feedbackForm.reset();
      ratingStars?.querySelectorAll("button").forEach((star) => star.classList.remove("filled"));
    } catch (error) {
      feedbackStatus.textContent = "Não foi possível enviar agora. Tente novamente em instantes.";
    }
  });
}
