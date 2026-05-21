# Galeria

Aplicación web responsive para un canal de YouTube con programas, vivos, shorts, creadores, calendario editorial y sponsors.

## Pantallas incluidas

- `index.html`: home con reproductor central y playlists destacadas.
- `programas.html`: grilla de programas y filtros por tipo de contenido.
- `programa.html`: detalle de una playlist/programa con videos, métricas y comentarios.
- `vivo.html`: pantalla de transmisión en vivo y chat.
- `calendario.html`: agenda de contenidos programados.
- `creadores.html`: mock de acceso de creadores, carga y programación.
- `podcasts.html`: playlists de podcasts embebidas desde Spotify.
- `musica.html`: playlists musicales embebidas desde Spotify.
- `sponsors.html`: apoyos económicos por fans y marcas.
- `sobre.html`: descripción del proyecto.

## Correr localmente

```bash
npm start
```

Luego abrir:

```text
http://localhost:3000
```

## Publicar en Railway

Railway puede usar el comando:

```bash
npm start
```

El servidor lee automaticamente `process.env.PORT`, que Railway asigna al desplegar.

## Proximos pasos sugeridos

- Conectar login con Google OAuth.
- Integrar YouTube Data API para playlists, videos, likes, comentarios y suscripciones.
- Integrar YouTube Analytics API para estadisticas de creadores.
- Persistir programaciones en una base de datos.
- Reemplazar posters CSS por fotos reales de cada programa.

Prueba de SSH - modificado el 21/05/2026