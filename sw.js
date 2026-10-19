/* TATA PWA | 2026.10.19.3
  Do not serve outdated HTML to users monitoring production movements.
  API/authorization requests are never cached.
*/
const CACHE_NAME = "tata-transportes-shell-v20261019-3";
const BASE = "/tata-control-transportes/";
const STATIC = [BASE+"manifest.webmanifest", BASE+"icons/tata-192.png", BASE+"icons/tata-512.png"];
self.addEventListener("install",event=>{
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(k=>k.startsWith("tata-transportes-shell-")).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
  // Always reload the document over the network; display an explicit offline message instead.
  if(req.mode==="navigate" || url.pathname===BASE+"index.html" || url.pathname===BASE){
    event.respondWith(fetch(new Request(req,{cache:"no-store"})).catch(()=>
      new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TATA - Sin conexion</title><body style="font-family:system-ui;padding:30px"><h2>TATA Transportes necesita internet</h2><p>No podemos confirmar el estado de los movimientos sin consultar Supabase.</p><button onclick="location.reload()">Reintentar conexion</button></body></html>',{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})
    ));
    return;
  }
  if(STATIC.includes(url.pathname)){
    event.respondWith(fetch(new Request(req,{cache:"no-cache"})).catch(()=>caches.match(req)));
  }
});
