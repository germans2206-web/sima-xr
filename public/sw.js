/* SIMA · Service Worker
   - La app (HTML/JS) se sirve "red primero, caché de respaldo". Con señal
     débil (cámaras de frío), si la red no contesta en 4 s se abre la copia
     guardada en lugar de quedar la pantalla en blanco.
   - Las fotos de R2 son inmutables: caché primero, para verlas sin señal.
     Viven en un caché propio que NO se borra al publicar una versión nueva,
     con un tope de entradas para no llenar la memoria del celular.
   - Las llamadas de datos nunca se cachean (siempre red).
   - Al cerrar sesión, la app pide borrar las fotos guardadas (dispositivos
     compartidos: el siguiente usuario no las ve sin iniciar sesión). */
const CACHE = 'sima-ra-app-v3';
const FOTOS = 'sima-ra-fotos';
const TOPE_FOTOS = 400;
const BASE = ['/', '/index.html', '/sima-sync.js', '/sima-ayuda.js', '/sima-bot.js', '/sima-mascota.js', '/sima-escenas.js', '/sima-modulos.js', '/sima-iot.js', '/sima-nfc.js', '/sima-ra.js', '/sima-equipos3d.js', '/vendor/three.module.min.js', '/vendor/RoomEnvironment.js', '/sima-reparar.js', '/sima-tour.js', '/sima-companero.js', '/sima-2026.css', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  // allSettled: si falta algún archivo, el resto se instala igual.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(BASE.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FOTOS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'limpiar-fotos') e.waitUntil(caches.delete(FOTOS));
});

async function recortarFotos(c) {
  const keys = await c.keys();
  // Las más viejas primero (orden de inserción).
  for (let i = 0; i < keys.length - TOPE_FOTOS; i++) await c.delete(keys[i]);
}

const conTiempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), ms))]);

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Fotos: caché primero (nunca cambian)
  if (url.pathname.startsWith('/api/foto/')) {
    e.respondWith(
      caches.open(FOTOS).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) { await c.put(e.request, res.clone()); recortarFotos(c); }
        return res;
      })
    );
    return;
  }

  // Datos: siempre red, sin caché
  if (url.pathname.startsWith('/api/')) return;

  // Aplicación: red primero (con tope de espera), caché de respaldo
  const red = fetch(e.request).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
    return res;
  });
  e.respondWith(
    conTiempo(red, 4000)
      .catch(async () => (await caches.match(e.request))
        || (e.request.mode === 'navigate' ? await caches.match('/index.html') : null)
        || red)   // sin copia guardada: se sigue esperando a la red
  );
});
