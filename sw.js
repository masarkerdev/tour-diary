/* ইন্টারনেট ছাড়া অ্যাপ খোলার জন্য ফাইলগুলো ফোনে রাখা হয়।
   নতুন সংস্করণ push করলে নিচের সংখ্যাটা বাড়ানো ভালো, তাহলে পুরোনো কপি পরিষ্কার হয়। */
const CACHE = 'bhromon-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './config.js', './manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const CDN = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
    await Promise.all(CDN.map(u => fetch(u, {mode:'cors'}).then(r => r.ok && c.put(u, r)).catch(() => {})));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.hostname.endsWith('supabase.co')) return;          // ডাটাবেস ও লগইন সবসময় সরাসরি
  if(url.origin === location.origin){
    // নিজের ফাইল: ইন্টারনেট থাকলে নতুনটা, না থাকলে ফোনের কপি
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req, {ignoreSearch:true}).then(r => r || caches.match('./index.html'))));
    return;
  }
  // CDN ও ফন্ট: ফোনের কপি আগে, না থাকলে নামিয়ে রাখা
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if(r.ok || r.type === 'opaque'){ const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});
