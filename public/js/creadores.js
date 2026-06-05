// ====================== CONTROL DE PANEL DE CREADORES ======================
let _csrfToken = "";
window._csrfToken = "";

async function fetchAndRenderCreatorStats(playlistId, email, sessionData) {
    try {
        // Pasamos el playlistId real en la URL para que el servidor le pregunte a YouTube
        const response = await fetch(`/api/home-stats?playlistId=${playlistId}`);
        if (!response.ok) throw new Error('Error al obtener métricas');
        const data = await response.json();

        const viewsEl = document.getElementById('creator-views');
        const engagementEl = document.getElementById('creator-engagement');
        const videosEl = document.getElementById('creator-videos');

        const rol = sessionData.rol || "creador";

        if (data && data.metrics) {
            // Caso 1: Administradores (Ven el total global del canal)
            if (rol === "admin" || email === "galeriaproducciones@gmail.com") {
                if (viewsEl) viewsEl.textContent = data.metrics.views || '0';
                if (engagementEl) engagementEl.textContent = data.community ? data.community.interactions : '0';
                if (videosEl) videosEl.textContent = data.metrics.videos || '0';
            } else {
                // Caso 2: Creador personalizado (Lógica segmentada basada en impacto)
                let viewsStr = data.metrics.views ? data.metrics.views.toString() : '0';
                let rawViewsStr = viewsStr.replace(/[^0-9.]/g, '');
                let rawViewsNum = parseFloat(rawViewsStr) || 0;
                
                if (viewsStr.includes('M')) rawViewsNum *= 1000000;
                else if (viewsStr.includes('K')) rawViewsNum *= 1000;

                let factorImpacto = parseFloat(sessionData.impacto || 25) / 100; 
                
                // Si YouTube devolvió cantidad real, la usamos; si no, el fallback cargado en JSON
                let videosReales = (data.metrics.playlistVideosReal !== "null" && data.metrics.playlistVideosReal !== "undefined" && data.metrics.playlistVideosReal !== "-1")
                    ? data.metrics.playlistVideosReal 
                    : (sessionData.videosCount || 0);

                const viewsSegmentadas = Math.floor(rawViewsNum * factorImpacto);
                const interaccionesSegmentadas = Math.floor(viewsSegmentadas * 0.045);

                if (viewsEl) viewsEl.textContent = formatLocalNumber(viewsSegmentadas);
                if (engagementEl) engagementEl.textContent = formatLocalNumber(interaccionesSegmentadas);
                if (videosEl) videosEl.textContent = videosReales;
            }
        }
    } catch (error) {
        console.error("Error al renderizar tarjetas:", error);
    }
}

function formatLocalNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function copyTextFrom(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.select();
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand("copy"));
}

// ====================== GESTIÓN DE ADMINISTRACIÓN VISUAL (Fase Multi-Admin) ======================

async function initAdminPanel() {
    const adminPanel = document.getElementById("super-admin-panel");
    if (!adminPanel) return;
    adminPanel.style.display = "block";
    ["sponsor-admin-panel", "pagos-planes-panel", "programas-canal-panel", "page-control-panel",
     "podcasts-admin-panel", "musica-admin-panel", "textos-admin-panel"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "block";
    });

    renderCreadoresTable();
    renderBannersTable();
    if (typeof initAdminTools === "function") initAdminTools();

    document.getElementById("btn-save-creador").onclick = async () => {
        const email = document.getElementById("admin-new-email").value;
        const programa = document.getElementById("admin-new-programa").value;
        const playlistId = document.getElementById("admin-new-playlist").value;
        const impacto = document.getElementById("admin-new-impacto").value;
        const rol = document.getElementById("admin-new-rol").value;

        if(!email || !programa) return alert("Por favor ingresa al menos el Email y el Nombre de Programa.");

        const res = await fetch("/api/admin/creadores", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": _csrfToken },
            body: JSON.stringify({
                email,
                programa,
                playlistId: playlistId || "N/A",
                impacto,
                rol
            })
        });

        if(res.ok) {
            alert("¡Usuario registrado y configurado con éxito!");
            document.getElementById("admin-new-email").value = "";
            document.getElementById("admin-new-programa").value = "";
            document.getElementById("admin-new-playlist").value = "";
            renderCreadoresTable();
        } else {
            alert("Error al guardar.");
        }
    };

    const saveBannerBtn = document.getElementById("btn-save-banner");
    if (saveBannerBtn) {
        saveBannerBtn.onclick = saveBanner;
    }
    const resetBannerBtn = document.getElementById("btn-reset-banner");
    if (resetBannerBtn) {
        resetBannerBtn.onclick = resetBannerForm;
    }
}

async function renderCreadoresTable() {
    const res = await fetch("/api/admin/creadores");
    if (!res.ok) {
        console.error("No se pudo cargar la tabla de creadores:", res.status);
        return;
    }
    const creadores = await res.json();
    const tbody = document.querySelector("#table-creadores tbody");
    if(!tbody) return;
    tbody.innerHTML = "";

    Object.keys(creadores).forEach(email => {
        const user = creadores[email];
        const isMaster = email === "galeriaproducciones@gmail.com";
        const playlistId = user.playlistId || "N/A";
        const videoCount = playlistId !== "N/A"
            ? (user.videosCountAuto !== null && user.videosCountAuto !== undefined ? user.videosCountAuto : "Sin sync")
            : "-";
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #111";
        tr.style.fontSize = "0.9rem";
        
        tr.innerHTML = `
            <td style="padding: 12px 8px;">
                <strong>${escapeHtml(user.programa)}</strong>
                ${user.rol === 'admin' ? '<span style="background:#ffb703; color:#000; font-size:0.7rem; padding:2px 5px; border-radius:3px; margin-left:5px; font-weight:bold;">ADMIN</span>' : ''}<br>
                <span style="color:#666; font-size:0.8rem;">${escapeHtml(email)}</span>
            </td>
            <td style="padding: 12px 8px; text-align:center; color:#fff;">${escapeHtml(videoCount)}</td>
            <td style="padding: 12px 8px; text-align:center; color:#ffb703;">${playlistId !== 'N/A' ? (user.impacto || 0) + '%' : '-'}</td>
            <td style="padding: 12px 8px; text-align:center;">
                ${user.rol !== 'admin' && !isMaster
                    ? `<button class="toggle-publicar-btn"
                         data-email="${escapeHtml(email)}"
                         data-puede="${user.puedePublicar ? 'true' : 'false'}"
                         style="background:${user.puedePublicar ? '#2e7d32' : '#555'}; border:none; color:#fff; padding:4px 9px; border-radius:4px; cursor:pointer; font-size:0.75rem;">
                         ${user.puedePublicar ? '✅ Publica' : '🔒 Solo oculto'}
                       </button>`
                    : '<small style="color:#666;">–</small>'}
            </td>
            <td style="padding: 12px 8px; text-align:right;">
                ${!isMaster ? `<button class="delete-user-btn" data-email="${escapeHtml(email)}" style="background:#de3333; border:none; color:white; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Quitar</button>` : '<small style="color:#ffb703; font-weight:bold;">PROPIETARIO</small>'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll(".toggle-publicar-btn").forEach(btn => {
        btn.onclick = async () => {
            const emailTarget = btn.getAttribute("data-email");
            const current = btn.getAttribute("data-puede") === "true";
            const r = await fetch("/api/admin/creadores/set-publicar", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": _csrfToken },
                body: JSON.stringify({ email: emailTarget, puedePublicar: !current })
            });
            if (r.ok) renderCreadoresTable();
            else alert("Error al actualizar permisos de publicación.");
        };
    });

    document.querySelectorAll(".delete-user-btn").forEach(btn => {
        btn.onclick = async (e) => {
            const emailToDelete = e.target.getAttribute("data-email");
            if(confirm(`¿Seguro que querés quitar el acceso a ${emailToDelete}?`)) {
                await fetch("/api/admin/creadores/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-CSRF-Token": _csrfToken },
                    body: JSON.stringify({ email: emailToDelete })
                });
                renderCreadoresTable();
            }
        };
    });
}

async function saveBanner() {
    const payload = {
        id: document.getElementById("banner-id").value,
        title: document.getElementById("banner-title").value,
        sponsor: document.getElementById("banner-sponsor").value,
        body: document.getElementById("banner-body").value,
        imageUrl: document.getElementById("banner-image").value,
        linkUrl: document.getElementById("banner-link").value,
        placement: document.getElementById("banner-placement").value,
        durationDays: document.getElementById("banner-duration").value,
        active: document.getElementById("banner-active").checked
    };

    const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": _csrfToken },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        resetBannerForm();
        renderBannersTable();
        alert("Banner guardado.");
    } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo guardar el banner.");
    }
}

function resetBannerForm() {
    ["banner-id", "banner-title", "banner-sponsor", "banner-body", "banner-image", "banner-link"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });
    const placement = document.getElementById("banner-placement");
    const duration = document.getElementById("banner-duration");
    const active = document.getElementById("banner-active");
    const button = document.getElementById("btn-save-banner");
    if (placement) placement.value = "home";
    if (duration) duration.value = "30";
    if (active) active.checked = true;
    if (button) button.textContent = "Guardar banner";
}

function editBanner(banner) {
    document.getElementById("banner-id").value = banner.id || "";
    document.getElementById("banner-title").value = banner.title || "";
    document.getElementById("banner-sponsor").value = banner.sponsor || "";
    document.getElementById("banner-body").value = banner.body || "";
    document.getElementById("banner-image").value = banner.imageUrl || "";
    document.getElementById("banner-link").value = banner.linkUrl || "";
    document.getElementById("banner-placement").value = banner.placement || "home";
    document.getElementById("banner-duration").value = String(banner.durationDays ?? "30");
    document.getElementById("banner-active").checked = banner.active !== false;
    document.getElementById("btn-save-banner").textContent = "Actualizar banner";
    document.getElementById("sponsor-admin-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatBannerExpiry(banner) {
    if (!banner.endsAt) return "Sin vencimiento";
    const date = new Date(banner.endsAt);
    if (Number.isNaN(date.getTime())) return "Sin vencimiento";
    return `Hasta ${date.toLocaleDateString("es-AR")}`;
}

async function renderBannersTable() {
    const container = document.getElementById("banners-table");
    if (!container) return;

    const res = await fetch("/api/admin/banners");
    if (!res.ok) return;
    const banners = await res.json();

    if (!banners.length) {
        container.innerHTML = `<p style="color:#777;">Todavía no hay banners cargados.</p>`;
        return;
    }

    container.innerHTML = banners.map((banner) => `
        <article style="border:1px solid #222; border-radius:8px; padding:14px; background:#111;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                <div>
                    <strong style="color:#fff;">${escapeHtml(banner.title)}</strong>
                    <p style="margin:5px 0; color:#aaa;">${escapeHtml(banner.sponsor || "Sin sponsor")} · ${escapeHtml(banner.placement || "home")} · ${banner.active === false ? "Pausado" : "Activo"} · ${escapeHtml(formatBannerExpiry(banner))}</p>
                    <small style="color:#666;">${escapeHtml(banner.linkUrl)}</small>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                    <button class="edit-banner-btn" data-id="${escapeHtml(banner.id)}" style="background:#333; border:none; color:white; padding:6px 10px; border-radius:4px; cursor:pointer;">Editar</button>
                    <button class="delete-banner-btn" data-id="${escapeHtml(banner.id)}" style="background:#de3333; border:none; color:white; padding:6px 10px; border-radius:4px; cursor:pointer;">Quitar</button>
                </div>
            </div>
        </article>
    `).join("");

    document.querySelectorAll(".edit-banner-btn").forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.getAttribute("data-id");
            const banner = banners.find(item => item.id === id);
            if (banner) editBanner(banner);
        };
    });

    document.querySelectorAll(".delete-banner-btn").forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.target.getAttribute("data-id");
            if (!confirm("¿Quitar este banner?")) return;
            await fetch("/api/admin/banners/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": _csrfToken },
                body: JSON.stringify({ id })
            });
            renderBannersTable();
        };
    });
}

// ====================== CONTROL DE SESIÓN GENERAL ======================

async function checkLoginState() {
    const studioForm = document.querySelector('.studio-form');
    const playlistSelect = document.getElementById("playlistSelector");
    const loginButton = document.querySelector('.google-auth-btn');
    const heroText = document.querySelector('.page-hero p[data-i18n="creatorPageText"]');
    const metricsPanel = document.getElementById('creator-metrics-panel');

    let sessionObject = {};
    try {
        const response = await fetch("/api/session");
        if (response.ok) {
            const sessionPayload = await response.json();
            sessionObject = sessionPayload.user || {};
            _csrfToken = sessionPayload.csrfToken || "";
            window._csrfToken = _csrfToken;
        }
    } catch (error) {
        console.error("Error consultando sesión:", error);
    }

    if (sessionObject.email) {
        if (metricsPanel) metricsPanel.style.opacity = "1";
        if (studioForm) {
            const inputs = studioForm.querySelectorAll('input, select, button');
            inputs.forEach(el => el.disabled = false);
            studioForm.style.opacity = "1";
        }

        const emailUsuario = sessionObject.email;
        const idPlaylist = sessionObject.playlistId;
        const nombrePrograma = sessionObject.programa || "Creador";
        const esAdmin = sessionObject.rol === "admin";
        const puedePublicar = esAdmin || Boolean(sessionObject.puedePublicar);

        // Ocultar opción "Público" para creadores no promovidos
        const privacySelect = studioForm ? studioForm.querySelector('select[name="privacyStatus"]') : null;
        if (privacySelect) {
            const publicOption = privacySelect.querySelector('option[value="public"]');
            if (publicOption) {
                if (!puedePublicar) {
                    publicOption.disabled = true;
                    publicOption.textContent = "Público (requiere promoción de admin)";
                    if (privacySelect.value === "public") privacySelect.value = "unlisted";
                } else {
                    publicOption.disabled = false;
                    publicOption.textContent = "Público";
                }
            }
        }

        if (heroText) {
            heroText.innerHTML = `👋 ¡Hola! Estás autenticado como <strong>${emailUsuario}</strong>.<br>Programa: <strong>${nombrePrograma}</strong>.`;
        }

        if (esAdmin) {
            initAdminPanel();
        }

        // --- LÓGICA DINÁMICA DE ASIGNACIÓN DE PLAYLISTS POR ROL ---
        if (playlistSelect) {
            playlistSelect.innerHTML = ""; // Limpiamos opciones fijas previas

            if (esAdmin) {
                // 👑 Si es ADMINISTRADOR: Puede ver y elegir cualquier playlist global del canal
                const opcionesPlaylistsGlobales = [
                    { id: "PL_principal", nombre: "Galería Principal" },
                    { id: "PL_enmascarado", nombre: "El Enmascarado" },
                    { id: "PL_laposta", nombre: "La Posta" }
                ];

                opcionesPlaylistsGlobales.forEach(pl => {
                    const opt = document.createElement("option");
                    opt.value = pl.id;
                    opt.textContent = pl.nombre;
                    playlistSelect.appendChild(opt);
                });
                
                playlistSelect.disabled = false; // Desbloqueado para admins
                console.log("[Permisos] Administrador detectado: Selector de playlists desbloqueado.");
            } else {
                // 👤 Si es CREADOR ESTÁNDAR: Solo ve y puede usar su propia lista asignada
                const opt = document.createElement("option");
                opt.value = idPlaylist || "N/A";
                opt.textContent = nombrePrograma || "Mi Programa Asignado";
                playlistSelect.appendChild(opt);
                
                playlistSelect.disabled = true; // Bloqueado para creadores estándar
                console.log(`[Permisos] Creador restringido a su programa: ${nombrePrograma}`);
            }
        }

        if (loginButton) {
            loginButton.textContent = "Cerrar Sesión";
            loginButton.href = "#";
            loginButton.style.background = "#de3333";
            loginButton.style.color = "#ffffff";
            loginButton.onclick = (e) => {
                e.preventDefault();
                fetch("/api/auth/logout", {
                    method: "POST",
                    headers: { "X-CSRF-Token": _csrfToken }
                }).finally(() => {
                    window.location.href = "/creadores.html";
                });
            };
        }

        fetchAndRenderCreatorStats(idPlaylist, emailUsuario, sessionObject);
    } else {
        document.cookie = "creador_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        if (metricsPanel) metricsPanel.style.opacity = "0.25";
        if (studioForm) {
            const inputs = studioForm.querySelectorAll('input, select, button');
            inputs.forEach(el => el.disabled = true);
            studioForm.style.opacity = "0.5";
        }
    }
}

// ====================== INTERCEPTOR ASÍNCRONO DE ENVÍO (FETCH) ======================
document.addEventListener("DOMContentLoaded", () => {
  // Ejecutamos primero la verificación del estado de login
  checkLoginState();

  const form = document.querySelector(".studio-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // Evita que la página salte al JSON blanco

    // Seleccionamos el botón para cambiar su estado visual
    const submitBtn = form.querySelector("button[type='submit']");
    const originalText = submitBtn.innerText;
    
    // Cambiamos el texto para avisar que el "tubo" está procesando datos pesados
    submitBtn.disabled = true;
    submitBtn.innerText = "Transmitiendo a YouTube... Por favor, no cierres la pestaña.";
    submitBtn.style.background = "linear-gradient(45deg, #ffb703, #fb8500)";

    // Empaquetamos automáticamente todos los archivos (video, miniatura) y textos del formulario
    const formData = new FormData(form);
    formData.set("csrfToken", _csrfToken);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData // Envía el stream multipart directo al backend
      });

      const result = await response.json();

      if (result.success) {
        const thumbnailNotice = result.thumbnailMessage ? `\n\nMiniatura: ${result.thumbnailMessage}` : "";
        const youtubeNotice = result.youtubePostMessage ? `\n\nYouTube: ${result.youtubePostMessage}` : "";
        alert("¡Éxito! " + result.message + thumbnailNotice + youtubeNotice);

        const resultPanel = document.getElementById("upload-result-panel");
        const instagramOutput = document.getElementById("instagram-copy-output");
        const communityOutput = document.getElementById("community-copy-output");
        if (resultPanel) resultPanel.style.display = "block";
        if (instagramOutput) instagramOutput.value = result.instagramCopy || "";
        if (communityOutput) communityOutput.value = result.communityCopy || "";

        form.reset(); // Limpiamos los campos y los archivos seleccionados
        
        // Es necesario restablecer el selector de playlist tras limpiar el formulario
        checkLoginState();
      } else {
        alert("Error en la subida: " + (result.error || "Inténtalo de nuevo."));
      }
    } catch (error) {
      console.error("Error en la conexión del stream:", error);
      alert("Hubo un problema de red al transmitir el video.");
    } finally {
      // Restauramos el botón a su estado original
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
      submitBtn.style.background = ""; 
    }
  });

  document.getElementById("btn-copy-instagram")?.addEventListener("click", () => copyTextFrom("instagram-copy-output"));
  document.getElementById("btn-copy-community")?.addEventListener("click", () => copyTextFrom("community-copy-output"));
});
