/* ============================================================
   SwapSkill Service Worker — sw.js  (production-ready v3)
   - Works on GitHub Pages, Netlify, Vercel, any HTTPS host
   - SKIP_WAITING message support for instant updates
   - allSettled on cache so one bad asset never blocks install
   ============================================================ */
'use strict';

const CACHE_NAME  = 'swapskill-v3';
const FONTS_CACHE = 'swapskill-fonts-v1';

const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())   // activate immediately, don't wait for tabs to close
  );
});

// ── ACTIVATE — wipe old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONTS_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take control of all open tabs immediately
  );
});

// ── SKIP_WAITING message (sent from page on update found) ────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept non-GET, chrome-extension, or data URLs
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Never intercept Firebase / Google API traffic
  if (
    url.hostname.includes('firebaseio.com')    ||
    url.hostname.includes('firebasestorage')   ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('gstatic.com')       ||
    url.hostname.includes('google.com')
  ) {
    return;
  }

  // Google Fonts — cache-first (they rarely change)
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.open(FONTS_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // App shell — network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(cached => {
          if (cached) return cached;
          // Navigation fallback — serve the app shell
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
      )
  );
});

// ── PUSH NOTIFICATIONS (future-ready) ───────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let d = {};
  try { d = event.data.json(); } catch(e) { d = { title: 'SwapSkill', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'SwapSkill', {
      body:    d.body    || 'You have a new notification!',
      icon:    './icon-192.png',
      badge:   './icon-192.png',
      vibrate: [100, 50, 100],
      data:    d.url || './',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data || './');
    })
  );
});
