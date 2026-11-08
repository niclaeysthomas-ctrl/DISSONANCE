/* sw.js — pour que l'app marche en cave, en van et sur scène.
   VERSION doit suivre celle des ?v= dans index.html : c'est ce qui livre
   les mises à jour au groupe. */
const VERSION = '1.2.0';
const CACHE = 'carnet-v' + VERSION;
const COQUILLE = [
  './', './index.html',
  './styles.css?v=' + VERSION, './chords.js?v=' + VERSION, './app.js?v=' + VERSION,
  './views.js?v=' + VERSION, './views2.js?v=' + VERSION, './boot.js?v=' + VERSION,
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // { cache: 'reload' } : on va chercher au serveur, jamais dans le cache
      // HTTP du navigateur — sinon on fige une vieille version pour de bon.
      .then((c) => c.addAll(COQUILLE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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

  // La page elle-même : réseau d'abord. C'est elle qui pointe vers la bonne
  // version des scripts, donc elle ne doit jamais être périmée.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then((r) => {
        const copie = r.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copie));
        return r;
      }).catch(() => caches.match('./index.html').then((h) => h || caches.match('./')))
    );
    return;
  }

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

  // Le reste porte un ?v= : une URL = une version, le cache peut répondre sec.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r && r.status === 200) {
        const copie = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copie));
      }
      return r;
    }))
  );
});
