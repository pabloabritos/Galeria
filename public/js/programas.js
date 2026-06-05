// ====================== YOUTUBE PLAYLISTS - PROGRAMAS ======================

async function loadChannelPlaylists() {
    const gridContainer = document.querySelector('[data-program-grid]');
    if (!gridContainer) return;

    try {
        const response = await fetch('/api/youtube/playlists');
        if (!response.ok) throw new Error('Error al obtener playlists');
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            gridContainer.innerHTML = `<p style="color:#aaa; text-align:center; width:100%; padding:40px;">No se encontraron programas disponibles.</p>`;
            return;
        }

        gridContainer.innerHTML = data.items.map(playlist => {
            const title = playlist.snippet.title;
            const titleLower = title.toLowerCase();
            const description = playlist.snippet.description || "";
            const thumbnail = playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url || 'assets/img/galeria-logo.png';
            const videoCount = playlist.contentDetails?.itemCount || 0;
            const playlistId = playlist.id;

            // =================================================================
            // CONFIGURACIÓN DE FORMATOS POR PROGRAMA (OPCIÓN HÍBRIDA)
            // Definimos qué formatos maneja cada show de tu canal
            // =================================================================
            let categories = [];

            if (titleLower.includes("posta")) {
                // Supongamos que La Posta tiene videos tradicionales y transmisiones en vivo
                categories = ["uploaded", "live"]; 
            } else if (titleLower.includes("enmascarado")) {
                // Supongamos que El Enmascarado tiene videos editados y shorts
                categories = ["uploaded", "shorts"];
            } else {
                // Por defecto para cualquier otra playlist nueva
                categories = ["uploaded"];
            }

            // Convertimos el array a un string separado por espacios: "uploaded live"
            const categoryString = categories.join(" ");

            // Crear palabras clave para el buscador
            const searchKeywords = `${title} ${categoryString} ${description}`.toLowerCase();

            return `
                <a class="program-card" 
                   href="https://www.youtube.com/playlist?list=${playlistId}" 
                   target="_blank"
                   data-category="${categoryString}" 
                   data-search="${searchKeywords}">
                    <span class="program-poster" style="background-image: url('${thumbnail}'); background-size: cover; background-position: center;"></span>
                    <span class="program-details">
                        <strong>${title}</strong>
                        <small>${videoCount} ${videoCount === 1 ? 'video' : 'videos'}</small>
                    </span>
                </a>
            `;
        }).join('');

        // Forzamos el recálculo de filtros de app.js
        if (typeof applySearchAndFilter === 'function') {
            applySearchAndFilter();
        }

    } catch (error) {
        console.error("Error cargando programas:", error);
        gridContainer.innerHTML = `
            <p style="color:#aaa; text-align:center; width:100%; padding:40px;">
                No se pudieron cargar los programas.<br>
                <small>Intenta recargar la página más tarde.</small>
            </p>
        `;
    }
}

document.addEventListener('DOMContentLoaded', loadChannelPlaylists);