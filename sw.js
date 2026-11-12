/* sw.js — Guarda la aplicación para uso sin conexión.
   Los libros de pacientes nunca pasan por aquí: se leen en memoria desde el equipo del usuario. */
const CACHE = 'germen-micobacterias-v1.1.0';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/catalogos.js', 'js/lector.js', 'js/lector.worker.js', 'js/modelo.js', 'js/indicadores.js', 'js/calidad.js', 'js/tablero.js', 'js/editor.js', 'js/app.js',
  'vendor/xlsx.full.min.js', 'vendor/chart.umd.min.js', 'vendor/ibm-plex-sans.woff2', 'vendor/ibm-plex-serif-600.woff2',
  'icons/logo_germen.png', 'icons/logo_labmedico.jpg', 'icons/favicon-64.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(resp => {
    if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
    return resp;
  }).catch(() => caches.match('index.html'))));
});
