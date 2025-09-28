const CACHE = "ba-cache-func-v1";
const ASSETS = ["/","/index.html","/manifest.webmanifest","/assets/icons/icon-192.png","/assets/icons/icon-512.png"];
self.addEventListener("install", e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); });
self.addEventListener("activate", e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener("fetch", e=>{
  const url = new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(caches.match(e.request).then(res=> res || fetch(e.request)));
  }else{
    e.respondWith(fetch(e.request).catch(()=> new Response("Sin conexión",{status:503})));
  }
});
