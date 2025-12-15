const CACHE_NAME = "agenda-facil-v2";
const urlsToCache = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  // Force immediate activation
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
  
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Network-First strategy for navigation (HTML) requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Stale-while-revalidate / Network-First for other resources
  event.respondWith(
    fetch(event.request)
      .then((response) => {
         if(response && response.status === 200 && response.type === 'basic') {
             const responseClone = response.clone();
             caches.open(CACHE_NAME).then((cache) => {
                 cache.put(event.request, responseClone);
             });
         }
         return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
