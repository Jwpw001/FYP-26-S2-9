// Krewby web push service worker. Kept intentionally minimal: show whatever the backend sent,
// and focus/open the app on click. All notification content decisions happen server-side
// (backend/src/utils/pushNotify.js) — this file has no app logic of its own.

self.addEventListener("push", (event) => {
  let data = { title: "Krewby", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // Non-JSON payload — fall back to the default above rather than throwing.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Krewby", {
      body: data.body || "",
      icon: "/logo_noText.png",
      badge: "/logo_noText.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
