// frontend/sw.js

// --- Cache Configuration ---
const CACHE_NAME = 'svenska-ai-practice-v1.0.2'; // Update version to ensure service worker updates.
const RUNTIME_CACHE = 'svenska-ai-practice-runtime';

// --- Static Assets to Pre-cache ---
// frontend/sw.js

const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/css/main.css',
    '/css/responsive.css',
    // --- CORRECTED SECTION START ---
    '/js/main.js', // Changed from app.js
    '/js/api.js',
    '/js/auth.js',
    '/js/conversation.js',
    '/js/conversation-practice.js',
    '/js/recorder.js',
    '/js/search.js',
    '/js/state.js',
    '/js/ui.js',
    '/js/utils.js',
    '/js/wordbook.js',
    // --- CORRECTED SECTION END ---
    '/manifest.json',
    '/offline.html',
    '/assets/icons/icon-192.png',
    '/assets/icons/badge-72.png'
];

// --- Service Worker Lifecycle Events ---

// 1. Install Event: Pre-caches all static assets.
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_CACHE_URLS))
            .then(() => self.skipWaiting()) // Activate the new service worker immediately.
    );
});

// 2. Activate Event: Cleans up old caches.
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        // Filter for caches from this app but not the current static or runtime caches.
                        .filter((cacheName) => cacheName.startsWith('svenska-ai-practice-') && cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
                        .map((cacheName) => caches.delete(cacheName))
                );
            })
            .then(() => self.clients.claim()) // Take control of all open clients.
    );
});

// 3. Fetch Event: Intercepts network requests to apply caching strategies.
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // --- IMPORTANT: Immediately bypass non-GET requests ---
    // For all POST, PUT, DELETE, etc., requests, we do not use any caching strategy.
    // They are passed through to be handled by the browser normally.
    if (request.method !== 'GET') {
        return;
    }

    // --- All logic below this point only handles GET requests ---
    
    const url = new URL(request.url);

    // Ignore non-http requests (e.g., chrome-extension://)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // For API calls and dynamic audio, use a "Network First" strategy.
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/audio_cache/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // For all other static assets, use a "Cache First" strategy.
    event.respondWith(cacheFirst(request));
});


// --- Caching Strategies ---

/**
 * Cache First Strategy:
 * Responds from the cache immediately if available, otherwise fetches from the network.
 * Ideal for static assets that don't change often.
 * @param {Request} request - The incoming request.
 */
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    return cachedResponse || fetch(request);
}

/**
 * Network First Strategy:
 * Tries to fetch from the network first. If successful, it updates the cache.
 * If the network fails, it falls back to the runtime cache.
 * Ideal for dynamic content like API calls.
 * @param {Request} request - The incoming request.
 */
async function networkFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
        const response = await fetch(request);
        // If the fetch is successful, cache the new response for future offline use.
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        // If the network request fails, try to find a match in the cache.
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // If it's a navigation request and nothing is cached, show the offline page.
        if (request.mode === 'navigate') {
            return caches.match('/offline.html');
        }
        // For failed API calls, return a generic JSON error.
        return new Response(JSON.stringify({ error: 'offline' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
        });
    }
}


// --- Other Service Worker Events (Push, Notification, etc.) ---

// 4. Push Event: Handles incoming push notifications.
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body || 'New message from Svenska AI Practice',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            timestamp: new Date().toString()
        },
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'close', title: 'Close' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Svenska AI Practice', options)
    );
});

// 5. Notification Click Event: Handles user interaction with notifications.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a window for the app is already open, focus it.
                if (clientList.length > 0) {
                    return clientList[0].focus();
                }
                // Otherwise, open a new window.
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// 6. Background Sync Event: For deferred actions.
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        // A function to handle syncing failed messages when connection is restored can be defined here.
        // event.waitUntil(syncMessages()); 
    }
});

// 7. Message Event: For communication between the client and service worker.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys()
                .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
                .then(() => {
                    if (event.ports[0]) {
                       return event.ports[0].postMessage({ success: true });
                    }
                })
        );
    }
});
