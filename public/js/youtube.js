// ====================== YOUTUBE - HOME ======================

async function getLatestNormalVideo() {
    try {
        const response = await fetch('/api/youtube/normal');
        if (!response.ok) throw new Error('Error servidor');
        const data = await response.json();
        
        // Validación para evitar romper el código si la lista viene vacía
        if (data.items && data.items.length > 0) {
            return data.items[0]; // Tomamos el primero (el más reciente real y largo)
        }
        return null;
    } catch (error) {
        console.error("Error hero:", error);
        return null;
    }
}

async function getLatestVideos(maxResults = 12) {
    try {
        const response = await fetch(`/api/youtube/latest?maxResults=${maxResults}`);
        if (!response.ok) throw new Error('Error servidor');
        const data = await response.json();
        return data.items || [];
    } catch (error) {
        console.error("Error:", error);
        return [];
    }
}

// NUEVA FUNCIÓN: Trae estadísticas y estado de señales desde el backend
async function loadHomeStats() {
    try {
        const response = await fetch('/api/home-stats');
        if (!response.ok) throw new Error('Error al solicitar métricas');
        const data = await response.json();

        // 1. Inyectar números en la grilla de métricas generales
        if (data.metrics) {
            const subsEl = document.getElementById('stat-subs');
            const viewsEl = document.getElementById('stat-views');
            const hoursEl = document.getElementById('stat-hours');
            const videosEl = document.getElementById('stat-videos');

            if (subsEl) subsEl.textContent = data.metrics.subscribers || '--';
            if (viewsEl) viewsEl.textContent = data.metrics.views || '--';
            if (hoursEl) hoursEl.textContent = data.metrics.hours || '--';
            if (videosEl) videosEl.textContent = data.metrics.videos || '--';
        }

        // 2. Modificar la tarjeta de EN VIVO de forma dinámica
        const cardLive = document.getElementById('card-live');
        const liveStatusText = document.getElementById('live-status-text');
        const liveStatusDesc = document.getElementById('live-status-desc');

        if (cardLive) {
            if (data.live && data.live.active) {
                // Si el canal está transmitiendo en vivo: encendemos la tarjeta visualmente
                cardLive.style.border = "2px solid #de3333";
                cardLive.style.boxShadow = "0 0 15px rgba(222, 51, 51, 0.4)";
                if (liveStatusText) liveStatusText.innerHTML = `<span style="color: #de3333; animation: pulse 1.5s infinite;">🔴 ¡EN VIVO AHORA!</span>`;
                if (liveStatusDesc) liveStatusDesc.innerHTML = `<strong>${data.live.data.title}</strong><br><a href="vivo.html" style="color: #ffb703; text-decoration: underline; display: inline-block; margin-top: 8px;">Unirse a la transmisión</a>`;
            } else {
                // Si está apagado
                if (liveStatusText) liveStatusText.textContent = "Sin transmisión activa";
                if (liveStatusDesc) liveStatusDesc.textContent = "Cuando haya directo, este bloque abre el acceso principal.";
            }
        }

        // 3. Modificar la tarjeta de CALENDARIO (Próximo estreno)
        const calendarDate = document.getElementById('calendar-next-date');
        const calendarTitle = document.getElementById('calendar-next-title');

        if (data.calendar) {
            if (data.calendar.hasUpcoming && data.calendar.data) {
                const cal = data.calendar.data;
                // Preferir scheduledStartTime (fecha real del evento); fallback a publishedAt
                const isoDate = cal.scheduledStartTime || cal.publishedAt;
                const eventDate = new Date(isoDate);
                const isValid = !isNaN(eventDate.getTime());

                if (isValid) {
                    const now = new Date();
                    const diffH = Math.round((eventDate - now) / 3600000);
                    const diffD = Math.floor((eventDate - now) / 86400000);

                    const days  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                    const months= ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                    const dayName = days[eventDate.getDay()];
                    const dd = eventDate.getDate();
                    const mon = months[eventDate.getMonth()];
                    const hh = String(eventDate.getHours()).padStart(2,'0');
                    const mm = String(eventDate.getMinutes()).padStart(2,'0');

                    let relative = '';
                    if (diffD > 1)       relative = ` (en ${diffD} días)`;
                    else if (diffD === 1) relative = ' (mañana)';
                    else if (diffH > 0)  relative = ` (en ${diffH}h)`;
                    else if (diffH === 0) relative = ' (¡ahora!)';

                    if (calendarDate) calendarDate.textContent = `${dayName} ${dd} ${mon} · ${hh}:${mm}${relative}`;
                } else {
                    if (calendarDate) calendarDate.textContent = 'Próximamente';
                }
                if (calendarTitle) calendarTitle.textContent = `"${cal.title}"`;
            } else {
                if (calendarDate) calendarDate.textContent = 'Sin estrenos programados';
                if (calendarTitle) calendarTitle.textContent = 'Cuando haya un estreno o vivo programado en YouTube, aparecerá aquí.';
            }
        }

        // 4. Inyectar contador de comunidad (Interacciones estimadas)
        const communityCount = document.getElementById('community-interaction-count');
        if (communityCount && data.community) {
            communityCount.textContent = data.community.interactions || '--';
        }

    } catch (error) {
        console.error("Error al pintar las estadísticas en el frontend:", error);
    }
}

function renderHero(video) {
    const container = document.getElementById('hero-video');
    if (!container || !video) return;

    container.innerHTML = `
        <iframe width="100%" height="100%" 
                src="https://www.youtube.com/embed/${video.id.videoId}?modestbranding=1&rel=0" 
                frameborder="0" allowfullscreen style="border:none;"></iframe>
    `;

    const titleEl = document.getElementById('hero-title');
    if (titleEl) titleEl.textContent = video.snippet.title;
    
    const statusEl = document.getElementById('hero-status');
    if (statusEl) statusEl.textContent = "Último estreno";
}

function renderVideos(videos) {
    const container = document.getElementById('youtube-videos');
    if (!container) return;

    container.innerHTML = videos.slice(0, 8).map(video => `
        <div class="video-card" style="background:#1e1e1e; border-radius:8px; overflow:hidden;">
            <a href="https://youtube.com/watch?v=${video.id.videoId}" target="_blank" style="text-decoration:none; color:inherit;">
                <img src="${video.snippet.thumbnails.medium.url}" style="width:100%; display:block;">
                <div style="padding:12px;">
                    <h3 style="margin:0 0 8px 0; font-size:1rem; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${video.snippet.title}</h3>
                    <small style="color:#aaa;">${new Date(video.snippet.publishedAt).toLocaleDateString('es-AR')}</small>
                </div>
            </a>
        </div>
    `).join('');
}

// CONTROLADOR DE INICIALIZACIÓN CENTRAL
document.addEventListener('DOMContentLoaded', async () => {
    // Inyectamos dinámicamente los estilos para el parpadeo de la señal de vivo
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Ejecutamos la consulta de métricas y la carga de videos en paralelo
    Promise.all([
        getLatestNormalVideo(),
        getLatestVideos(12),
        loadHomeStats()
    ]).then(([heroVideo, allVideos]) => {
        if (heroVideo) renderHero(heroVideo);
        if (allVideos && allVideos.length > 0) {
            renderVideos(allVideos);
        } else {
            // Estado vacío: cuota agotada o canal sin videos
            const container = document.getElementById('youtube-videos');
            if (container) {
                container.innerHTML = `
                    <p style="color:#555; text-align:center; grid-column:1/-1; padding:40px 20px; font-size:0.95rem;">
                        Los videos se cargarán en breve.<br>
                        <small style="color:#444;">La cuota de la API de YouTube se renueva a las 00:00 hora del Pacífico.</small>
                    </p>`;
            }
        }
    }).catch(err => {
        console.error("Error en inicialización general:", err);
    });
});