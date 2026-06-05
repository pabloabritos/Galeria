const fs = require("fs");
const path = require("path");
const { publicDir } = require("./config");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function resolvePath(url) {
  let clean;
  try {
    clean = decodeURIComponent(url.split("?")[0]);
  } catch {
    clean = url.split("?")[0];
  }
  const requested = clean === "/" ? "/index.html" : clean;
  return path.normalize(path.join(publicDir, requested));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType, ...SECURITY_HEADERS });
    res.end(data);
  });
}

const resolvedPublicDir = path.resolve(publicDir);

function handler(req, res) {
  const filePath = resolvePath(req.url);
  const resolvedFilePath = path.resolve(filePath);

  if (resolvedFilePath !== resolvedPublicDir && !resolvedFilePath.startsWith(resolvedPublicDir + path.sep)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  serveFile(res, filePath);
}

module.exports = { handler };
