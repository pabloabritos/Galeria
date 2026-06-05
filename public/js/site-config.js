// Ejecuta el page-guard y aplica text-overrides del admin en todas las páginas.
// Debe cargarse DESPUÉS de app.js para que los overrides tengan la última palabra.

(async function () {
  // Mapa de data-page → clave en site-config.pages
  const PAGE_KEY_MAP = {
    live:     "vivo",
    programs: "programas",
    podcasts: "podcasts",
    music:    "musica",
    calendar: "calendario",
    support:  "sponsors",
    about:    "sobre"
  };

  let config = { pages: {}, textos: {} };
  try {
    const res = await fetch("/api/site-config");
    if (res.ok) config = await res.json();
  } catch (_) {
    return; // Si el servidor no responde, no hacer nada
  }

  // ── 1. Page guard ─────────────────────────────────────────────────────────
  const dataPage = document.body.dataset.page || "";
  const configKey = PAGE_KEY_MAP[dataPage] || dataPage;
  if (configKey && config.pages[configKey]?.enabled === false) {
    document.body.innerHTML = `
      <div style="display:grid;place-items:center;min-height:100vh;
                  background:#090a16;color:#f8f5ef;font-family:inherit;
                  text-align:center;padding:20px;">
        <div>
          <p style="color:#f6247d;font-weight:900;text-transform:uppercase;
                    font-size:0.82rem;letter-spacing:0.12em;margin-bottom:14px;">
            En mantenimiento
          </p>
          <h1 style="font-size:clamp(1.8rem,5vw,3.5rem);margin:0 0 18px;line-height:1.1;">
            Esta sección está temporalmente fuera de servicio.
          </h1>
          <p style="color:#b8b9c7;margin-bottom:32px;max-width:480px;">
            Estamos realizando mejoras. Volvé en unos minutos.
          </p>
          <a href="/" style="display:inline-block;padding:12px 26px;
                             background:#f6247d;color:#fff;border-radius:8px;
                             text-decoration:none;font-weight:700;">
            Volver al inicio
          </a>
        </div>
      </div>`;
    return;
  }

  // ── 2. Text overrides — parchar el diccionario de traducciones ───────────
  // Así los overrides sobreviven a cualquier cambio de idioma posterior.
  const textosEs = config.textos    || {};
  const textosEn = config.textos_en || {};

  const hasEs = Object.keys(textosEs).length > 0;
  const hasEn = Object.keys(textosEn).length > 0;
  if (!hasEs && !hasEn) return;

  // Esperar a que app.js exponga galTranslations (debería ser síncrono, pero por seguridad)
  function patchAndApply() {
    const dict = window.galTranslations;
    if (!dict) return; // app.js aún no cargó (no debería pasar)

    // Inyectar overrides en ambos idiomas
    if (hasEs && dict.es) Object.assign(dict.es, textosEs);
    if (hasEn && dict.en) Object.assign(dict.en, textosEn);

    // Re-aplicar el idioma actual para que los cambios se vean de inmediato
    const currentLang = document.body.dataset.lang || "es";
    if (typeof window.galApplyLanguage === "function") {
      window.galApplyLanguage(currentLang);
    }
  }

  patchAndApply();
})();
