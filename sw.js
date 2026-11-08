/* sw.js — pour que l'app marche en cave, en van et sur scène. */
const CACHE = 'carnet-v1.1.0';
const COQUILLE = [
  './', './index.html', './styles.css', './chords.js', './app.js', './views.js', './views2.js',
  './boot.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Le répertoire du groupe bouge : réseau d'abord, cache en secours.
  if (req.url.includes('repertoire.json')) {
    e.respondWith(
      fetch(req).then((r) => {
        const copie = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copie));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Le reste : cache d'abord, et on rafraîchit en arrière-plan.
  e.respondWith(
    caches.match(req).then((hit) => {
      const reseau = fetch(req).then((r) => {
        if (r && r.status === 200) {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return r;
      }).catch(() => hit);
      return hit || reseau;
    })
  );
});
