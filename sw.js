// Service worker: shows the "order ready" notification when the phone is locked or the page is in the background.
// Messages come from Firebase Cloud Messaging as data messages: { title, body, no, venueId, ticketId, tag }.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let p = {};
  try { const j = event.data ? event.data.json() : {}; p = j.data || j; } catch (e) {}
  const title = p.title || "طلبك";
  event.waitUntil(self.registration.showNotification(title, {
    body: p.body || "",
    tag: p.tag || "order",          // same tag: a repeat replaces the old one...
    renotify: true,                 // ...but still rings and vibrates again
    vibrate: [500, 200, 500, 200, 500, 200, 500],
    icon: "icon.png",
    badge: "icon.png",
    data: { venueId: p.venueId, ticketId: p.ticketId }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = new URL("./?v=" + encodeURIComponent(d.venueId || "") + "&t=" + encodeURIComponent(d.ticketId || ""), self.registration.scope).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (c.url.includes("t=" + encodeURIComponent(d.ticketId || ""))) { await c.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
