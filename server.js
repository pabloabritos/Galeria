const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Busboy = require("busboy");
const { port, host } = require("./src/config");
const { handler } = require("./src/staticHandler");
require("dotenv").config();
const axios = require("axios");

const { google } = require("googleapis");
const { cache, TTL } = require("./src/cache");
const mock = require("./src/mock-data");

const USE_MOCK = process.env.USE_MOCK_DATA === "true";
if (USE_MOCK) console.log("[Mock] USE_MOCK_DATA=true — los endpoints de YouTube devuelven datos estáticos.");

// Fail fast if required environment variables are missing
const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "YOUTUBE_API_KEY",
  "YOUTUBE_CHANNEL_ID",
];
const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`[Config] Variables de entorno faltantes: ${missingVars.join(", ")}`);
  console.error("[Config] Copiá .env.example a .env y completá los valores.");
  process.exit(1);
}

const JSON_PATH = path.join(__dirname, "creadores.json");
const BANNERS_PATH = path.join(__dirname, "sponsor-banners.json");
const SITE_CONFIG_PATH = path.join(__dirname, "site-config.json");
const PODCASTS_PATH = path.join(__dirname, "podcasts-data.json");
const MUSICA_PATH          = path.join(__dirname, "musica-data.json");
const PROGRAMAS_CANAL_PATH = path.join(__dirname, "programas-canal.json");
const ENV_PATH = path.join(__dirname, ".env");
const sesionesActivas = new Map();
let masterChannelVerification = null;

// Configuración base de OAuth2 para interactuar con la API de YouTube
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Funciones auxiliares para el JSON dinámico
function leerCreadores() {
  try {
    if (!fs.existsSync(JSON_PATH)) {
      fs.writeFileSync(JSON_PATH, JSON.stringify({}));
    }
    const data = fs.readFileSync(JSON_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error leyendo creadores.json:", err);
    return {};
  }
}

function guardarCreadores(data) {
  try {
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing creadores.json:", err);
    return false;
  }
}

// ─── Helpers genéricos para archivos JSON simples ───────────────────────────
function leerJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`Error leyendo ${path.basename(filePath)}:`, err.message);
    return defaultValue;
  }
}

function guardarJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error(`Error guardando ${path.basename(filePath)}:`, err.message);
    return false;
  }
}

const SITE_CONFIG_DEFAULT = {
  pages: {
    vivo: { enabled: true }, programas: { enabled: true },
    podcasts: { enabled: true }, musica: { enabled: true },
    calendario: { enabled: true }, sponsors: { enabled: true }, sobre: { enabled: true }
  },
  textos: {}
};

function leerBanners() {
  try {
    if (!fs.existsSync(BANNERS_PATH)) {
      fs.writeFileSync(BANNERS_PATH, JSON.stringify([], null, 2));
    }
    const data = fs.readFileSync(BANNERS_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error leyendo sponsor-banners.json:", err);
    return [];
  }
}

function guardarBanners(data) {
  try {
    fs.writeFileSync(BANNERS_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing sponsor-banners.json:", err);
    return false;
  }
}

function isShort(isoDuration) {
  if (!isoDuration.includes('M') && isoDuration.includes('S')) return true;
  if (isoDuration.includes('M')) {
    const minutes = parseInt(isoDuration.split('T')[1].split('M')[0]);
    if (minutes === 0) return true;
  }
  return false;
}

function formatNumber(num) {
  num = Number(num);
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

function normalizarHashtag(text) {
  return (text || "galeria")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Pool de hashtags rotativos — distintos en cada subida
const HASHTAGS_POOL = [
  "contenidoargentino","creadores","youtube","streaming","produccion",
  "argentina","comunicacion","cultura","entretenimiento","podcast",
  "medios","digital","canal","videoargentino","creadordecontenido",
  "productora","audiovisual","contenido","youtuber","show",
  "entrevista","programa","serie","charla","comunidad"
];
const HASHTAGS_SHORT_POOL = ["shortsvideo","viral","tendencia","clip","momento"];

function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

function buildHashtagsInstagram({ programTag, isShort }) {
  const set = new Set(["galeria", programTag, "lavidamisma"]);
  pickRandom(HASHTAGS_POOL, 9).forEach(h => set.add(h));
  if (isShort) pickRandom(HASHTAGS_SHORT_POOL, 3).forEach(h => set.add(h));
  return [...set].map(h => "#" + h).join(" ");
}

function buildHashtagsComunidad({ programTag, isShort }) {
  const tags = new Set(["galeria", programTag, "lavidamisma"]);
  pickRandom(HASHTAGS_POOL, 2).forEach(h => tags.add(h));
  if (isShort) tags.add("shorts");
  return [...tags].map(h => "#" + h).join(" ");
}

function buildPromotionCopy({ title, videoUrl, programName, isShort }) {
  const programTag    = normalizarHashtag(programName);
  const tagsInstagram = buildHashtagsInstagram({ programTag, isShort });
  const tagsComunidad = buildHashtagsComunidad({ programTag, isShort });

  const instagramCopy = [
    "Ya podés ver mi nuevo video en @galeria.canal",
    "",
    `"${title}"`,
    "",
    "Mirá el video desde el link de nuestra bio o en YouTube:",
    videoUrl,
    "",
    tagsInstagram
  ].join("\n");

  const communityCopy = [
    "Ya podés ver nuestro nuevo video acá:",
    videoUrl,
    "",
    tagsComunidad
  ].join("\n");

  return { youtubeComment: communityCopy, communityCopy, instagramCopy };
}

// Helper para extraer cookies específicas del request
function getCookie(req, name) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
    });
  }
  return list[name];
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function createSessionId() {
  return require("crypto").randomBytes(32).toString("hex");
}

function getCookieSecurityAttrs(req) {
  const isHttps = req.headers["x-forwarded-proto"] === "https";
  return `Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${isHttps ? "; Secure" : ""}`;
}

// Reads request body with a hard size cap to prevent DoS
function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        return reject(new Error("Cuerpo de la petición demasiado grande."));
      }
      body += chunk.toString("utf-8");
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpsUrl(str) {
  try { return new URL(str).protocol === "https:"; } catch { return false; }
}

function sanitizeAlias(str) {
  return (str || "").trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80);
}

function isSpotifyEmbedUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "https:" && u.hostname === "open.spotify.com" && u.pathname.startsWith("/embed/");
  } catch { return false; }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSession(req) {
  const sessionId = getCookie(req, "creador_session");
  if (!sessionId) return null;
  return sesionesActivas.get(sessionId) || null;
}

function getPublicSession(sessionData) {
  if (!sessionData) return null;
  return {
    email: sessionData.email,
    playlistId: sessionData.playlistId,
    programa: sessionData.programa,
    videosCount: sessionData.videosCount,
    rol: sessionData.rol || "creador",
    puedePublicar: Boolean(sessionData.puedePublicar)
  };
}

function requireAdmin(req, res) {
  const sessionData = getSession(req);
  if (!sessionData) {
    jsonResponse(res, 401, { error: "No autorizado. Inicia sesión nuevamente." });
    return null;
  }
  if (sessionData.rol !== "admin") {
    jsonResponse(res, 403, { error: "Acceso restringido a administradores." });
    return null;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    const token = req.headers["x-csrf-token"];
    if (!token || token !== sessionData.csrfToken) {
      jsonResponse(res, 403, { error: "Token CSRF inválido." });
      return null;
    }
  }
  return sessionData;
}

function isLocalRequest(req) {
  const hostHeader = req.headers.host || "";
  const hostname = hostHeader.split(":")[0];
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function getGoogleAuthOptions(state) {
  return {
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    client_id: process.env.GOOGLE_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: state === "master-token" ? "consent select_account" : "select_account",
    state,
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/youtube.readonly"
    ].join(" ")
  };
}

function updateEnvValue(key, value) {
  const escapedValue = value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
  const nextLine = `${key}=${escapedValue}`;
  let envContent = "";

  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, "utf-8");
  }

  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(envContent)) {
    envContent = envContent.replace(pattern, nextLine);
  } else {
    envContent = `${envContent.replace(/\s*$/, "")}\n${nextLine}\n`;
  }

  fs.writeFileSync(ENV_PATH, envContent, "utf-8");
  process.env[key] = value;
  masterChannelVerification = null;
}

async function verifyMasterChannel(authClient) {
  if (masterChannelVerification?.matches) return masterChannelVerification;

  const expectedChannelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!expectedChannelId) {
    throw new Error("Falta configurar YOUTUBE_CHANNEL_ID.");
  }

  const youtube = google.youtube({ version: "v3", auth: authClient });
  const response = await youtube.channels.list({ part: "id,snippet", mine: true });
  const channel = response.data.items?.[0];

  if (!channel?.id) {
    throw new Error("El token maestro no permite identificar un canal de YouTube.");
  }

  masterChannelVerification = {
    matches: channel.id === expectedChannelId,
    channelId: channel.id,
    channelTitle: channel.snippet?.title || "Canal sin nombre"
  };

  if (!masterChannelVerification.matches) {
    console.error(
      `[Subida Bloqueada] El token maestro pertenece a "${masterChannelVerification.channelTitle}" (${masterChannelVerification.channelId}), no al canal configurado (${expectedChannelId}).`
    );
    throw new Error("El token maestro no corresponde al canal Galeria configurado.");
  }

  console.log(`[Subida Controlled] Token maestro verificado para el canal "${masterChannelVerification.channelTitle}".`);
  return masterChannelVerification;
}

async function obtenerConteosDePlaylists(creadores) {
  if (USE_MOCK) return mock.PLAYLIST_COUNTS;

  const CACHE_KEY = "playlist-counts";
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_CLIENT_ID;
  const playlistIds = [...new Set(Object.values(creadores)
    .map((user) => user.playlistId)
    .filter((playlistId) => playlistId && playlistId !== "N/A" && playlistId !== "PL_principal"))];

  if (!apiKey || playlistIds.length === 0) return {};

  const conteos = {};
  for (let i = 0; i < playlistIds.length; i += 50) {
    const ids = playlistIds.slice(i, i + 50);
    try {
      const response = await axios.get("https://www.googleapis.com/youtube/v3/playlists", {
        params: { key: apiKey, part: "contentDetails", id: ids.join(","), maxResults: ids.length }
      });
      (response.data.items || []).forEach((item) => {
        conteos[item.id] = item.contentDetails?.itemCount ?? 0;
      });
    } catch (error) {
      console.error("No se pudieron sincronizar conteos de playlists:", error.response?.data?.error?.message || error.message);
    }
  }

  cache.set(CACHE_KEY, conteos, TTL.MEDIUM);
  return conteos;
}

function bannerEstaVigente(banner) {
  const now = Date.now();
  const startsAt = banner.startsAt ? Date.parse(banner.startsAt) : null;
  const endsAt = banner.endsAt ? Date.parse(banner.endsAt) : null;
  return banner.active !== false && (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
}

function calcularFinDeBanner(durationDays) {
  const days = parseInt(durationDays || 0, 10);
  if (!days || days <= 0) return "";
  const end = new Date();
  end.setDate(end.getDate() + days);
  return end.toISOString();
}

// =====================================================================
// SERVIDOR HTTP CENTRAL
// =====================================================================
const server = http.createServer(async (req, res) => {

  // ==================== PROXY EXPRESO PARA SCRIPTS JS ====================
  if (req.url.startsWith("/js/")) {
    const publicDir = path.join(__dirname, "public");
    const filePath = path.normalize(path.join(publicDir, req.url));
    if (!filePath.startsWith(publicDir + path.sep)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Acceso denegado");
      return;
    }
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Archivo no encontrado");
      } else {
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        res.end(content);
      }
    });
    return;
  }

  // ==================== ENDPOINT: SUBIDA DE CONTENIDO EN FORMATO TUBO ====================
  if (req.url === "/api/upload" && req.method === "POST") {
    try {
      const sessionData = getSession(req);
      if (!sessionData) {
        return jsonResponse(res, 401, { error: "No autorizado. Inicia sesión nuevamente." });
      }

      // Creamos el cliente OAuth de forma aislada
      const uploadAuthClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // La subida siempre debe salir desde el canal Galeria.
      if (!process.env.YOUTUBE_MASTER_REFRESH_TOKEN) {
        console.error("[Subida Bloqueada] Falta YOUTUBE_MASTER_REFRESH_TOKEN. No se usaran credenciales personales del creador.");
        return jsonResponse(res, 500, { error: "Falta configurar el token maestro del canal Galeria." });
      }
      console.log(`[Subida Controlled] Enrutando video de ${sessionData.email} hacia el canal principal de Galeria.`);
      uploadAuthClient.setCredentials({
        refresh_token: process.env.YOUTUBE_MASTER_REFRESH_TOKEN
      });

      // Verificamos que el token maestro realmente apunte al canal Galeria antes de subir.
      await uploadAuthClient.getAccessToken();
      await verifyMasterChannel(uploadAuthClient);

      const youtube = google.youtube({ version: "v3", auth: uploadAuthClient });

      const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
      const VALID_VIDEO_MIMETYPES = new Set([
        "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo",
        "video/x-ms-wmv", "video/webm", "video/x-matroska", "video/3gpp"
      ]);

      const busboy = Busboy({
        headers: req.headers,
        limits: { fileSize: MAX_VIDEO_BYTES, files: 2, fields: 20 }
      });

      let camposFormulario = {};
      let videoTempPath = null;
      let videoWriteStream = null;
      let videoWriteStreamDone = null;
      let videoMimeType = "video/mp4";
      let videoDetectado = false;
      let videoSizeLimitExceeded = false;
      let videoMimeInvalid = false;
      let miniaturaFileBuffer = null;
      let miniaturaMimeType = "image/jpeg";

      function cleanupTempVideo() {
        if (videoTempPath) { fs.unlink(videoTempPath, () => {}); videoTempPath = null; }
      }

      req.on("close", () => { if (!res.writableEnded) cleanupTempVideo(); });

      busboy.on("field", (name, val) => { camposFormulario[name] = val; });

      busboy.on("file", (fieldName, file, info) => {
        const { mimeType } = info;

        if (fieldName === "videoFile") {
          videoDetectado = true;
          videoMimeType = mimeType || "video/mp4";

          if (!VALID_VIDEO_MIMETYPES.has(mimeType)) {
            videoMimeInvalid = true;
            file.resume();
            return;
          }

          videoTempPath = path.join(os.tmpdir(), `galeria-${require("crypto").randomBytes(8).toString("hex")}`);
          videoWriteStream = fs.createWriteStream(videoTempPath);
          videoWriteStreamDone = new Promise((resolve, reject) => {
            videoWriteStream.on("finish", resolve);
            videoWriteStream.on("error", reject);
          });

          file.on("limit", () => {
            videoSizeLimitExceeded = true;
            console.warn("[Subida] Archivo de video supera el límite de 4 GB.");
          });

          console.log(`[Tubo Video] Streaming a archivo temporal: ${videoTempPath}`);
          file.pipe(videoWriteStream);
        }

        if (fieldName === "thumbnailFile") {
          miniaturaMimeType = mimeType || "image/jpeg";
          const chunks = [];
          file.on("data", (chunk) => chunks.push(chunk));
          file.on("end", () => { miniaturaFileBuffer = Buffer.concat(chunks); });
        }
      });

      busboy.on("finish", async () => {
        try {
          if (videoWriteStreamDone) await videoWriteStreamDone;

          console.log("Formulario parseado. Validando antes de enviar a YouTube API...");

          if (!videoDetectado) throw new Error("No se recibieron datos de video en la petición.");
          if (videoMimeInvalid) throw new Error("Tipo de archivo inválido. Solo se aceptan archivos de video.");
          if (videoSizeLimitExceeded) throw new Error("El archivo de video supera el tamaño máximo permitido (4 GB).");
          if (!videoTempPath) throw new Error("Error al procesar el archivo de video.");

          // Validación CSRF (llega como campo multipart)
          if (!camposFormulario["csrfToken"] || camposFormulario["csrfToken"] !== sessionData.csrfToken) {
            throw new Error("Token CSRF inválido.");
          }

          // Control de visibilidad: creadores no promovidos no pueden publicar en público
          const esAdmin = sessionData.rol === "admin";
          const VALID_PRIVACY = ["public", "private", "unlisted"];
          let visibilidadElegida = VALID_PRIVACY.includes(camposFormulario["privacyStatus"])
            ? camposFormulario["privacyStatus"]
            : "unlisted";

          if (!esAdmin && !sessionData.puedePublicar && visibilidadElegida === "public") {
            visibilidadElegida = "unlisted";
            console.log(`[Permisos] ${sessionData.email} no está promovido para publicar en público. Forzado a unlisted.`);
          }

          // Validación de playlist: cada creador solo puede usar su propia playlist
          const targetPlaylist = camposFormulario["playlist"];
          if (!esAdmin && targetPlaylist && targetPlaylist !== "N/A" && targetPlaylist !== sessionData.playlistId) {
            throw new Error("No tenés permiso para publicar en esa playlist.");
          }

          const VALID_TYPES = ["video", "shorts", "live"];
          const tipoContenido = VALID_TYPES.includes(camposFormulario["type"]) ? camposFormulario["type"] : "video";
          const esShort = tipoContenido === "shorts";

          let tituloFinal = camposFormulario["title"] || camposFormulario["titulo"] || camposFormulario["nombre"] || ("Video de " + (sessionData.programa || "Creadores"));
          let descripcionFinal = camposFormulario["descripcion"] || "Contenido subido desde Galeria Creator Studio.";

          if (esShort && !/#shorts/i.test(`${tituloFinal} ${descripcionFinal}`)) {
            descripcionFinal = `${descripcionFinal}\n\n#Shorts`;
          }

          console.log(`[YouTube API] Subiendo video: "${tituloFinal}" · visibilidad: ${visibilidadElegida}`);

          const videoResponse = await youtube.videos.insert({
            part: "snippet,status",
            requestBody: {
              snippet: { title: tituloFinal, description: descripcionFinal, categoryId: "22" },
              status: { privacyStatus: visibilidadElegida, madeForKids: false }
            },
            media: {
              mimeType: videoMimeType,
              body: fs.createReadStream(videoTempPath) // stream desde disco, no buffer
            }
          });

          const videoId = videoResponse.data.id;
          const videoUrl = `https://youtu.be/${videoId}`;
          console.log(`[YouTube API] ¡Video subido! ID: ${videoId}`);

          cache.delete("youtube:latest");
          cache.delete("youtube:normal");
          cache.deletePrefix("home-stats:");

          // --- MINIATURA ---
          let thumbnailStatus = "not_requested";
          let thumbnailMessage = "";
          if (miniaturaFileBuffer && videoId) {
            if (esShort) {
              thumbnailStatus = "skipped_for_shorts";
              thumbnailMessage = "YouTube no permite aplicar miniaturas personalizadas a Shorts desde la subida. El Short usara un fotograma elegido por YouTube.";
              console.warn(`[Tubo Miniatura] ${thumbnailMessage}`);
            } else if (miniaturaFileBuffer.length > 2 * 1024 * 1024) {
              thumbnailStatus = "too_large";
              thumbnailMessage = "La miniatura supera los 2MB permitidos por YouTube.";
              console.warn(`[Tubo Miniatura] ${thumbnailMessage}`);
            } else {
              try {
                console.log(`[YouTube API] Aplicando miniatura al Video ID: ${videoId}`);
                await youtube.thumbnails.set({
                  videoId: videoId,
                  media: { mimeType: miniaturaMimeType, body: require("stream").Readable.from(miniaturaFileBuffer) }
                });
                thumbnailStatus = "applied";
                thumbnailMessage = "Miniatura aplicada correctamente.";
              } catch (errThumbnail) {
                thumbnailStatus = "failed";
                thumbnailMessage = errThumbnail.response?.data?.error?.message || errThumbnail.message;
                console.error("Error al setear la miniatura:", thumbnailMessage);
              }
            }
          }

          // --- PLAYLIST ---
          if (targetPlaylist && targetPlaylist !== "PL_principal" && targetPlaylist !== "N/A") {
            console.log(`[YouTube API] Vinculando a playlist: ${targetPlaylist}`);
            await youtube.playlistItems.insert({
              part: "snippet",
              requestBody: {
                snippet: {
                  playlistId: targetPlaylist,
                  resourceId: { kind: "youtube#video", videoId: videoId }
                }
              }
            }).catch(errPlaylist => {
              console.error("Error al vincular el video a la playlist:", errPlaylist.message);
            });
          }

          const promotionCopy = buildPromotionCopy({
            title: tituloFinal,
            videoUrl,
            programName: sessionData.programa || "Galeria",
            isShort: esShort
          });

          let youtubePostStatus = "not_attempted";
          let youtubePostMessage = "";
          try {
            console.log("[YouTube API] Generando comentario promocional en el video...");
            await youtube.commentThreads.insert({
              part: "snippet",
              requestBody: {
                snippet: {
                  videoId,
                  topLevelComment: { snippet: { textOriginal: promotionCopy.youtubeComment } }
                }
              }
            });
            youtubePostStatus = "comment_created";
            youtubePostMessage = "Comentario promocional creado en el video. La API oficial de YouTube no permite publicar en la pestaña Comunidad.";
            console.log("[YouTube API] Comentario promocional creado con éxito.");
          } catch (errComm) {
            youtubePostStatus = "failed";
            youtubePostMessage = errComm.response?.data?.error?.message || errComm.message;
            console.error("[YouTube API] No se pudo crear el comentario:", youtubePostMessage);
          }

          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({
            success: true,
            message: `Video transmitido y procesado en YouTube de forma nativa. ID: ${videoId}`,
            videoUrl: videoUrl,
            thumbnailStatus,
            thumbnailMessage,
            youtubePostStatus,
            youtubePostMessage,
            communityCopy: promotionCopy.communityCopy,
            instagramCopy: promotionCopy.instagramCopy
          }));

        } catch (errUpload) {
          console.error("Error en la subida:", errUpload.message);
          if (!res.writableEnded) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: errUpload.message }));
          }
        } finally {
          cleanupTempVideo();
        }
      });

      req.pipe(busboy);
      return;
      
    } catch (err) {
      console.error("Error procesando el flujo de subida:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Error interno al procesar el stream del video" }));
      return;
    }
  } // 👈 🛠️ ¡AQUÍ ESTÁ LA LLAVE QUE FALTABA! Cierra correctamente el bloque /api/upload

  // ==================== ENDPOINTS DE ADMINISTRACIÓN ====================
  if (req.url === "/api/admin/creadores" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    try {
      const lista = leerCreadores();
      const conteos = await obtenerConteosDePlaylists(lista);
      Object.keys(lista).forEach((email) => {
        const playlistId = lista[email].playlistId;
        lista[email].videosCountAuto = Object.prototype.hasOwnProperty.call(conteos, playlistId) ? conteos[playlistId] : null;
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(lista));
    } 
    catch (err) { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Error" })); }
    return;
  }

  if (req.url === "/api/admin/creadores" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { email, playlistId, programa, rol, puedePublicar } = JSON.parse(body);
        if (!email || !programa) throw new Error("Datos incompletos");
        const emailNorm = email.toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) throw new Error("Email inválido.");
        if (programa.trim().length > 100) throw new Error("Nombre de programa demasiado largo.");
        const lista = leerCreadores();
        const nuevoRol = rol === "admin" ? "admin" : "creador";
        const entradaExistente = lista[emailNorm] || {};
        lista[emailNorm] = {
          playlistId: playlistId ? playlistId.trim().slice(0, 100) : "N/A",
          programa: programa.trim(),
          rol: nuevoRol,
          puedePublicar: puedePublicar !== undefined ? Boolean(puedePublicar) : Boolean(entradaExistente.puedePublicar)
        };
        guardarCreadores(lista);
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: true }));
      } catch (err) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  if (req.url === "/api/admin/creadores/set-publicar" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { email, puedePublicar } = JSON.parse(body);
        if (!email || typeof email !== "string") throw new Error("Email inválido.");
        const lista = leerCreadores();
        const emailNorm = email.toLowerCase().trim();
        if (!lista[emailNorm]) throw new Error("Creador no encontrado.");
        lista[emailNorm].puedePublicar = Boolean(puedePublicar);
        guardarCreadores(lista);
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  if (req.url === "/api/admin/banners" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    jsonResponse(res, 200, leerBanners());
    return;
  }

  if (req.url === "/api/admin/banners" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const payload = JSON.parse(body);
        const banners = leerBanners();
        const id = payload.id || require("crypto").randomBytes(8).toString("hex");
        const linkUrl = (payload.linkUrl || "").trim();
        const imageUrl = (payload.imageUrl || "").trim();
        if (!linkUrl || !isValidUrl(linkUrl)) throw new Error("Link URL inválida (debe ser http:// o https://).");
        if (imageUrl && !isValidUrl(imageUrl)) throw new Error("Image URL inválida (debe ser http:// o https://).");
        const validPlacements = ["home", "home-vertical", "home-global", "channel", "global", "vivo", "musica", "podcasts", "programas", "calendario", "sponsors", "sobre"];
        const placement = validPlacements.includes(payload.placement) ? payload.placement : "home";
        const nextBanner = {
          id,
          title: (payload.title || "").trim().slice(0, 200),
          body: (payload.body || "").trim().slice(0, 500),
          sponsor: (payload.sponsor || "").trim().slice(0, 100),
          imageUrl,
          linkUrl,
          placement,
          active: payload.active !== false,
          startsAt: payload.startsAt || new Date().toISOString(),
          endsAt: calcularFinDeBanner(payload.durationDays),
          durationDays: parseInt(payload.durationDays || 0, 10)
        };
        if (!nextBanner.title) throw new Error("Completá al menos título y link.");

        const index = banners.findIndex((banner) => banner.id === id);
        if (index >= 0) banners[index] = nextBanner;
        else banners.push(nextBanner);

        guardarBanners(banners);
        jsonResponse(res, 200, { success: true, banner: nextBanner });
      } catch (err) {
        jsonResponse(res, 400, { error: err.message });
      }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  if (req.url === "/api/admin/banners/delete" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { id } = JSON.parse(body);
        if (!id || typeof id !== "string") throw new Error("ID inválido.");
        const banners = leerBanners().filter((banner) => banner.id !== id);
        guardarBanners(banners);
        jsonResponse(res, 200, { success: true });
      } catch (err) {
        jsonResponse(res, 400, { error: err.message });
      }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  if (req.url.startsWith("/api/banners") && req.method === "GET") {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const placement = parsedUrl.searchParams.get("placement");
    const banners = leerBanners()
      .filter(bannerEstaVigente)
      .filter((banner) => {
        if (!placement) return true;
        if (banner.placement === placement) return true;
        if (banner.placement === "global") return true;
        // home-global: aparece en el slot vertical del home + todas las demás páginas, pero NO en el horizontal del home
        if (banner.placement === "home-global" && placement !== "home") return true;
        return false;
      });
    jsonResponse(res, 200, banners);
    return;
  }

  if (req.url === "/api/admin/creadores/delete" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { email } = JSON.parse(body);
        if (!email || typeof email !== "string") throw new Error("Email inválido.");
        const lista = leerCreadores();
        const targetEmail = email.toLowerCase().trim();
        if (lista[targetEmail]) { delete lista[targetEmail]; guardarCreadores(lista); }
        res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: true }));
      } catch (err) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  // ==================== ENDPOINTS DE AUTENTICACIÓN ====================
  if (req.url === "/api/session" && req.method === "GET") {
    const sessionData = getSession(req);
    if (!sessionData) {
      jsonResponse(res, 401, { authenticated: false });
      return;
    }
    jsonResponse(res, 200, { authenticated: true, user: getPublicSession(sessionData), csrfToken: sessionData.csrfToken });
    return;
  }

  if (req.url === "/api/auth/logout" && req.method === "POST") {
    const sessionData = getSession(req);
    if (sessionData) {
      const token = req.headers["x-csrf-token"];
      if (!token || token !== sessionData.csrfToken) {
        return jsonResponse(res, 403, { error: "Token CSRF inválido." });
      }
    }
    const sessionId = getCookie(req, "creador_session");
    if (sessionId) sesionesActivas.delete(sessionId);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `creador_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (req.url === "/api/auth/google/master") {
    if (!isLocalRequest(req)) {
      res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h2>Acceso restringido</h2><p>Este flujo solo funciona desde localhost.</p>");
      return;
    }

    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const qs = new URLSearchParams(getGoogleAuthOptions("master-token"));
    res.writeHead(302, { Location: `${rootUrl}?${qs.toString()}` });
    res.end();
    return;
  }

  if (req.url === "/api/auth/google") {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const qs = new URLSearchParams(getGoogleAuthOptions("creator-login"));
    res.writeHead(302, { Location: `${rootUrl}?${qs.toString()}` });
    res.end();
    return;
  }

  if (req.url.startsWith("/api/auth/callback")) {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const code = parsedUrl.searchParams.get("code");
      const state = parsedUrl.searchParams.get("state");
      if (!code) throw new Error("No se recibió el código de autorización");

      const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      }));

      const { access_token, refresh_token } = tokenResponse.data;

      if (state === "master-token") {
        if (!isLocalRequest(req)) {
          res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h2>Acceso restringido</h2><p>Este flujo solo funciona desde localhost.</p>");
          return;
        }
        if (!refresh_token) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<h2>No se recibió refresh token</h2><p>Volvé a intentar el flujo y asegurate de aceptar los permisos solicitados.</p>");
          return;
        }

        const masterAuthClient = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );
        masterAuthClient.setCredentials({ access_token, refresh_token });
        const verifiedChannel = await verifyMasterChannel(masterAuthClient);
        updateEnvValue("YOUTUBE_MASTER_REFRESH_TOKEN", refresh_token);

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <div style="font-family:sans-serif; max-width:620px; margin:50px auto; padding:24px; border:1px solid #2e7d32; border-radius:10px; background:#f1fff4; color:#123;">
            <h2 style="margin-top:0; color:#2e7d32;">Token maestro actualizado</h2>
            <p>El token verificado corresponde al canal <strong>${verifiedChannel.channelTitle}</strong>.</p>
            <p>Ya quedó guardado en <code>.env</code> como <code>YOUTUBE_MASTER_REFRESH_TOKEN</code>.</p>
            <p><strong>Próximo paso:</strong> reiniciá el servidor con <code>Ctrl+C</code> y luego <code>node server.js</code>.</p>
            <a href="/creadores.html" style="display:inline-block; margin-top:12px; padding:10px 14px; background:#2e7d32; color:white; text-decoration:none; border-radius:6px;">Volver a Creadores</a>
          </div>
        `);
        return;
      }

      const userResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const userEmail = userResponse.data.email.toLowerCase().trim();
      const creadoresDinamicos = leerCreadores();
      const creadorInfo = creadoresDinamicos[userEmail];

      if (!creadorInfo) {
        res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <div style="font-family:sans-serif; max-width:500px; margin:50px auto; padding:25px; border:1px solid #dc3545; border-radius:10px; background:#fdf2f2;">
            <h2 style="color:#dc3545; margin-top:0;">Acceso Denegado</h2>
            <p>El correo logueado actual (<strong>${userEmail}</strong>) no se encuentra registrado en el sistema.</p>
            <p><strong>¿Qué hacer?</strong> Cambiá tu rol a "creador" para este correo específico en tu <code style="background:#e9ecef; padding:2px 4px;">creadores.json</code> o dale al botón de abajo para elegir otra cuenta de Google.</p>
            <a href="/api/auth/google" style="display:inline-block; margin-top:15px; padding:10px 15px; background:#007bff; color:white; text-decoration:none; border-radius:5px; font-weight:bold;">Elegir otra cuenta</a>
          </div>
        `);
        return;
      }

      let userChannelId = null;
      try {
        const youtubeCheckResponse = await axios.get("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        userChannelId = youtubeCheckResponse.data.items?.[0]?.id;
      } catch (errApi) {
        console.error("[Seguridad Auth] No se pudo verificar el canal de marca:", errApi.message);
      }

      const targetChannelId = process.env.YOUTUBE_CHANNEL_ID;
      console.log(`[Seguridad Auth] Creador validado: ${userEmail}. ID de canal: ${userChannelId}`);

      const esCuentaAdminDePrueba = (creadorInfo.rol === "admin" || userEmail === "pabloabritos@gmail.com");

      if (!esCuentaAdminDePrueba && (!process.env.YOUTUBE_MASTER_REFRESH_TOKEN)) {
        if (!userChannelId || userChannelId !== targetChannelId) {
          res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <div style="font-family:sans-serif; max-width:500px; margin:50px auto; padding:20px; border:1px solid #ffc107; border-radius:8px; background:#fffdf5;">
              <h2 style="color:#856404;">Canal incorrecto</h2>
              <p>Hola <strong>${creadorInfo.programa}</strong>, elegiste un canal personal.</p>
              <a href="/api/auth/google" style="display:inline-block; margin-top:10px; padding:10px 15px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">Reintentar</a>
            </div>
          `);
          return;
        }
      }

      const csrfToken = require("crypto").randomBytes(32).toString("hex");
      const payloadSesion = {
        email: userEmail,
        access_token,
        refresh_token,
        ...creadorInfo,
        csrfToken
      };
      const sessionId = createSessionId();
      sesionesActivas.set(sessionId, payloadSesion);

      res.writeHead(302, {
        "Set-Cookie": `creador_session=${sessionId}; ${getCookieSecurityAttrs(req)}`,
        "Location": "/creadores.html?login=success"
      });
      res.end();
      return;
    } catch (error) {
      console.error("Error crítico en autenticación:", error.message);
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h2>Error en el inicio de sesión</h2><p>${escapeHtml(error.message)}</p>`);
      return;
    }
  }

  // ==================== ENDPOINT: MÉTRICAS GENERALES Y POR PLAYLIST ====================
  if (req.url.startsWith("/api/home-stats") && req.method === "GET") {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const targetPlaylistId = parsedUrl.searchParams.get("playlistId");

      // ── Mock ──────────────────────────────────────────────────────────────
      if (USE_MOCK) {
        return jsonResponse(res, 200, mock.HOME_STATS);
      }

      // ── Caché — clave única por playlistId de creador ─────────────────────
      const cacheKey = `home-stats:${targetPlaylistId || "global"}`;
      const cached = cache.get(cacheKey);
      if (cached) return jsonResponse(res, 200, cached);

      // ── Llamada real a YouTube ────────────────────────────────────────────
      const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_CLIENT_ID;
      const channelId = process.env.YOUTUBE_CHANNEL_ID;

      const channelUrl  = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
      const liveUrl     = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${apiKey}`;
      const upcomingUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=upcoming&order=date&key=${apiKey}`;

      const promesas = [
        axios.get(channelUrl).then(r => r.data),
        axios.get(liveUrl).then(r => r.data),
        axios.get(upcomingUrl).then(r => r.data)
      ];

      const validPlaylist = targetPlaylistId &&
        !["undefined","null","PL_principal","N/A"].includes(targetPlaylistId);
      if (validPlaylist) {
        const plUrl = `https://www.googleapis.com/youtube/v3/playlists?part=contentDetails&id=${targetPlaylistId}&key=${apiKey}`;
        promesas.push(axios.get(plUrl).then(r => r.data).catch(() => null));
      } else {
        promesas.push(Promise.resolve(null));
      }

      const [channelRes, liveRes, upcomingRes, playlistRes] = await Promise.all(promesas);
      const stats = channelRes.items?.[0]?.statistics || {};
      const isLive = liveRes.items?.length > 0;
      const liveData = isLive
        ? { title: liveRes.items[0].snippet.title, videoId: liveRes.items[0].id.videoId }
        : null;
      const hasUpcoming = upcomingRes.items?.length > 0;

      // Enriquecer con scheduledStartTime para mostrar la fecha real del estreno
      let scheduledStartTime = null;
      if (hasUpcoming) {
        const upcomingId = upcomingRes.items[0].id.videoId;
        try {
          const detailsRes = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
            params: { key: apiKey, part: "liveStreamingDetails", id: upcomingId }
          });
          scheduledStartTime = detailsRes.data.items?.[0]?.liveStreamingDetails?.scheduledStartTime || null;
        } catch (_) { /* no bloquear si falla */ }
      }

      const upcomingData = hasUpcoming
        ? {
            title: upcomingRes.items[0].snippet.title,
            publishedAt: upcomingRes.items[0].snippet.publishedAt,
            scheduledStartTime // fecha real del evento programado (puede ser null)
          }
        : null;
      const videosDinamicosCount = playlistRes?.items?.[0]?.contentDetails?.itemCount ?? null;

      const totalViews = parseInt(stats.viewCount || 0);
      const homePayload = {
        metrics: {
          subscribers:       formatNumber(stats.subscriberCount || 0),
          views:             formatNumber(stats.viewCount || 0),
          hours:             formatNumber(Math.floor(totalViews * 0.08)),
          videos:            stats.videoCount || "0",
          playlistVideosReal: String(videosDinamicosCount)
        },
        live:      { active: isLive, data: liveData },
        calendar:  { hasUpcoming, data: upcomingData },
        community: { interactions: formatNumber(Math.floor(totalViews * 0.045)) }
      };

      // TTL corto porque el estado de live puede cambiar
      cache.set(cacheKey, homePayload, TTL.SHORT);
      return jsonResponse(res, 200, homePayload);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Error" }));
      return;
    }
  }

  // ==================== PROXIES DE /api/youtube (con caché + mock) ====================
  if (req.url.startsWith("/api/youtube")) {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const pathname  = parsedUrl.pathname;
      const apiKey    = process.env.YOUTUBE_API_KEY;
      const channelId = process.env.YOUTUBE_CHANNEL_ID;
      const baseParams = { key: apiKey, channelId, part: "snippet" };

      // ── /live ──────────────────────────────────────────────────────────────
      if (pathname.endsWith("/live")) {
        if (USE_MOCK) return jsonResponse(res, 200, mock.YOUTUBE_LIVE);
        const cached = cache.get("youtube:live");
        if (cached) return jsonResponse(res, 200, cached);
        const data = (await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { ...baseParams, eventType: "live", type: "video" }
        })).data;
        cache.set("youtube:live", data, TTL.LIVE);
        return jsonResponse(res, 200, data);
      }

      // ── /past-lives ────────────────────────────────────────────────────────
      if (pathname.endsWith("/past-lives")) {
        if (USE_MOCK) return jsonResponse(res, 200, mock.YOUTUBE_PAST_LIVES);
        const cached = cache.get("youtube:past-lives");
        if (cached) return jsonResponse(res, 200, cached);

        // Intento 1: buscar lives completados (pestaña "En directo" del canal)
        let data = (await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { ...baseParams, order: "date", type: "video", eventType: "completed", maxResults: 5 }
        })).data;

        // Intento 2: si la API no devuelve lives completados, buscar con liveBroadcastContent
        // usando videos.list para encontrar streams pasados en el canal
        if (!data.items?.length) {
          console.log("[past-lives] eventType=completed sin resultados, intentando búsqueda alternativa...");
          const altData = (await axios.get("https://www.googleapis.com/youtube/v3/search", {
            params: { ...baseParams, order: "date", type: "video", maxResults: 20 }
          })).data;

          // Filtrar solo los que fueron transmisiones en vivo (liveBroadcastContent != "none")
          const liveItems = (altData.items || []).filter(
            item => item.snippet?.liveBroadcastContent !== "none"
          );

          if (liveItems.length) {
            data = { ...altData, items: liveItems };
          }
        }

        // Solo cachear si hay resultados — evita guardar listas vacías por quota agotada
        if (data.items?.length) {
          cache.set("youtube:past-lives", data, TTL.MEDIUM);
        }
        return jsonResponse(res, 200, data);
      }

      // ── /upcoming ──────────────────────────────────────────────────────────
      if (pathname.endsWith("/upcoming")) {
        if (USE_MOCK) return jsonResponse(res, 200, mock.YOUTUBE_UPCOMING);
        const cached = cache.get("youtube:upcoming");
        if (cached) return jsonResponse(res, 200, cached);

        const searchData = (await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { ...baseParams, order: "date", type: "video", eventType: "upcoming", maxResults: 10 }
        })).data;

        // Enriquecer con scheduledStartTime + thumbnails de alta calidad
        if (searchData.items?.length) {
          const ids = searchData.items.map(i => i.id.videoId).join(",");
          try {
            const detailsData = (await axios.get("https://www.googleapis.com/youtube/v3/videos", {
              params: { key: apiKey, part: "liveStreamingDetails,snippet", id: ids }
            })).data;
            const detailsMap = {};
            detailsData.items?.forEach(v => { detailsMap[v.id] = v; });
            searchData.items = searchData.items.map(item => {
              const d = detailsMap[item.id.videoId];
              if (d?.liveStreamingDetails?.scheduledStartTime) {
                item.scheduledStartTime = d.liveStreamingDetails.scheduledStartTime;
              }
              // Usar thumbnails de mayor resolución cuando están disponibles
              if (d?.snippet?.thumbnails) item.snippet.thumbnails = d.snippet.thumbnails;
              return item;
            });
          } catch (e) {
            console.error("[Calendario] No se pudo enriquecer eventos:", e.message);
          }
        }

        cache.set("youtube:upcoming", searchData, TTL.SHORT);
        return jsonResponse(res, 200, searchData);
      }

      // ── /playlists ─────────────────────────────────────────────────────────
      if (pathname.endsWith("/playlists")) {
        if (USE_MOCK) return jsonResponse(res, 200, mock.YOUTUBE_PLAYLISTS);
        const cached = cache.get("youtube:playlists");
        if (cached) return jsonResponse(res, 200, cached);
        const data = (await axios.get("https://www.googleapis.com/youtube/v3/playlists", {
          params: { ...baseParams, part: "snippet,contentDetails", maxResults: 25 }
        })).data;
        cache.set("youtube:playlists", data, TTL.LONG);
        return jsonResponse(res, 200, data);
      }

      // ── /latest ────────────────────────────────────────────────────────────
      if (pathname.endsWith("/latest")) {
        if (USE_MOCK) return jsonResponse(res, 200, mock.YOUTUBE_LATEST);
        const cached = cache.get("youtube:latest");
        if (cached) return jsonResponse(res, 200, cached);
        const data = (await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { ...baseParams, order: "date", type: "video", maxResults: 30 }
        })).data;
        cache.set("youtube:latest", data, TTL.SHORT);
        return jsonResponse(res, 200, data);
      }

      // ── /normal (videos largos, filtra shorts) ─────────────────────────────
      if (pathname.endsWith("/normal")) {
        if (USE_MOCK) return jsonResponse(res, 200, mock.YOUTUBE_NORMAL);
        const cached = cache.get("youtube:normal");
        if (cached) return jsonResponse(res, 200, cached);

        const searchData = (await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { ...baseParams, order: "date", type: "video", maxResults: 10 }
        })).data;

        if (!searchData.items?.length) {
          cache.set("youtube:normal", { items: [] }, TTL.SHORT);
          return jsonResponse(res, 200, { items: [] });
        }

        const videoIds = searchData.items.map(item => item.id.videoId).join(",");
        const detailsData = (await axios.get("https://www.googleapis.com/youtube/v3/videos", {
          params: { key: apiKey, part: "contentDetails", id: videoIds }
        })).data;

        const durationsMap = {};
        detailsData.items.forEach(item => { durationsMap[item.id] = item.contentDetails.duration; });
        const longVideos = searchData.items.filter(item => {
          const dur = durationsMap[item.id.videoId];
          return dur ? !isShort(dur) : true;
        });

        const result = { items: longVideos };
        cache.set("youtube:normal", result, TTL.MEDIUM);
        return jsonResponse(res, 200, result);
      }

      // ── /video-semana ──────────────────────────────────────────────────────
      if (pathname.endsWith("/video-semana")) {
        if (USE_MOCK) return jsonResponse(res, 200, mock.VIDEO_SEMANA);
        const cached = cache.get("youtube:video-semana");
        if (cached) return jsonResponse(res, 200, cached);

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const searchData = (await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: { ...baseParams, order: "date", type: "video", publishedAfter: sevenDaysAgo, maxResults: 10 }
        })).data;

        if (!searchData.items?.length) {
          const empty = { empty: true };
          cache.set("youtube:video-semana", empty, TTL.SHORT);
          return jsonResponse(res, 200, empty);
        }

        const videoIds = searchData.items.map(i => i.id.videoId).join(",");
        const statsData = (await axios.get("https://www.googleapis.com/youtube/v3/videos", {
          params: { key: apiKey, part: "statistics", id: videoIds }
        })).data;

        const statsMap = {};
        (statsData.items || []).forEach(v => { statsMap[v.id] = v.statistics; });

        const topVideo = searchData.items
          .map(item => ({ ...item, viewCount: parseInt(statsMap[item.id.videoId]?.viewCount || 0) }))
          .sort((a, b) => b.viewCount - a.viewCount)[0];

        // Intentar asociar el video a un programa por coincidencia de título
        const creadores = leerCreadores();
        let programa = "Galeria";
        const titleLower = topVideo.snippet.title.toLowerCase();
        for (const info of Object.values(creadores)) {
          if (info.programa && titleLower.includes(info.programa.toLowerCase())) {
            programa = info.programa;
            break;
          }
        }

        const semanaResult = {
          videoId:     topVideo.id.videoId,
          title:       topVideo.snippet.title,
          thumbnail:   topVideo.snippet.thumbnails.medium?.url || topVideo.snippet.thumbnails.default?.url,
          views:       formatNumber(topVideo.viewCount),
          programa,
          publishedAt: topVideo.snippet.publishedAt
        };
        cache.set("youtube:video-semana", semanaResult, TTL.MEDIUM);
        return jsonResponse(res, 200, semanaResult);
      }

    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Error" }));
      return;
    }
  }

  // ==================== SITE CONFIG (público) ====================
  if (req.url === "/api/site-config" && req.method === "GET") {
    const config = leerJson(SITE_CONFIG_PATH, SITE_CONFIG_DEFAULT);
    return jsonResponse(res, 200, {
      pages:     config.pages     || {},
      textos:    config.textos    || {},
      textos_en: config.textos_en || {},
      pagos:     config.pagos     || {},
      planes:    config.planes    || []
    });
  }

  // ==================== ADMIN: pagos del canal ====================
  if (req.url === "/api/admin/pagos-canal" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { cafecito, mercadopago, aliasMP, mpQrImageUrl, descripcion } = JSON.parse(body);
        const mpUrl = (mercadopago || "").trim();
        if (mpUrl && !isHttpsUrl(mpUrl)) throw new Error("mercadopago debe ser una URL https://.");
        const qrUrl = (mpQrImageUrl || "").trim().slice(0, 500);
        if (qrUrl && !isHttpsUrl(qrUrl)) throw new Error("mpQrImageUrl debe ser una URL https://.");
        const config = leerJson(SITE_CONFIG_PATH, SITE_CONFIG_DEFAULT);
        config.pagos = {
          cafecito:    (cafecito    || "").trim().replace(/^https?:\/\/cafecito\.app\//i, "").slice(0, 80),
          mercadopago: mpUrl.slice(0, 300),
          aliasMP:     sanitizeAlias(aliasMP),
          mpQrImageUrl: qrUrl,
          descripcion: (descripcion || "").trim().slice(0, 300)
        };
        guardarJson(SITE_CONFIG_PATH, config);
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  // ==================== ADMIN: planes de precio ====================
  if (req.url === "/api/admin/planes" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req, 32 * 1024).then((body) => {
      try {
        const { planes } = JSON.parse(body);
        if (!Array.isArray(planes)) throw new Error("Payload inválido.");
        const sanitized = planes.map((p) => {
          const planLink = (p.link || "").trim();
          if (planLink && !isHttpsUrl(planLink)) throw new Error(`Link de plan inválido (debe ser https://): ${planLink.slice(0, 60)}`);
          return {
            id:          (p.id || require("crypto").randomBytes(4).toString("hex")),
            titulo:      (p.titulo      || "").trim().slice(0, 80),
            precio:      (p.precio      || "").trim().slice(0, 40),
            descripcion: (p.descripcion || "").trim().slice(0, 500),
            boton:       (p.boton       || "").trim().slice(0, 40),
            link:        planLink.slice(0, 300),
            destacado:   Boolean(p.destacado)
          };
        });
        const config = leerJson(SITE_CONFIG_PATH, SITE_CONFIG_DEFAULT);
        config.planes = sanitized;
        guardarJson(SITE_CONFIG_PATH, config);
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  // ==================== ADMIN: page toggles ====================
  if (req.url === "/api/admin/site-config" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { pages } = JSON.parse(body);
        if (!pages || typeof pages !== "object") throw new Error("Payload inválido.");
        const config = leerJson(SITE_CONFIG_PATH, SITE_CONFIG_DEFAULT);
        const validPages = Object.keys(SITE_CONFIG_DEFAULT.pages);
        validPages.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(pages, key)) {
            config.pages[key] = { enabled: Boolean(pages[key].enabled) };
          }
        });
        guardarJson(SITE_CONFIG_PATH, config);
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  // ==================== ADMIN: texto overrides ====================
  if (req.url === "/api/admin/textos" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req, 128 * 1024).then((body) => {
      try {
        const { textos } = JSON.parse(body);
        if (!textos || typeof textos !== "object") throw new Error("Payload inválido.");
        // Sanitize: only allow string values, max 1000 chars each
        const clean = {};
        Object.entries(textos).forEach(([k, v]) => {
          if (typeof k === "string" && typeof v === "string") {
            clean[k.slice(0, 80)] = v.slice(0, 1000);
          }
        });
        const config = leerJson(SITE_CONFIG_PATH, SITE_CONFIG_DEFAULT);
        config.textos = clean;
        guardarJson(SITE_CONFIG_PATH, config);
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  // ==================== ADMIN: auto-traducción (MyMemory, sin API key) ====================
  if (req.url === "/api/admin/traducir" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req, 64 * 1024).then(async (body) => {
      try {
        const { textos } = JSON.parse(body);
        if (!textos || typeof textos !== "object") throw new Error("Payload inválido.");

        // Traduce cada texto de ES → EN usando MyMemory (gratuito, sin clave)
        async function translateOne(text) {
          if (!text?.trim()) return "";
          try {
            const r = await axios.get("https://api.mymemory.translated.net/get", {
              params: { q: text.trim(), langpair: "es|en" },
              timeout: 8000
            });
            return r.data.responseData?.translatedText || text;
          } catch {
            return text; // fallback: devuelve el original si falla
          }
        }

        // Traducir en paralelo (todos los campos a la vez)
        const keys = Object.keys(textos).filter(k => textos[k]?.trim());
        const translated = await Promise.all(keys.map(k => translateOne(textos[k])));

        const textos_en = {};
        keys.forEach((k, i) => { textos_en[k] = translated[i]; });

        // Guardar en site-config
        const config = leerJson(SITE_CONFIG_PATH, SITE_CONFIG_DEFAULT);
        config.textos_en = { ...(config.textos_en || {}), ...textos_en };
        guardarJson(SITE_CONFIG_PATH, config);

        jsonResponse(res, 200, { success: true, textos_en });
      } catch (err) {
        jsonResponse(res, 400, { error: err.message });
      }
    }).catch(err => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  // ==================== PODCASTS (público) ====================
  if (req.url === "/api/podcasts" && req.method === "GET") {
    return jsonResponse(res, 200, leerJson(PODCASTS_PATH, []));
  }

  // ==================== ADMIN: podcasts ====================
  if (req.url === "/api/admin/podcasts" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { id, title, description, embedUrl } = JSON.parse(body);
        if (!title || !embedUrl) throw new Error("Título y URL de embed son obligatorios.");
        const cleanEmbedUrl = embedUrl.trim().slice(0, 500);
        if (!isSpotifyEmbedUrl(cleanEmbedUrl)) throw new Error("embedUrl debe ser una URL de embed de Spotify (https://open.spotify.com/embed/...).");
        const list = leerJson(PODCASTS_PATH, []);
        const itemId = id || require("crypto").randomBytes(6).toString("hex");
        const item = {
          id: itemId,
          title: title.trim().slice(0, 200),
          description: (description || "").trim().slice(0, 500),
          embedUrl: cleanEmbedUrl
        };
        const idx = list.findIndex((p) => p.id === itemId);
        if (idx >= 0) list[idx] = item; else list.push(item);
        guardarJson(PODCASTS_PATH, list);
        jsonResponse(res, 200, { success: true, item });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  if (req.url === "/api/admin/podcasts/delete" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { id } = JSON.parse(body);
        if (!id) throw new Error("ID requerido.");
        guardarJson(PODCASTS_PATH, leerJson(PODCASTS_PATH, []).filter((p) => p.id !== id));
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  // ==================== MÚSICA (público) ====================
  if (req.url === "/api/musica" && req.method === "GET") {
    return jsonResponse(res, 200, leerJson(MUSICA_PATH, []));
  }

  // ==================== ADMIN: música ====================
  if (req.url === "/api/admin/musica" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { id, title, description, embedUrl } = JSON.parse(body);
        if (!title || !embedUrl) throw new Error("Título y URL de embed son obligatorios.");
        const cleanEmbedUrl = embedUrl.trim().slice(0, 500);
        if (!isSpotifyEmbedUrl(cleanEmbedUrl)) throw new Error("embedUrl debe ser una URL de embed de Spotify (https://open.spotify.com/embed/...).");
        const list = leerJson(MUSICA_PATH, []);
        const itemId = id || require("crypto").randomBytes(6).toString("hex");
        const item = {
          id: itemId,
          title: title.trim().slice(0, 200),
          description: (description || "").trim().slice(0, 500),
          embedUrl: cleanEmbedUrl
        };
        const idx = list.findIndex((p) => p.id === itemId);
        if (idx >= 0) list[idx] = item; else list.push(item);
        guardarJson(MUSICA_PATH, list);
        jsonResponse(res, 200, { success: true, item });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  if (req.url === "/api/admin/musica/delete" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { id } = JSON.parse(body);
        if (!id) throw new Error("ID requerido.");
        guardarJson(MUSICA_PATH, leerJson(MUSICA_PATH, []).filter((p) => p.id !== id));
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }


  // ==================== PROGRAMAS DEL CANAL (público) ====================
  if (req.url === "/api/programas-canal" && req.method === "GET") {
    return jsonResponse(res, 200, leerJson(PROGRAMAS_CANAL_PATH, []));
  }

  // ==================== ADMIN: programas del canal ====================
  if (req.url === "/api/admin/programas-canal" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { id, nombre, logoUrl, instagram, cafecito, mercadopago, aliasMP, mpQrImageUrl } = JSON.parse(body);
        if (!nombre) throw new Error("El nombre del programa es obligatorio.");
        if (logoUrl && !isHttpsUrl(logoUrl)) throw new Error("Logo URL debe ser https://.");
        const progMpUrl = (mercadopago || "").trim();
        if (progMpUrl && !isHttpsUrl(progMpUrl)) throw new Error("mercadopago debe ser una URL https://.");
        const progQrUrl = (mpQrImageUrl || "").trim().slice(0, 500);
        if (progQrUrl && !isHttpsUrl(progQrUrl)) throw new Error("mpQrImageUrl debe ser una URL https://.");
        const list = leerJson(PROGRAMAS_CANAL_PATH, []);
        const itemId = id || require("crypto").randomBytes(6).toString("hex");
        const item = {
          id:          itemId,
          nombre:      nombre.trim().slice(0, 100),
          logoUrl:     (logoUrl     || "").trim().slice(0, 500),
          instagram:   (instagram   || "").replace(/^@/, "").trim().slice(0, 80),
          cafecito:    (cafecito    || "").replace(/^@/, "").trim().slice(0, 80),
          mercadopago: progMpUrl.slice(0, 300),
          aliasMP:     sanitizeAlias(aliasMP),
          mpQrImageUrl: progQrUrl
        };
        const idx = list.findIndex((p) => p.id === itemId);
        if (idx >= 0) list[idx] = item; else list.push(item);
        guardarJson(PROGRAMAS_CANAL_PATH, list);
        jsonResponse(res, 200, { success: true, item });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  if (req.url === "/api/admin/programas-canal/delete" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    readBody(req).then((body) => {
      try {
        const { id } = JSON.parse(body);
        if (!id) throw new Error("ID requerido.");
        const list = leerJson(PROGRAMAS_CANAL_PATH, []).filter((p) => p.id !== id);
        const fs = require("fs");
        fs.writeFileSync(PROGRAMAS_CANAL_PATH, JSON.stringify(list, null, 2), "utf-8");
        jsonResponse(res, 200, { success: true });
      } catch (err) { jsonResponse(res, 400, { error: err.message }); }
    }).catch((err) => jsonResponse(res, 413, { error: err.message }));
    return;
  }

  handler(req, res);
});

server.listen(port, host, () => {
  console.log(`Galeria Live available at http://${host}:${port}`);
});
