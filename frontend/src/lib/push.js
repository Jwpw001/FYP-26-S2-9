import { api } from "./api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Browsers want the VAPID key as a Uint8Array, not the base64url string the backend hands out.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function isSubscribed() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const subscription = await reg.pushManager.getSubscription();
  return !!subscription;
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error("Push notifications aren't supported in this browser.");
  if (!VAPID_PUBLIC_KEY) throw new Error("Push notifications aren't configured yet.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission wasn't granted.");

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  await api.post("/api/push/register", { platform: "web", subscription: subscription.toJSON() });
  return subscription;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;

  const json = subscription.toJSON();
  await subscription.unsubscribe();
  await api.post("/api/push/unregister", { platform: "web", subscription: json }).catch(() => {});
}
