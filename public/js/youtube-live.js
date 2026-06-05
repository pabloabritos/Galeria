// ====================== YOUTUBE LIVE ======================

// Iguala el alto del panel de chat al del frame del player y lo mantiene en resize
function syncChatHeight() {
    const player = document.getElementById('live-player');
    const chat   = document.getElementById('live-chat');
    if (!player || !chat) return;
    const h = player.getBoundingClientRect().height;
    if (h > 0) chat.style.height = h + 'px';
}

function showChatOnline(videoId) {
    const frame     = document.getElementById('youtube-chat');
    const offMsg    = document.getElementById('chat-offline-msg');
    const container = document.getElementById('chat-container');
    if (!frame) return;

    // Cambiar layout del contenedor a block para que el iframe llene el alto
    if (container) {
        container.style.display = 'block';
        container.style.alignItems = '';
        container.style.justifyContent = '';
    }
    if (offMsg) offMsg.style.display = 'none';
    frame.style.display = 'block';
    frame.src = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}`;
}

function showChatOffline() {
    const frame  = document.getElementById('youtube-chat');
    const offMsg = document.getElementById('chat-offline-msg');
    if (frame)  frame.style.display  = 'none';
    if (offMsg) offMsg.style.display = 'block';
}

async function loadLiveOrLatest() {
    const playerContainer = document.getElementById('youtube-live');

    try {
        // 1. ¿Hay transmisión en vivo ahora?
        const liveRes  = await fetch('/api/youtube/live');
        const liveData = await liveRes.json();

        if (liveData.items?.length > 0) {
            const videoId = liveData.items[0].id.videoId;
            if (playerContainer) {
                playerContainer.innerHTML = `
                    <iframe width="100%" height="100%"
                            src="https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0"
                            frameborder="0" allowfullscreen></iframe>`;
            }
            showChatOnline(videoId);
            syncChatHeight();
            return;
        }

        // 2. Mostrar la última transmisión finalizada
        const pastRes  = await fetch('/api/youtube/past-lives');
        const pastData = await pastRes.json();

        if (pastData.items?.length > 0) {
            const videoId = pastData.items[0].id.videoId;
            if (playerContainer) {
                playerContainer.innerHTML = `
                    <iframe width="100%" height="100%"
                            src="https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0"
                            frameborder="0" allowfullscreen></iframe>`;
            }
        } else {
            if (playerContainer) {
                playerContainer.innerHTML = `
                    <p style="color:#aaa; text-align:center; padding:100px 20px;">
                        No hay transmisiones anteriores disponibles.
                    </p>`;
            }
        }

        // Sin live activo → mostrar mensaje en el chat
        showChatOffline();
        syncChatHeight();

    } catch (error) {
        console.error("Error cargando live:", error);
        if (playerContainer) {
            playerContainer.innerHTML = `
                <p style="color:#aaa; text-align:center; padding:100px 20px;">
                    No se pudo cargar el contenido.<br>
                    <small>Intentá recargar la página.</small>
                </p>`;
        }
        showChatOffline();
        syncChatHeight();
    }
}

document.addEventListener('DOMContentLoaded', loadLiveOrLatest);
window.addEventListener('resize', syncChatHeight);