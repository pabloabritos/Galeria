/**
 * Datos estáticos para entorno de desarrollo.
 * Activar con USE_MOCK_DATA=true en .env
 *
 * Cada objeto replica EXACTAMENTE la estructura que el endpoint real devuelve
 * al frontend, para que el UI funcione sin consumir cuota de la API de YouTube.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockVideoItem(videoId, title, daysAgo = 0) {
  return {
    kind: "youtube#searchResult",
    etag: "mock",
    id: { kind: "youtube#video", videoId },
    snippet: {
      publishedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      channelId: "UCmockGaleria000000000000",
      title,
      description: "[MOCK] Contenido de prueba — modo desarrollo activo. No se consumió cuota.",
      thumbnails: {
        default: { url: "https://placehold.co/120x90/0d0d1a/ffb703?text=MOCK", width: 120, height: 90 },
        medium:  { url: "https://placehold.co/320x180/0d0d1a/ffb703?text=MOCK", width: 320, height: 180 },
        high:    { url: "https://placehold.co/480x360/0d0d1a/ffb703?text=MOCK", width: 480, height: 360 }
      },
      channelTitle: "Galeria [MOCK]",
      liveBroadcastContent: "none"
    }
  };
}

function mockSearchResponse(items) {
  return { kind: "youtube#searchListResponse", etag: "mock", regionCode: "AR", pageInfo: { totalResults: items.length, resultsPerPage: items.length }, items };
}

// ─── Respuestas por endpoint ──────────────────────────────────────────────────

/** /api/home-stats — payload YA procesado por el servidor */
const HOME_STATS = {
  metrics: {
    subscribers:       "1.4K",
    views:             "52K",
    hours:             "4.1K",
    videos:            "48",
    playlistVideosReal:"12"
  },
  live:      { active: false, data: null },
  calendar:  { hasUpcoming: true,  data: { title: "[MOCK] Próximo estreno de prueba", publishedAt: new Date(Date.now() + 2 * 86400000).toISOString() } },
  community: { interactions: "2.3K" }
};

/** /api/youtube/live — formato raw youtube#searchListResponse */
const YOUTUBE_LIVE = mockSearchResponse([]); // sin directo activo

/** /api/youtube/past-lives */
const YOUTUBE_PAST_LIVES = mockSearchResponse([
  mockVideoItem("mock_live_1", "[MOCK] Directo pasado — La Posta ep.14", 3),
  mockVideoItem("mock_live_2", "[MOCK] Directo pasado — El Enmascarado en vivo", 10)
]);

/** /api/youtube/upcoming — incluye scheduledStartTime (campo enriquecido por el servidor) */
const _upcomingItem = mockVideoItem("mock_upcoming_1", "[MOCK] Próximo estreno programado", -2);
_upcomingItem.scheduledStartTime = new Date(Date.now() + 2 * 86400000).toISOString(); // en 2 días
_upcomingItem.snippet.thumbnails.maxres = { url: "https://placehold.co/1280x720/0d0d1a/ffb703?text=PROXIMO", width: 1280, height: 720 };
const YOUTUBE_UPCOMING = mockSearchResponse([_upcomingItem]);

/** /api/youtube/playlists — formato raw youtube#playlistListResponse */
const YOUTUBE_PLAYLISTS = {
  kind: "youtube#playlistListResponse",
  etag: "mock",
  pageInfo: { totalResults: 2, resultsPerPage: 25 },
  items: [
    {
      kind: "youtube#playlist", etag: "mock",
      id: "PLmockEnmascarado0000000000",
      snippet: {
        publishedAt: "2024-01-01T00:00:00Z",
        channelId: "UCmockGaleria000000000000",
        title: "[MOCK] El Enmascarado",
        description: "Playlist de prueba",
        thumbnails: { medium: { url: "https://placehold.co/320x180/0d0d1a/ffb703?text=Enmascarado" } },
        channelTitle: "Galeria [MOCK]"
      },
      contentDetails: { itemCount: 8 }
    },
    {
      kind: "youtube#playlist", etag: "mock",
      id: "PLmockLaPosta0000000000000",
      snippet: {
        publishedAt: "2024-01-01T00:00:00Z",
        channelId: "UCmockGaleria000000000000",
        title: "[MOCK] La Posta",
        description: "Playlist de prueba",
        thumbnails: { medium: { url: "https://placehold.co/320x180/0d0d1a/36d1ff?text=LaPosta" } },
        channelTitle: "Galeria [MOCK]"
      },
      contentDetails: { itemCount: 6 }
    }
  ]
};

/** /api/youtube/latest — formato raw youtube#searchListResponse */
const YOUTUBE_LATEST = mockSearchResponse([
  mockVideoItem("mock_vid_1", "[MOCK] EL ENMASCARADO — Cap. 5",  1),
  mockVideoItem("mock_vid_2", "[MOCK] LA POSTA — Ep. 23",        4),
  mockVideoItem("mock_vid_3", "[MOCK] Short de El Enmascarado",   6),
  mockVideoItem("mock_vid_4", "[MOCK] EL ENMASCARADO — Cap. 4",  8),
  mockVideoItem("mock_vid_5", "[MOCK] Behind the scenes",        12)
]);

/** /api/youtube/normal — formato { items: [...] } (ya filtrado, sin shorts) */
const YOUTUBE_NORMAL = {
  items: [
    mockVideoItem("mock_vid_1", "[MOCK] EL ENMASCARADO — Cap. 5",  1),
    mockVideoItem("mock_vid_2", "[MOCK] LA POSTA — Ep. 23",        4),
    mockVideoItem("mock_vid_4", "[MOCK] EL ENMASCARADO — Cap. 4",  8),
    mockVideoItem("mock_vid_5", "[MOCK] Behind the scenes",       12)
  ]
};

/** Conteos de playlists para el panel admin (obtenerConteosDePlaylists) */
const PLAYLIST_COUNTS = {
  "PLmockEnmascarado0000000000": 8,
  "PLmockLaPosta0000000000000":  6
};

/** /api/youtube/video-semana */
const VIDEO_SEMANA = {
  videoId:     "mock_vid_1",
  title:       "[MOCK] EL ENMASCARADO — Cap. 5 — El episodio que todo el mundo vio",
  thumbnail:   "https://placehold.co/320x180/0d0d1a/ffb703?text=VIDEO+SEMANA",
  views:       "3.2K",
  programa:    "El Enmascarado",
  publishedAt: new Date(Date.now() - 2 * 86400000).toISOString()
};

module.exports = {
  HOME_STATS,
  YOUTUBE_LIVE,
  YOUTUBE_PAST_LIVES,
  YOUTUBE_UPCOMING,
  YOUTUBE_PLAYLISTS,
  YOUTUBE_LATEST,
  YOUTUBE_NORMAL,
  PLAYLIST_COUNTS,
  VIDEO_SEMANA
};
