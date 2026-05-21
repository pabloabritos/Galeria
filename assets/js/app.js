const translations = {
  es: {
    brandLine: "Canal, creadores y comunidad",
    navHome: "Home",
    navPrograms: "Programas",
    navLive: "En vivo",
    navCalendar: "Calendario",
    navCreators: "Creadores",
    navPodcasts: "Podcasts",
    navMusic: "Musica",
    navSupport: "Sponsors",
    navAbout: "Sobre nosotros",
    search: "Buscar programa, short o creador",
    login: "Entrar",
    latest: "Ultimo estreno del canal",
    homeTitle: "Todo el pulso del canal en una sola pantalla.",
    homeText: "Un reproductor central para estrenos, directos y shorts, con playlists por programa y acceso para creadores.",
    watchNow: "Ver ahora",
    creatorAccess: "Acceso creadores",
    premiere: "Estreno",
    nowPlaying: "Reproduciendo",
    share: "Compartir",
    all: "Todo",
    uploaded: "Subidos",
    live: "En vivo",
    shorts: "Shorts",
    calendar: "Calendario",
    calendarText: "Nuevo programa programado desde YouTube Studio.",
    liveSection: "En vivo",
    liveStatus: "Sin transmision activa",
    liveText: "Cuando haya directo, este bloque abre el acceso principal.",
    support: "Fans y sponsors",
    supportText: "Apoyos agrupados por programa y creador.",
    playlists: "Playlists del canal",
    chooseShow: "Elegir programa favorito",
    seeSchedule: "Ver agenda",
    programsTitle: "Programas, vivos y shorts agrupados por playlist.",
    programsText: "Cada tarjeta abre la playlist del programa, sus ultimos episodios y estadisticas publicas.",
    podcastsEyebrow: "Podcasts",
    podcastsTitle: "Playlists de podcasts de Spotify dentro del universo del canal.",
    podcastsText: "Una pantalla para alojar conversaciones largas, especiales de audio y playlists curatoriales vinculadas a cada programa.",
    musicEyebrow: "Musica",
    musicTitle: "Playlists musicales de Spotify para acompañar el canal.",
    musicText: "Una seccion para playlists oficiales, selecciones de creadores, musica de programas y curadurias para la comunidad."
  },
  en: {
    brandLine: "Channel, creators and community",
    navHome: "Home",
    navPrograms: "Shows",
    navLive: "Live",
    navCalendar: "Calendar",
    navCreators: "Creators",
    navPodcasts: "Podcasts",
    navMusic: "Music",
    navSupport: "Sponsors",
    navAbout: "About",
    search: "Search shows, shorts or creators",
    login: "Sign in",
    latest: "Latest channel premiere",
    homeTitle: "The whole channel pulse on one screen.",
    homeText: "A central player for premieres, live streams and shorts, with playlists by show and creator access.",
    watchNow: "Watch now",
    creatorAccess: "Creator access",
    premiere: "Premiere",
    nowPlaying: "Now playing",
    share: "Share",
    all: "All",
    uploaded: "Uploads",
    live: "Live",
    shorts: "Shorts",
    calendar: "Calendar",
    calendarText: "New show scheduled from YouTube Studio.",
    liveSection: "Live",
    liveStatus: "No active stream",
    liveText: "When a stream starts, this block becomes the main entry.",
    support: "Fans and sponsors",
    supportText: "Support grouped by show and creator.",
    playlists: "Channel playlists",
    chooseShow: "Choose a favorite show",
    seeSchedule: "View schedule",
    programsTitle: "Shows, live streams and shorts grouped by playlist.",
    programsText: "Each card opens the show playlist, latest episodes and public stats.",
    podcastsEyebrow: "Podcasts",
    podcastsTitle: "Spotify podcast playlists inside the channel universe.",
    podcastsText: "A screen for long-form conversations, audio specials and curated playlists tied to each show.",
    musicEyebrow: "Music",
    musicTitle: "Spotify music playlists to soundtrack the channel.",
    musicText: "A section for official playlists, creator selections, show music and community curation."
  }
};

const body = document.body;
const storedTheme = localStorage.getItem("galeria-theme");
const storedLanguage = localStorage.getItem("galeria-language") || "es";
let currentFilter = "all";

function setActiveNav() {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === body.dataset.page);
  });
}

function applyLanguage(lang) {
  const dictionary = translations[lang] || translations.es;
  body.dataset.lang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem("galeria-language", lang);
  document.querySelectorAll("[data-language-toggle]").forEach((button) => {
    button.textContent = lang.toUpperCase();
  });
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (dictionary[key]) node.textContent = dictionary[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (dictionary[key]) node.placeholder = dictionary[key];
  });
}

function applyTheme(theme) {
  body.dataset.theme = theme;
  localStorage.setItem("galeria-theme", theme);
}

function applySearchAndFilter() {
  const input = document.querySelector("[data-site-search]");
  const query = input ? input.value.trim().toLowerCase() : "";
  const searchableItems = document.querySelectorAll("[data-search]");

  searchableItems.forEach((item) => {
    const category = item.dataset.category;
    const matchesFilter = currentFilter === "all" || !category || category === currentFilter;
    const haystack = `${item.dataset.search || ""} ${item.textContent}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    item.classList.toggle("is-hidden", !matchesFilter || !matchesSearch);
  });
}

function bindInteractions() {
  document.querySelectorAll("[data-menu-toggle]").forEach((button) => {
    button.addEventListener("click", () => body.classList.toggle("nav-open"));
  });

  document.querySelectorAll("[data-language-toggle]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(body.dataset.lang === "es" ? "en" : "es"));
  });

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(body.dataset.theme === "dark" ? "light" : "dark"));
  });

  document.querySelectorAll("[data-site-search]").forEach((input) => {
    input.addEventListener("input", applySearchAndFilter);
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      applySearchAndFilter();
    });
  });

  document.querySelectorAll("[data-like-button]").forEach((button) => {
    let liked = false;
    button.addEventListener("click", () => {
      liked = !liked;
      button.textContent = liked ? "Te gusta" : "Me gusta";
      button.classList.toggle("is-active", liked);
    });
  });

  document.querySelectorAll("[data-share-button]").forEach((button) => {
    button.addEventListener("click", async () => {
      const shareData = { title: document.title, url: window.location.href };
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        button.textContent = body.dataset.lang === "en" ? "Copied" : "Copiado";
        window.setTimeout(() => applyLanguage(body.dataset.lang || "es"), 1200);
      }
    });
  });
}

if (storedTheme) applyTheme(storedTheme);
applyLanguage(storedLanguage);
setActiveNav();
bindInteractions();
applySearchAndFilter();
