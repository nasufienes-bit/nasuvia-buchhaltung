// Hält die App offline verfügbar. Bei jeder neuen Fassung VERSION erhöhen.
const VERSION = 'nb-8';
const DATEIEN = ['./', 'index.html', 'app.js', 'speicher.js', 'abgleich.js', 'lib/supabase.js', 'schrift.css', 'logo.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest',
  'lib/html2canvas.min.js', 'lib/jspdf.umd.min.js', 'rechnungen/', 'rechnungen/index.html', 'rechnungen/dienst.js', 'rechnungen/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSION).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
// Zuerst das Netz, damit Änderungen sofort ankommen; ohne Netz aus dem Zwischenspeicher
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const kopie = r.clone();
    caches.open(VERSION).then((c) => c.put(e.request, kopie));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
