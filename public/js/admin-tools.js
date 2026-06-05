// ═══════════════════════════════════════════════════════════════════════════
// ADMIN TOOLS  —  herramientas para admins en creadores.html
// Requiere que initAdminTools() sea llamado desde initAdminPanel() en creadores.js
// ═══════════════════════════════════════════════════════════════════════════

// Textos editables por página (clave i18n → label legible)
const TEXTO_MAP = {
  home: [
    { key: "homeTitle",    label: "Título principal",        type: "text"     },
    { key: "homeText",     label: "Descripción",             type: "textarea" },
    { key: "chooseShow",   label: "Título sección playlists",type: "text"     },
  ],
  podcasts: [
    { key: "podcastsEyebrow", label: "Etiqueta (eyebrow)",   type: "text"     },
    { key: "podcastsTitle",   label: "Título",               type: "text"     },
    { key: "podcastsText",    label: "Descripción",          type: "textarea" },
  ],
  musica: [
    { key: "musicEyebrow",    label: "Etiqueta (eyebrow)",   type: "text"     },
    { key: "musicTitle",      label: "Título",               type: "text"     },
    { key: "musicText",       label: "Descripción",          type: "textarea" },
  ],
  vivo: [
    { key: "liveRoomStatus",  label: "Estado del canal",     type: "text"     },
    { key: "liveRoomTitle",   label: "Título del vivo",      type: "text"     },
    { key: "liveText",        label: "Descripción del bloque live", type: "textarea" },
  ],
  programas: [
    { key: "programsTitle",   label: "Título",               type: "text"     },
    { key: "programsText",    label: "Descripción",          type: "textarea" },
  ],
  calendario: [
    { key: "calendarTitle",   label: "Título",               type: "text"     },
    { key: "calendarPageText",label: "Descripción",          type: "textarea" },
  ],
  sponsors: [
    { key: "supportTitle",    label: "Título",               type: "text"     },
    { key: "supportPageText", label: "Descripción",          type: "textarea" },
  ],
  sobre: [
    { key: "aboutTitle",       label: "Título",                        type: "text"     },
    { key: "aboutText",        label: "Descripción",                   type: "textarea" },
    { key: "vision",           label: "Tarjeta 1 — etiqueta celeste",  type: "text"     },
    { key: "visionTitle",      label: "Tarjeta 1 — título",            type: "text"     },
    { key: "visionText",       label: "Tarjeta 1 — texto",             type: "textarea" },
    { key: "community",        label: "Tarjeta 2 — etiqueta celeste",  type: "text"     },
    { key: "communityTitle",   label: "Tarjeta 2 — título",            type: "text"     },
    { key: "communityText",    label: "Tarjeta 2 — texto",             type: "textarea" },
    { key: "scale",            label: "Tarjeta 3 — etiqueta celeste",  type: "text"     },
    { key: "scaleTitle",       label: "Tarjeta 3 — título",            type: "text"     },
    { key: "scaleText",        label: "Tarjeta 3 — texto",             type: "textarea" },
  ],
};

const PAGE_LABELS = {
  vivo: "En vivo", programas: "Programas", podcasts: "Podcasts",
  musica: "Música", calendario: "Calendario", sponsors: "Sponsors", sobre: "Sobre nosotros"
};

// ─── Utilidades ──────────────────────────────────────────────────────────────
function escHtml(v) {
  return String(v || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function adminInput(style = "") {
  return `width:100%;padding:9px 10px;background:#141414;border:1px solid #333;
          color:#fff;border-radius:4px;box-sizing:border-box;font:inherit;${style}`;
}

function adminLabel(labelText, inputHtml) {
  return `<label style="display:flex;flex-direction:column;gap:6px;font-size:0.85rem;color:#aaa;">
    <span>${labelText}</span>${inputHtml}
  </label>`;
}

// Convierte URL/embed de Spotify a una URL de embed válida
function parseSpotifyInput(raw) {
  const s = (raw || "").trim();
  const srcMatch = s.match(/src=["']([^"']+)["']/);
  if (srcMatch) return srcMatch[1];
  if (s.includes("open.spotify.com/embed/")) return s;
  const urlMatch = s.match(/open\.spotify\.com\/(playlist|show|episode|album|track)\/([A-Za-z0-9]+)/);
  if (urlMatch) {
    const [, type, id] = urlMatch;
    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
  }
  return s;
}

// ─── Sección compartida de formulario + lista para Podcasts / Música ──────────
function buildContentManager({ panelId, title, apiGet, apiPost, apiDelete, embedLabel }) {
  const section = document.getElementById(panelId);
  if (!section) return;

  section.innerHTML = `
    <h2 style="color:#ffb703;margin-bottom:25px;font-size:1.5rem;">${title}</h2>
    <div style="display:flex;flex-wrap:wrap;gap:30px;width:100%;">
      <!-- Formulario -->
      <div style="background:#0d0d0d;padding:25px;border-radius:8px;flex:1;min-width:300px;border:1px solid #222;box-sizing:border-box;">
        <h3 style="margin-top:0;color:#fff;font-size:1.1rem;" id="${panelId}-form-title">Nuevo</h3>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <input type="hidden" id="${panelId}-id" />
          ${adminLabel("Título", `<input type="text" id="${panelId}-title" placeholder="Nombre del podcast o playlist" style="${adminInput()}" />`)}
          ${adminLabel("Descripción (opcional)", `<textarea id="${panelId}-desc" rows="3" placeholder="Breve descripción..." style="${adminInput("resize:vertical;")}"></textarea>`)}
          ${adminLabel(embedLabel,
            `<textarea id="${panelId}-url" rows="3" placeholder="Pegá el link o el código embed de Spotify aquí..."
              style="${adminInput("resize:vertical;font-family:monospace;font-size:0.8rem;")}"></textarea>
             <small style="color:#666;font-size:0.75rem;">Podés pegar: link de Spotify, URL de embed, o el código &lt;iframe&gt; completo.</small>`
          )}
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px;">
            <button type="button" class="primary-action" id="${panelId}-save"
              style="padding:12px;font-weight:bold;">Guardar</button>
            <button type="button" id="${panelId}-reset"
              style="padding:12px;background:#222;color:#fff;border:1px solid #333;border-radius:4px;cursor:pointer;">Nuevo</button>
          </div>
        </div>
      </div>
      <!-- Lista -->
      <div style="background:#0d0d0d;padding:25px;border-radius:8px;flex:1.5;min-width:300px;border:1px solid #222;box-sizing:border-box;">
        <h3 style="margin-top:0;color:#fff;font-size:1.1rem;">Publicados</h3>
        <div id="${panelId}-list" style="display:flex;flex-direction:column;gap:12px;"></div>
      </div>
    </div>`;

  async function renderList() {
    const listEl = document.getElementById(`${panelId}-list`);
    const res = await fetch(apiGet);
    if (!res.ok) { listEl.innerHTML = `<p style="color:#666;">No se pudo cargar la lista.</p>`; return; }
    const items = await res.json();
    if (!items.length) { listEl.innerHTML = `<p style="color:#666;">Todavía no hay elementos.</p>`; return; }
    listEl.innerHTML = items.map((item) => `
      <article style="border:1px solid #222;border-radius:8px;padding:14px;background:#111;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="min-width:0;">
          <strong style="color:#fff;display:block;margin-bottom:4px;">${escHtml(item.title)}</strong>
          ${item.description ? `<p style="color:#aaa;margin:0 0 6px;font-size:0.82rem;">${escHtml(item.description)}</p>` : ""}
          <small style="color:#555;font-size:0.75rem;word-break:break-all;">${escHtml(item.embedUrl)}</small>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
          <button class="edit-item-btn" data-id="${escHtml(item.id)}"
            style="background:#333;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.82rem;">Editar</button>
          <button class="delete-item-btn" data-id="${escHtml(item.id)}"
            style="background:#de3333;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:0.82rem;">Quitar</button>
        </div>
      </article>`).join("");

    listEl.querySelectorAll(".edit-item-btn").forEach((btn) => {
      btn.onclick = () => {
        const item = items.find((i) => i.id === btn.dataset.id);
        if (!item) return;
        document.getElementById(`${panelId}-id`).value = item.id;
        document.getElementById(`${panelId}-title`).value = item.title;
        document.getElementById(`${panelId}-desc`).value = item.description || "";
        document.getElementById(`${panelId}-url`).value = item.embedUrl;
        document.getElementById(`${panelId}-form-title`).textContent = "Editar";
        document.getElementById(`${panelId}-save`).textContent = "Actualizar";
        document.getElementById(`${panelId}-save`).scrollIntoView({ behavior: "smooth", block: "center" });
      };
    });

    listEl.querySelectorAll(".delete-item-btn").forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm("¿Quitar este elemento?")) return;
        await fetch(apiDelete, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" }, body: JSON.stringify({ id: btn.dataset.id }) });
        renderList();
      };
    });
  }

  function resetForm() {
    document.getElementById(`${panelId}-id`).value = "";
    document.getElementById(`${panelId}-title`).value = "";
    document.getElementById(`${panelId}-desc`).value = "";
    document.getElementById(`${panelId}-url`).value = "";
    document.getElementById(`${panelId}-form-title`).textContent = "Nuevo";
    document.getElementById(`${panelId}-save`).textContent = "Guardar";
  }

  document.getElementById(`${panelId}-save`).onclick = async () => {
    const title = document.getElementById(`${panelId}-title`).value.trim();
    const rawUrl = document.getElementById(`${panelId}-url`).value.trim();
    const embedUrl = parseSpotifyInput(rawUrl);
    if (!title || !embedUrl) { alert("Completá el título y la URL/embed."); return; }
    const payload = {
      id: document.getElementById(`${panelId}-id`).value || undefined,
      title,
      description: document.getElementById(`${panelId}-desc`).value.trim(),
      embedUrl
    };
    const res = await fetch(apiPost, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" }, body: JSON.stringify(payload) });
    if (res.ok) { resetForm(); renderList(); }
    else { const d = await res.json().catch(() => ({})); alert(d.error || "Error al guardar."); }
  };

  document.getElementById(`${panelId}-reset`).onclick = resetForm;
  renderList();
}

// ─── Sección: Control de páginas ─────────────────────────────────────────────
async function initPageControl() {
  const section = document.getElementById("page-control-panel");
  if (!section) return;

  const res = await fetch("/api/site-config");
  if (!res.ok) return;
  const config = await res.json();

  section.innerHTML = `
    <h2 style="color:#ffb703;margin-bottom:10px;font-size:1.5rem;">🔌 Control de páginas</h2>
    <p style="color:#666;font-size:0.85rem;margin-bottom:24px;">Apagá una página para mostrar la pantalla de mantenimiento a los visitantes. Los admins no son afectados.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;" id="page-toggles-grid"></div>
    <button type="button" class="primary-action" id="btn-save-pages"
      style="margin-top:22px;padding:12px 28px;font-weight:700;">Guardar cambios</button>
    <span id="page-save-status" style="margin-left:14px;font-size:0.85rem;color:#3ce0a5;display:none;">✓ Guardado</span>`;

  const grid = document.getElementById("page-toggles-grid");
  const state = { ...config.pages };

  Object.entries(PAGE_LABELS).forEach(([key, label]) => {
    const enabled = state[key]?.enabled !== false;
    const card = document.createElement("label");
    card.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;background:#0d0d0d;border:1px solid #222;border-radius:8px;cursor:pointer;";
    card.innerHTML = `
      <span style="font-size:0.95rem;font-weight:700;color:#fff;">${escHtml(label)}</span>
      <span class="toggle-wrap" style="position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0;">
        <input type="checkbox" data-page-key="${key}" ${enabled ? "checked" : ""}
          style="opacity:0;width:0;height:0;position:absolute;" />
        <span class="toggle-slider" style="position:absolute;inset:0;border-radius:26px;
          background:${enabled ? "#3ce0a5" : "#333"};transition:background 0.2s;cursor:pointer;">
          <span style="position:absolute;top:3px;left:${enabled ? "23px" : "3px"};width:20px;height:20px;
            border-radius:50%;background:#fff;transition:left 0.2s;"></span>
        </span>
      </span>`;
    grid.appendChild(card);

    const checkbox = card.querySelector("input[type=checkbox]");
    const slider = card.querySelector(".toggle-slider");
    const thumb = slider.querySelector("span");
    checkbox.addEventListener("change", () => {
      state[key] = { enabled: checkbox.checked };
      slider.style.background = checkbox.checked ? "#3ce0a5" : "#333";
      thumb.style.left = checkbox.checked ? "23px" : "3px";
    });
  });

  document.getElementById("btn-save-pages").onclick = async () => {
    const res2 = await fetch("/api/admin/site-config", {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" },
      body: JSON.stringify({ pages: state })
    });
    const status = document.getElementById("page-save-status");
    if (res2.ok) {
      status.style.display = "inline";
      setTimeout(() => { status.style.display = "none"; }, 2500);
    } else {
      alert("Error al guardar.");
    }
  };
}

// ─── Sección: Editor de textos ────────────────────────────────────────────────
async function initTextEditor() {
  const section = document.getElementById("textos-admin-panel");
  if (!section) return;

  const res = await fetch("/api/site-config");
  const config = res.ok ? await res.json() : { textos: {} };
  const overrides = config.textos || {};
  let currentPage = "home";

  section.innerHTML = `
    <h2 style="color:#ffb703;margin-bottom:10px;font-size:1.5rem;">✏️ Editor de textos</h2>
    <p style="color:#666;font-size:0.85rem;margin-bottom:20px;">
      Los cambios reemplazan el texto visible en la página elegida sin tocar el código.
      Dejar un campo vacío restaura el texto original.
    </p>
    <label style="display:flex;flex-direction:column;gap:6px;font-size:0.85rem;color:#aaa;max-width:280px;margin-bottom:22px;">
      <span>Página a editar</span>
      <select id="texto-page-selector" style="${adminInput()}">
        ${Object.entries({ home: "Home", ...PAGE_LABELS }).map(([k, v]) =>
          `<option value="${k}">${escHtml(v)}</option>`).join("")}
      </select>
    </label>
    <div id="texto-fields-wrap"></div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:22px;flex-wrap:wrap;">
      <button type="button" class="primary-action" id="btn-save-textos"
        style="padding:12px 28px;font-weight:700;">Guardar textos</button>
      <button type="button" id="btn-auto-translate"
        style="padding:12px 20px;background:#0d4f6e;color:#36d1ff;border:1px solid #36d1ff;
               border-radius:8px;font-weight:700;cursor:pointer;">
        🌐 Traducir al inglés automáticamente
      </button>
      <span id="texto-save-status"   style="font-size:0.85rem;color:#3ce0a5;display:none;">✓ Guardado</span>
      <span id="texto-trans-status"  style="font-size:0.85rem;color:#36d1ff;display:none;"></span>
    </div>`;

  function renderFields(page) {
    const wrap = document.getElementById("texto-fields-wrap");
    const fields = TEXTO_MAP[page] || [];
    wrap.innerHTML = fields.map(({ key, label, type }) => {
      const current = overrides[key] || "";
      const inputHtml = type === "textarea"
        ? `<textarea id="texto-${key}" rows="3" placeholder="(texto original)" style="${adminInput("resize:vertical;")}">${escHtml(current)}</textarea>`
        : `<input type="text" id="texto-${key}" placeholder="(texto original)" value="${escHtml(current)}" style="${adminInput()}" />`;
      return adminLabel(label, inputHtml);
    }).join("");

    if (!fields.length) {
      wrap.innerHTML = `<p style="color:#555;">No hay campos editables para esta página.</p>`;
    }
  }

  renderFields(currentPage);
  document.getElementById("texto-page-selector").onchange = (e) => {
    currentPage = e.target.value;
    renderFields(currentPage);
  };

  // ── Leer campos de la página actual ──────────────────────────────────────
  function getCurrentFieldValues() {
    const fields = TEXTO_MAP[currentPage] || [];
    const result = {};
    fields.forEach(({ key }) => {
      const el = document.getElementById(`texto-${key}`);
      if (el?.value.trim()) result[key] = el.value.trim();
    });
    return result;
  }

  // ── Guardar textos en español ─────────────────────────────────────────────
  document.getElementById("btn-save-textos").onclick = async () => {
    const fieldValues = getCurrentFieldValues();
    const newOverrides = { ...overrides };
    (TEXTO_MAP[currentPage] || []).forEach(({ key }) => {
      if (fieldValues[key]) newOverrides[key] = fieldValues[key];
      else delete newOverrides[key];
    });
    const res2 = await fetch("/api/admin/textos", {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" },
      body: JSON.stringify({ textos: newOverrides })
    });
    const status = document.getElementById("texto-save-status");
    if (res2.ok) {
      Object.assign(overrides, newOverrides);
      Object.keys(overrides).forEach((k) => { if (!(k in newOverrides)) delete overrides[k]; });
      status.style.display = "inline";
      setTimeout(() => { status.style.display = "none"; }, 2500);
    } else {
      alert("Error al guardar textos.");
    }
  };

  // ── Auto-traducir al inglés (MyMemory) ───────────────────────────────────
  document.getElementById("btn-auto-translate").onclick = async () => {
    const fieldValues = getCurrentFieldValues();
    if (!Object.keys(fieldValues).length) {
      alert("No hay textos para traducir. Escribí al menos un campo primero.");
      return;
    }

    const btn    = document.getElementById("btn-auto-translate");
    const status = document.getElementById("texto-trans-status");
    btn.disabled   = true;
    btn.textContent = "Traduciendo…";
    status.style.display = "inline";
    status.textContent   = "Consultando MyMemory…";

    try {
      const res2 = await fetch("/api/admin/traducir", {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" },
        body: JSON.stringify({ textos: fieldValues })
      });
      const data = await res2.json();

      if (!res2.ok) throw new Error(data.error || "Error de servidor");

      status.textContent = `✓ ${Object.keys(data.textos_en || {}).length} campos traducidos y guardados en inglés.`;

      // Mostrar las traducciones al lado de cada campo como referencia
      (TEXTO_MAP[currentPage] || []).forEach(({ key }) => {
        const existingHint = document.getElementById(`hint-en-${key}`);
        if (existingHint) existingHint.remove();
        if (data.textos_en?.[key]) {
          const fieldEl = document.getElementById(`texto-${key}`);
          if (!fieldEl) return;
          const hint = document.createElement("small");
          hint.id = `hint-en-${key}`;
          hint.style.cssText = "color:#36d1ff;font-size:0.75rem;display:block;margin-top:4px;";
          hint.textContent = `🇬🇧 EN: ${data.textos_en[key]}`;
          fieldEl.parentNode.appendChild(hint);
        }
      });

      setTimeout(() => { status.style.display = "none"; }, 5000);
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.style.color = "#f6247d";
    } finally {
      btn.disabled   = false;
      btn.textContent = "🌐 Traducir al inglés automáticamente";
    }
  };
}

// ─── Pagos del canal y planes de precio ──────────────────────────────────────
async function initPagosYPlanes() {
  const section = document.getElementById("pagos-planes-panel");
  if (!section) return;

  const res = await fetch("/api/site-config");
  const cfg = res.ok ? await res.json() : {};
  const pagos  = cfg.pagos  || {};
  const planes = cfg.planes || [];

  section.innerHTML = `
    <h2 style="color:#ffb703;margin-bottom:10px;font-size:1.5rem;">💸 Pagos del canal y planes</h2>
    <p style="color:#666;font-size:0.85rem;margin-bottom:28px;">
      Configurá los links de pago del canal y editá los planes de la página Sponsors.
      Cada plan puede tener su propio link de destino (MercadoPago, Cafecito, WhatsApp, etc.).
    </p>

    <!-- Links de pago del canal -->
    <div style="background:#0d0d0d;padding:24px;border-radius:8px;border:1px solid #222;margin-bottom:28px;">
      <h3 style="margin-top:0;color:#fff;font-size:1.1rem;">💳 Links de pago — Canal Galeria</h3>
      <div style="display:flex;flex-direction:column;gap:14px;max-width:520px;">
        ${adminLabel("Cafecito (solo el usuario, ej: galeria)",
          `<input type="text" id="pagos-cafecito" value="${escHtml(pagos.cafecito||'')}" placeholder="galeria" style="${adminInput()}" />`
        )}
        ${adminLabel("MercadoPago — link de cobro (mpago.la/...)",
          `<input type="url" id="pagos-mp" value="${escHtml(pagos.mercadopago||'')}" placeholder="https://mpago.la/XXXXX" style="${adminInput()}" />`
        )}
        ${adminLabel("MercadoPago — alias (0% siempre, ej: galeria.canal.mp)",
          `<input type="text" id="pagos-alias" value="${escHtml(pagos.aliasMP||'')}" placeholder="galeria.canal.mp" style="${adminInput()}" />`
        )}
        ${adminLabel("Descripción (opcional)",
          `<textarea id="pagos-desc" rows="2" style="${adminInput("resize:vertical;")}">${escHtml(pagos.descripcion||'')}</textarea>`
        )}
        <div style="display:flex;align-items:center;gap:12px;">
          <button type="button" class="primary-action" id="btn-save-pagos" style="padding:10px 22px;font-weight:700;">Guardar links</button>
          <span id="pagos-status" style="color:#3ce0a5;font-size:0.85rem;display:none;">✓ Guardado</span>
        </div>
      </div>
    </div>

    <!-- Editor de planes -->
    <div style="background:#0d0d0d;padding:24px;border-radius:8px;border:1px solid #222;">
      <h3 style="margin-top:0;color:#fff;font-size:1.1rem;">📋 Planes de contribución</h3>
      <p style="color:#666;font-size:0.82rem;margin-bottom:18px;">
        Podés editar el texto, precio y link de destino de cada plan. Los cambios se reflejan en tiempo real en la página Sponsors.
      </p>
      <div id="planes-list" style="display:flex;flex-direction:column;gap:14px;"></div>
      <button type="button" id="btn-add-plan"
        style="margin-top:16px;padding:10px 18px;background:#222;color:#fff;border:1px solid #333;border-radius:6px;cursor:pointer;font-weight:700;">
        + Agregar nuevo plan
      </button>
      <div style="display:flex;align-items:center;gap:12px;margin-top:16px;">
        <button type="button" class="primary-action" id="btn-save-planes" style="padding:10px 22px;font-weight:700;">Guardar todos los planes</button>
        <span id="planes-status" style="color:#3ce0a5;font-size:0.85rem;display:none;">✓ Guardado</span>
      </div>
    </div>`;

  // Estado local de planes
  let planesData = planes.map(p => ({ ...p }));

  function planCard(p, idx) {
    const inp = (id, val, placeholder, type="text") =>
      `<input type="${type}" data-field="${id}" data-idx="${idx}"
        value="${escHtml(val||'')}" placeholder="${placeholder}"
        style="${adminInput()}" />`;
    return `
      <div class="plan-card" data-idx="${idx}"
        style="border:1px solid #333;border-radius:8px;padding:16px;background:#111;display:grid;
               grid-template-columns:1fr 1fr;gap:10px;position:relative;">
        <label style="font-size:0.82rem;color:#aaa;display:flex;flex-direction:column;gap:4px;">
          <span>Título del plan</span>${inp("titulo", p.titulo, "Fan, Sponsor...")}
        </label>
        <label style="font-size:0.82rem;color:#aaa;display:flex;flex-direction:column;gap:4px;">
          <span>Precio</span>${inp("precio", p.precio, "$ 2.000")}
        </label>
        <label style="font-size:0.82rem;color:#aaa;display:flex;flex-direction:column;gap:4px;grid-column:1/-1;">
          <span>Descripción / beneficios</span>
          <textarea data-field="descripcion" data-idx="${idx}" rows="3"
            style="${adminInput("resize:vertical;")}">${escHtml(p.descripcion||'')}</textarea>
        </label>
        <label style="font-size:0.82rem;color:#aaa;display:flex;flex-direction:column;gap:4px;">
          <span>Texto del botón</span>${inp("boton", p.boton, "Apoyar, Contactar...")}
        </label>
        <label style="font-size:0.82rem;color:#aaa;display:flex;flex-direction:column;gap:4px;">
          <span>Link del botón (MP, Cafecito, WA...)</span>${inp("link", p.link, "https://...", "url")}
        </label>
        <label style="font-size:0.82rem;color:#aaa;display:flex;align-items:center;gap:8px;grid-column:1/-1;">
          <input type="checkbox" data-field="destacado" data-idx="${idx}" ${p.destacado?"checked":""} />
          <span>Destacado (borde amarillo)</span>
        </label>
        <button class="btn-remove-plan" data-idx="${idx}"
          style="position:absolute;top:10px;right:10px;background:#de3333;border:none;color:#fff;
                 padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.8rem;">Quitar</button>
      </div>`;
  }

  function renderPlanes() {
    const list = document.getElementById("planes-list");
    list.innerHTML = planesData.map((p, i) => planCard(p, i)).join("");
    list.querySelectorAll("[data-field]").forEach(el => {
      el.addEventListener("input", () => {
        const idx   = parseInt(el.dataset.idx);
        const field = el.dataset.field;
        planesData[idx][field] = el.type === "checkbox" ? el.checked : el.value;
      });
      el.addEventListener("change", () => {
        const idx   = parseInt(el.dataset.idx);
        const field = el.dataset.field;
        planesData[idx][field] = el.type === "checkbox" ? el.checked : el.value;
      });
    });
    list.querySelectorAll(".btn-remove-plan").forEach(btn => {
      btn.onclick = () => {
        planesData.splice(parseInt(btn.dataset.idx), 1);
        renderPlanes();
      };
    });
  }

  renderPlanes();

  document.getElementById("btn-add-plan").onclick = () => {
    planesData.push({ id: Date.now().toString(36), titulo: "", precio: "", descripcion: "", boton: "Apoyar", link: "", destacado: false });
    renderPlanes();
    document.getElementById("planes-list").lastElementChild?.scrollIntoView({ behavior:"smooth", block:"center" });
  };

  // Guardar pagos
  document.getElementById("btn-save-pagos").onclick = async () => {
    const res2 = await fetch("/api/admin/pagos-canal", {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" },
      body: JSON.stringify({
        cafecito:    document.getElementById("pagos-cafecito").value.trim(),
        mercadopago: document.getElementById("pagos-mp").value.trim(),
        aliasMP:     document.getElementById("pagos-alias").value.trim(),
        descripcion: document.getElementById("pagos-desc").value.trim()
      })
    });
    const s = document.getElementById("pagos-status");
    if (res2.ok) { s.style.display="inline"; setTimeout(()=>s.style.display="none",2500); }
    else alert("Error al guardar.");
  };

  // Guardar planes
  document.getElementById("btn-save-planes").onclick = async () => {
    const res2 = await fetch("/api/admin/planes", {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" },
      body: JSON.stringify({ planes: planesData })
    });
    const s = document.getElementById("planes-status");
    if (res2.ok) { s.style.display="inline"; setTimeout(()=>s.style.display="none",2500); }
    else alert("Error al guardar planes.");
  };
}

// ─── Gestión de Programas del Canal ──────────────────────────────────────────
async function initProgramasCanal() {
  const section = document.getElementById("programas-canal-panel");
  if (!section) return;

  section.innerHTML = `
    <h2 style="color:#3ce0a5;margin-bottom:10px;font-size:1.5rem;">📺 Programas del canal</h2>
    <p style="color:#666;font-size:0.85rem;margin-bottom:24px;">
      Estas tarjetas aparecen en la sección "Nuestros programas" del home.
      Ponés el logo y el Instagram de cada programa. Se muestran en tarjetas compactas una al lado de la otra.
    </p>
    <div style="display:flex;flex-wrap:wrap;gap:30px;width:100%;">

      <!-- Formulario -->
      <div style="background:#0d0d0d;padding:25px;border-radius:8px;flex:1;min-width:280px;border:1px solid #222;box-sizing:border-box;">
        <h3 id="prog-form-title" style="margin-top:0;color:#fff;font-size:1.1rem;">Nuevo programa</h3>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <input type="hidden" id="prog-id" />
          ${adminLabel("Nombre del programa", `<input type="text" id="prog-nombre" placeholder="El Enmascarado, La Posta..." style="${adminInput()}" />`)}
          ${adminLabel("Logo (URL de imagen)", `<input type="url" id="prog-logo" placeholder="https://..." style="${adminInput()}" />`)}
          ${adminLabel("Instagram (sin @)", `<input type="text" id="prog-ig" placeholder="nombre.del.programa" style="${adminInput()}" />`)}
          ${adminLabel("Cafecito (usuario, sin @)", `<input type="text" id="prog-cafecito" placeholder="nombredelcanal" style="${adminInput()}" />`)}
          ${adminLabel("MercadoPago — link de cobro (referencia interna)", `<input type="url" id="prog-mp" placeholder="https://mpago.la/XXXXX" style="${adminInput()}" />`)}
          ${adminLabel("MercadoPago — alias (referencia interna)", `<input type="text" id="prog-alias" placeholder="nombre.programa.mp" style="${adminInput()}" />`)}
          ${adminLabel("QR de MercadoPago — URL de la imagen del QR generado por MP",
            `<div style="display:flex;flex-direction:column;gap:5px;">
              <input type="url" id="prog-mp-qr" placeholder="https://i.ibb.co/... (solo se muestra si hay URL cargada)" style="${adminInput()}" />
              <small style="color:#555;font-size:0.74rem;">Generá el QR en la app MP → Cobrar → Código QR → descargar → subir a imgbb.com → pegar la URL acá.</small>
            </div>`)}
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px;">
            <button type="button" class="primary-action" id="prog-save" style="padding:12px;font-weight:bold;background:linear-gradient(135deg,#3ce0a5,#36d1ff);">Guardar programa</button>
            <button type="button" id="prog-reset" style="padding:12px;background:#222;color:#fff;border:1px solid #333;border-radius:4px;cursor:pointer;">Nuevo</button>
          </div>
        </div>
      </div>

      <!-- Lista -->
      <div style="background:#0d0d0d;padding:25px;border-radius:8px;flex:1.5;min-width:280px;border:1px solid #222;box-sizing:border-box;">
        <h3 style="margin-top:0;color:#fff;font-size:1.1rem;">Programas cargados</h3>
        <div id="prog-list" style="display:flex;flex-wrap:wrap;gap:14px;"></div>
      </div>
    </div>`;

  async function renderList() {
    const listEl = document.getElementById("prog-list");
    const res = await fetch("/api/programas-canal");
    if (!res.ok) { listEl.innerHTML = `<p style="color:#666;">No se pudo cargar.</p>`; return; }
    const items = await res.json();
    if (!items.length) { listEl.innerHTML = `<p style="color:#666;">Todavía no hay programas cargados.</p>`; return; }

    listEl.innerHTML = items.map(p => {
      const logoHtml = p.logoUrl
        ? `<img src="${escHtml(p.logoUrl)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #333;" />`
        : `<span style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#3ce0a5,#36d1ff);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;color:#000;">${p.nombre.charAt(0)}</span>`;
      return `
        <div style="background:#111;border:1px solid #222;border-top:3px solid #3ce0a5;border-radius:8px;padding:14px 12px;width:130px;text-align:center;box-sizing:border-box;">
          <div style="display:flex;justify-content:center;margin-bottom:8px;">${logoHtml}</div>
          <strong style="font-size:0.82rem;display:block;margin-bottom:4px;">${escHtml(p.nombre)}</strong>
          ${p.instagram ? `<small style="color:#36d1ff;">@${escHtml(p.instagram)}</small>` : ""}
          <div style="display:flex;gap:6px;margin-top:10px;justify-content:center;">
            <button class="prog-edit-btn" data-id="${escHtml(p.id)}"
              style="background:#333;border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">Editar</button>
            <button class="prog-del-btn" data-id="${escHtml(p.id)}"
              style="background:#de3333;border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.75rem;">Quitar</button>
          </div>
        </div>`;
    }).join("");

    listEl.querySelectorAll(".prog-edit-btn").forEach(btn => {
      btn.onclick = () => {
        const item = items.find(i => i.id === btn.dataset.id);
        if (!item) return;
        document.getElementById("prog-id").value       = item.id;
        document.getElementById("prog-nombre").value   = item.nombre;
        document.getElementById("prog-logo").value     = item.logoUrl || "";
        document.getElementById("prog-ig").value       = item.instagram || "";
        document.getElementById("prog-cafecito").value = item.cafecito || "";
        document.getElementById("prog-mp").value       = item.mercadopago || "";
        document.getElementById("prog-alias").value    = item.aliasMP || "";
        document.getElementById("prog-mp-qr").value     = item.mpQrImageUrl || "";
        document.getElementById("prog-form-title").textContent = "Editar programa";
        document.getElementById("prog-save").textContent = "Actualizar";
        document.getElementById("prog-save").scrollIntoView({ behavior: "smooth", block: "center" });
      };
    });

    listEl.querySelectorAll(".prog-del-btn").forEach(btn => {
      btn.onclick = async () => {
        if (!confirm("¿Quitar este programa?")) return;
        await fetch("/api/admin/programas-canal/delete", {
          method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" },
          body: JSON.stringify({ id: btn.dataset.id })
        });
        renderList();
      };
    });
  }

  function resetForm() {
    ["prog-id","prog-nombre","prog-logo","prog-ig","prog-cafecito","prog-mp","prog-alias","prog-mp-qr"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    document.getElementById("prog-form-title").textContent = "Nuevo programa";
    document.getElementById("prog-save").textContent = "Guardar programa";
  }

  document.getElementById("prog-save").onclick = async () => {
    const nombre = document.getElementById("prog-nombre").value.trim();
    if (!nombre) { alert("El nombre del programa es obligatorio."); return; }
    const payload = {
      id:          document.getElementById("prog-id").value || undefined,
      nombre,
      logoUrl:     document.getElementById("prog-logo").value.trim(),
      instagram:   document.getElementById("prog-ig").value.trim(),
      cafecito:    document.getElementById("prog-cafecito").value.trim().replace(/^@/, ""),
      mercadopago: document.getElementById("prog-mp").value.trim(),
      aliasMP:     document.getElementById("prog-alias").value.trim(),
      mpQrImageUrl: document.getElementById("prog-mp-qr").value.trim()
    };
    const res = await fetch("/api/admin/programas-canal", {
      method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window._csrfToken || "" },
      body: JSON.stringify(payload)
    });
    if (res.ok) { resetForm(); renderList(); }
    else { const d = await res.json().catch(()=>({})); alert(d.error || "Error al guardar."); }
  };

  document.getElementById("prog-reset").onclick = resetForm;
  renderList();
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────
async function initAdminTools() {
  initPagosYPlanes();
  initProgramasCanal();
  initPageControl();

  buildContentManager({
    panelId:   "podcasts-admin-panel",
    title:     "🎙️ Gestión de Podcasts",
    apiGet:    "/api/podcasts",
    apiPost:   "/api/admin/podcasts",
    apiDelete: "/api/admin/podcasts/delete",
    embedLabel: "Link o embed de Spotify"
  });

  buildContentManager({
    panelId:   "musica-admin-panel",
    title:     "🎵 Gestión de Playlists de Música",
    apiGet:    "/api/musica",
    apiPost:   "/api/admin/musica",
    apiDelete: "/api/admin/musica/delete",
    embedLabel: "Link de playlist de Spotify"
  });

  initTextEditor();
}
