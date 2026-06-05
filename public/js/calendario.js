// ====================== CALENDARIO — YouTube Upcoming & Live ======================

function escHtml(v) {
  return String(v || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getBestThumbnail(thumbnails) {
  return (thumbnails?.maxres || thumbnails?.high || thumbnails?.medium || thumbnails?.default)?.url || "";
}

function formatScheduledDate(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date)) return null;

  const now = new Date();
  const diffMs = date - now;
  const diffH  = Math.round(diffMs / 3600000);
  const diffD  = Math.floor(diffMs / 86400000);

  const days  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const months= ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const dayName = days[date.getDay()];
  const dd   = date.getDate();
  const mon  = months[date.getMonth()];
  const hh   = String(date.getHours()).padStart(2,"0");
  const mm   = String(date.getMinutes()).padStart(2,"0");

  let relative = "";
  if (diffMs < 0) {
    relative = "comenzó hace " + Math.abs(diffH) + "h";
  } else if (diffH < 1) {
    relative = "¡en minutos!";
  } else if (diffH < 24) {
    relative = `en ${diffH}h`;
  } else if (diffD === 1) {
    relative = "mañana";
  } else if (diffD <= 6) {
    relative = `en ${diffD} días`;
  }

  return { full: `${dayName} ${dd} ${mon} · ${hh}:${mm}`, relative };
}

function buildLiveCard(item) {
  const videoId = item.id.videoId;
  const title   = item.snippet.title;
  const thumb   = getBestThumbnail(item.snippet.thumbnails);

  return `
    <a class="cal-card cal-card--live" href="https://www.youtube.com/watch?v=${escHtml(videoId)}"
       target="_blank" rel="noopener" data-search="${escHtml(title.toLowerCase())}">
      ${thumb ? `<div class="cal-thumb"><img src="${escHtml(thumb)}" alt="" loading="lazy" /><span class="cal-live-badge">● EN VIVO</span></div>` : ""}
      <div class="cal-info">
        <span class="cal-status cal-status--live">Transmisión en curso</span>
        <strong class="cal-title">${escHtml(title)}</strong>
        <span class="cal-cta">Ver ahora →</span>
      </div>
    </a>`;
}

function buildUpcomingCard(item) {
  const videoId = item.id.videoId;
  const title   = item.snippet.title;
  const thumb   = getBestThumbnail(item.snippet.thumbnails);
  // scheduledStartTime viene del enriquecimiento del servidor; publishedAt es fallback
  const dateInfo = formatScheduledDate(item.scheduledStartTime || item.snippet.publishedAt);
  const isImminente = item.scheduledStartTime &&
    (new Date(item.scheduledStartTime) - Date.now()) < 3600000;

  return `
    <a class="cal-card ${isImminente ? "cal-card--soon" : ""}"
       href="https://www.youtube.com/watch?v=${escHtml(videoId)}"
       target="_blank" rel="noopener" data-search="${escHtml(title.toLowerCase())}">
      ${thumb ? `<div class="cal-thumb"><img src="${escHtml(thumb)}" alt="" loading="lazy" /></div>` : ""}
      <div class="cal-info">
        <span class="cal-status">${isImminente ? "⚡ Próximo a comenzar" : "Programado"}</span>
        <strong class="cal-title">${escHtml(title)}</strong>
        ${dateInfo ? `
          <time class="cal-time" datetime="${escHtml(item.scheduledStartTime || "")}">
            ${escHtml(dateInfo.full)}
            ${dateInfo.relative ? `<span class="cal-relative">${escHtml(dateInfo.relative)}</span>` : ""}
          </time>` : ""}
        <span class="cal-cta">Ver en YouTube →</span>
      </div>
    </a>`;
}

async function loadCalendar() {
  const container = document.querySelector(".schedule-list");
  if (!container) return;

  container.innerHTML = `<p class="cal-loading">Sincronizando con YouTube…</p>`;

  try {
    // Fetch en paralelo: live en curso + próximos
    const [liveRes, upcomingRes] = await Promise.all([
      fetch("/api/youtube/live").then(r => r.json()).catch(() => ({ items: [] })),
      fetch("/api/youtube/upcoming").then(r => r.json()).catch(() => ({ items: [] }))
    ]);

    const liveItems     = liveRes.items     || [];
    const upcomingItems = upcomingRes.items || [];

    if (!liveItems.length && !upcomingItems.length) {
      container.innerHTML = `
        <div class="cal-empty">
          <p>No hay transmisiones programadas por el momento.</p>
          <small>Sincronizado con YouTube Studio</small>
        </div>`;
      return;
    }

    const liveHtml     = liveItems.map(buildLiveCard).join("");
    const upcomingHtml = upcomingItems.map(buildUpcomingCard).join("");
    container.innerHTML = liveHtml + upcomingHtml;

  } catch (err) {
    console.error("Error cargando el calendario:", err);
    container.innerHTML = `
      <div class="cal-empty">
        <p>No se pudo sincronizar el calendario.</p>
        <small>Intentá recargar la página.</small>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", loadCalendar);
