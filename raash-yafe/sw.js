/* Ra'ash Yafe offline shell. Media remains in IndexedDB, not Cache Storage. */
const CACHE='raash-yafe-v10.1';
const CORE=['./','index.html','backup.js','studio-v3.js','studio-v3.css','studio-v4.js','studio-v4.css','simple-v5.js','simple-v5.css','suno-v8.js','catalog-v9.js','catalog-v9.css','player-v10.js','player-v10.css','suno-v6.css','assets/front.webp','assets/back.webp','assets/studio.webp','assets/live.webp','assets/icon-180.png','manifest.webmanifest','cover.svg','back.svg','icon.svg'];
const SCOPE=new URL(self.registration.scope).pathname;
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('raash-yafe-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(SCOPE))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./',copy))}
   return response;
  }).catch(async()=>await caches.match('./')||await caches.match('index.html')));
  return;
 }
 // Scripts and styles update online instead of staying permanently stale on installed iPhones.
 const isCode=/\.(?:js|css)$/i.test(url.pathname);
 if(isCode){
  event.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}
   return response;
  }).catch(()=>caches.match(request)));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}
  return response;
 })));
});