const profiles = [
  { key: "dores", icon: "↕", label: "Acordo com dores", short: "Sinto desconforto principalmente na lombar, ombros ou quadril.", result: "suporte alinhado e alívio de pressão" },
  { key: "calor", icon: "≈", label: "Sinto muito calor", short: "Acordo durante a noite procurando um lado mais fresco.", result: "respirabilidade e conforto térmico" },
  { key: "movimento", icon: "◌", label: "Percebo cada movimento", short: "Qualquer mudança de posição atrapalha a continuidade do sono.", result: "estabilidade e independência de movimentos" },
  { key: "aconchego", icon: "◇", label: "Não encontro conforto", short: "Demoro a relaxar e parece que o corpo nunca se acomoda.", result: "acolhimento com sustentação" },
];

const sleepPositions = [
  { key: "lado", label: "De lado", icon: "◒", note: "atenção ao encaixe dos ombros e quadril" },
  { key: "costas", label: "De costas", icon: "—", note: "atenção ao suporte da região lombar" },
  { key: "brucos", label: "De bruços", icon: "▰", note: "atenção para evitar afundamento excessivo" },
  { key: "vario", label: "Mudo bastante", icon: "↻", note: "atenção à facilidade para trocar de posição" },
];

const comfortFeels = [
  { key: "macio", label: "Mais macio", note: "Gosto de sentir o corpo sendo acolhido." },
  { key: "equilibrado", label: "Equilibrado", note: "Quero sustentação sem perder o aconchego." },
  { key: "firme", label: "Mais firme", note: "Prefiro uma superfície estável, com menos afundamento." },
  { key: "nao-sei", label: "Ainda não sei", note: "Quero experimentar e comparar antes de decidir." },
];

const sleepModes = [
  { key: "sozinho", label: "Durmo sozinho", note: "A recomendação pode ser totalmente focada em você." },
  { key: "casal-parecido", label: "Em casal, gostos parecidos", note: "Podemos buscar uma sensação confortável para os dois." },
  { key: "casal-diferente", label: "Em casal, gostos diferentes", note: "Precisamos equilibrar biotipos, movimentos e preferências." },
];

const state = {
  profile: "",
  position: "",
  comfort: "",
  sleepMode: "",
  step: 0,
};

const quizStage = document.querySelector("#quiz-stage");
const quizCounter = document.querySelector("#quiz-counter");
const quizTrack = document.querySelector("#quiz-track");

function getItem(items, key) {
  return items.find((item) => item.key === key);
}

function optionButton(item, type) {
  const selected = state[type] === item.key;

  if (type === "profile") {
    return `<button type="button" class="profile${selected ? " selected" : ""}" data-type="profile" data-key="${item.key}">
      <i>${item.icon}</i><h3>${item.label}</h3><p>${item.short}</p><span>${selected ? "Selecionado ✓" : "Escolher →"}</span>
    </button>`;
  }

  if (type === "position") {
    return `<button type="button" class="${selected ? "selected" : ""}" data-type="position" data-key="${item.key}">
      <i>${item.icon}</i><div><h3>${item.label}</h3><p>${item.note}</p></div><span>→</span>
    </button>`;
  }

  if (type === "comfort") {
    return `<button type="button" class="${selected ? "selected" : ""}" data-type="comfort" data-key="${item.key}">
      <span class="feelIcon ${item.key}"><i></i></span><h3>${item.label}</h3><p>${item.note}</p><b>Escolher →</b>
    </button>`;
  }

  return `<button type="button" class="${selected ? "selected" : ""}" data-type="sleepMode" data-key="${item.key}">
    <i>${item.key === "sozinho" ? "○" : "○○"}</i><div><h3>${item.label}</h3><p>${item.note}</p></div><span>→</span>
  </button>`;
}

function questionHeader(number, small, title, text) {
  return `<div class="quizQuestion"><span>${number}</span><div><small>${small}</small><h3>${title}</h3><p>${text}</p></div></div>`;
}

function renderQuestion() {
  let content = "";

  if (state.step === 0) {
    content = `${questionHeader("01", "COMECE PELA SUA MANHÃ", "O que mais incomoda quando você acorda?", "Pense no problema que mais se repete, mesmo que nem sempre aconteça.")}
      <div class="quizOptions profileGrid">${profiles.map((item) => optionButton(item, "profile")).join("")}</div>`;
  } else if (state.step === 1) {
    content = `${questionHeader("02", "AGORA PENSE NO SEU CORPO", "Em qual posição você passa mais tempo?", "A posição muda onde o corpo concentra pressão e como a coluna precisa ser sustentada.")}
      <div class="quizOptions positionCards">${sleepPositions.map((item) => optionButton(item, "position")).join("")}</div>`;
  } else if (state.step === 2) {
    content = `${questionHeader("03", "NÃO EXISTE RESPOSTA CERTA", "Qual sensação parece mais confortável?", "Essa preferência será combinada com o suporte que seu corpo precisa.")}
      <div class="quizOptions comfortCards">${comfortFeels.map((item) => optionButton(item, "comfort")).join("")}</div>`;
  } else {
    content = `${questionHeader("04", "ÚLTIMA PISTA", "Esse colchão será usado por quem?", "Quando duas pessoas dividem a cama, movimentos, biotipos e preferências também entram na escolha.")}
      <div class="quizOptions modeCards">${sleepModes.map((item) => optionButton(item, "sleepMode")).join("")}</div>`;
  }

  quizStage.innerHTML = `<div class="quizStage">${content}${state.step > 0 ? '<button type="button" class="quizBack" data-action="back">← Voltar uma pergunta</button>' : ""}</div>`;
}

function renderResult() {
  const profile = getItem(profiles, state.profile);
  const position = getItem(sleepPositions, state.position);
  const comfort = getItem(comfortFeels, state.comfort);
  const mode = getItem(sleepModes, state.sleepMode);

  quizStage.innerHTML = `<div class="result" role="status">
    <div class="resultStamp"><span>SEU MAPA DE CONFORTO</span><strong>O seu ponto de partida é:</strong><h3>${profile.result}</h3></div>
    <div class="resultSignals">
      <div><span>POSIÇÃO</span><b>${position.label}</b><p>${position.note}</p></div>
      <div><span>SENSAÇÃO</span><b>${comfort.label}</b><p>${comfort.note}</p></div>
      <div><span>USO</span><b>${mode.label}</b><p>${mode.note}</p></div>
    </div>
    <div class="resultAdvice"><span>O QUE VAMOS OBSERVAR NA LOJA</span><p>Distribuição de pressão, sustentação, adaptação ao corpo e a sensação que faz você relaxar — sempre considerando também peso e altura de quem vai usar.</p><small>Este resultado orienta a conversa, mas não substitui experimentar o colchão.</small></div>
    <div class="resultActions"><a href="#contato">Acompanhar a LS até a abertura <span>→</span></a><button type="button" data-action="reset">Refazer experiência</button></div>
  </div>`;
}

function renderQuiz() {
  const complete = Boolean(state.profile && state.position && state.comfort && state.sleepMode);
  quizCounter.textContent = complete ? "PERFIL PRONTO" : `0${state.step + 1} DE 04`;
  quizTrack.style.width = complete ? "100%" : `${((state.step + 1) / 4) * 100}%`;

  if (complete) renderResult();
  else renderQuestion();
}

quizStage.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.action === "back") {
    state.step = Math.max(0, state.step - 1);
    renderQuiz();
    return;
  }

  if (button.dataset.action === "reset") {
    Object.assign(state, { profile: "", position: "", comfort: "", sleepMode: "", step: 0 });
    renderQuiz();
    return;
  }

  const { type, key } = button.dataset;
  if (!type || !key) return;

  state[type] = key;
  renderQuiz();

  if (type !== "sleepMode") {
    window.setTimeout(() => {
      state.step = Math.min(3, state.step + 1);
      renderQuiz();
    }, 180);
  }
});

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
renderQuiz();
