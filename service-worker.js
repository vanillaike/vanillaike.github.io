const CACHE_NAME = 'ib-wandering-v1';
const STATIC_CACHE = 'ib-wandering-static-v1';
const DYNAMIC_CACHE = 'ib-wandering-dynamic-v1';
const MAP_CACHE = 'ib-wandering-maps-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];

// Install the service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, MAP_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!currentCaches.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy: Cache First with Network Fallback for static assets
// Network First with Cache Fallback for dynamic content
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip Google Maps API requests - these need to be handled differently
  if (url.hostname.includes('maps.googleapis.com') || 
      url.hostname.includes('google-analytics.com')) {
    handleMapRequests(event);
    return;
  }
  
  // Static assets - Cache First
  if (STATIC_ASSETS.includes(url.pathname) || 
      url.pathname.startsWith('./icons/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response; // Return from cache if available
          }
          return fetchAndCache(event.request, STATIC_CACHE);
        })
    );
    return;
  }
  
  // Dynamic content - Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        return cacheResponse(event.request, response, DYNAMIC_CACHE);
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If nothing in cache, serve offline page
            return caches.match('./index.html');
          });
      })
  );
});

// Handle map requests with a specialized strategy
function handleMapRequests(event) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful map tile responses
        if (response && response.status === 200) {
          const clonedResponse = response.clone();
          caches.open(MAP_CACHE).then(cache => {
            cache.put(event.request, clonedResponse);
          });
        }
        return response;
      })
      .catch(() => {
        // Try to get from cache if network fails
        return caches.match(event.request);
      })
  );
}

// Helper to fetch and cache a request
function fetchAndCache(request, cacheName) {
  return fetch(request)
    .then(response => {
      if (!response || response.status !== 200) {
        return response;
      }
      const responseToCache = response.clone();
      caches.open(cacheName)
        .then(cache => {
          cache.put(request, responseToCache);
        });
      return response;
    });
}

// Helper to cache a response
function cacheResponse(request, response, cacheName) {
  if (response && response.status === 200) {
    const clonedResponse = response.clone();
    caches.open(cacheName).then(cache => {
      cache.put(request, clonedResponse);
    });
  }
  return response;
}

// Background sync for offline data
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pins') {
    event.waitUntil(syncPins());
  } else if (event.tag === 'sync-tracks') {
    event.waitUntil(syncTracks());
  }
});

// Sync pins data when back online
function syncPins() {
  return new Promise((resolve, reject) => {
    // Here you would implement your sync logic
    // For example:
    // 1. Get unsynchronized data from IndexedDB
    // 2. Send it to your server
    // 3. Update local data with server response
    console.log('Syncing pins with server');
    
    // For now just resolve the promise
    setTimeout(() => resolve(), 1000);
  });
}

// Sync tracks data when back online
function syncTracks() {
  return new Promise((resolve, reject) => {
    console.log('Syncing tracks with server');
    setTimeout(() => resolve(), 1000);
  });
}

// Push notification handling
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'New updates available for IB Wandering!',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'IB Wandering', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(windowClients => {
        // If a window client is already open, focus it
        for (const client of windowClients) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});