const CACHE_NAME = 'wwm-gvg-cache-v9';
const ASSETS = [
  './',
  './index.html',
  './guild-war-registration/guild-war-user.html',
  './guild-war-registration/guild-war-admin.html',
  './styles-fixed.css',
  './data.js',
  './app.js',
  './guild-war-registration/guildwar.config.js',
  './guild-war-registration/guildwar.config.example.js',
  './guild-war-registration/guildwar.js',
  './gacha.js',
  './manifest.json',
  './images/map.png',
  './images/boss.png',
  './images/tower_blue.png',
  './images/tower_red.png',
  './images/tree_blue.png',
  './images/tree_red.png',
  './images/goose_blue.png',
  './images/goose_red.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
