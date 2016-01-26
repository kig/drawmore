var CACHE_NAME = 'drawmore-cache-v1';

// The files we want to cache
var urlsToCache = [
  './touch.html',
  './js/TouchUIConcepts.js',
  './js/three.js',
  './js/BrushPresets.js',
  './js/ColorUtils.js',
  './js/ColorMixer.js',
  './texture.png',
  './texture2.png',
  './texture3.png'
];

// Set the callback for the install step
self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request);
      }
    )
  );
});