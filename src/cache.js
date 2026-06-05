/**
 * Caché TTL en memoria — sin dependencias externas.
 * Cada entrada expira tras `ttlMs` milisegundos.
 * JS es single-threaded, por lo tanto el Map es thread-safe.
 */

const store = new Map(); // key → { data, expiresAt }

// TTLs exportados para que server.js los use con nombres claros
const TTL = {
  LIVE:      5  * 60 * 1000,  //  5 min — estado del directo cambia rápido
  SHORT:     15 * 60 * 1000,  // 15 min — próximos eventos, videos recientes
  MEDIUM:    20 * 60 * 1000,  // 20 min — conteos de playlist, /normal
  LONG:      30 * 60 * 1000,  // 30 min — stats del canal, playlists completas
};

const cache = {
  /** Devuelve el valor si existe y no expiró; si no, undefined */
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.data;
  },

  /** Guarda un valor con un TTL en milisegundos */
  set(key, data, ttlMs) {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  /** Elimina una clave exacta */
  delete(key) {
    store.delete(key);
  },

  /** Elimina todas las claves que empiezan con `prefix` */
  deletePrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  /** Vacía toda la caché (útil para tests o reinicio manual) */
  clear() {
    store.clear();
  },

  size() {
    return store.size;
  }
};

module.exports = { cache, TTL };
