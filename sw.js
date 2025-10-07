const CACHE_NAME = 'task-tracker-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            }
        )
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for focus reminders
self.addEventListener('sync', event => {
    if (event.tag === 'focus-reminder') {
        event.waitUntil(showFocusReminder());
    }
});

function showFocusReminder() {
    return self.registration.showNotification('Focus Check! 🔔', {
        body: 'Are you still focused on your current task?',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: 'focus-reminder',
        requireInteraction: true,
        actions: [
            {
                action: 'focused',
                title: 'Yes, I\'m focused!'
            },
            {
                action: 'break',
                title: 'I need a break'
            }
        ]
    });
}

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'focused') {
        // Handle focused response
        console.log('User is focused');
    } else if (event.action === 'break') {
        // Handle break response
        console.log('User needs a break');
    } else {
        // Handle general notification click
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});