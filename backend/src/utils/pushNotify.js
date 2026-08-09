const webpush = require("web-push");
const prisma = require("../config/prisma");
const logger = require("../config/logger");

// expo-server-sdk ships as a pure ESM package. Node 22+ can require() it synchronously (that's
// what actually runs this app), but Jest's module system can't — and every caller of this file
// (notify.js, required from nearly every controller) would otherwise fail to even load under
// Jest. Loaded lazily on first real push send instead of at module import time, so requiring
// this file never touches it unless a push is actually sent.
let expoModule = null;
function getExpoModule() {
  if (!expoModule) {
    const { Expo } = require("expo-server-sdk");
    expoModule = { Expo, instance: new Expo() };
  }
  return expoModule;
}

const vapidConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@krewby.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Sends a push notification to every device registered for these user IDs. Called from
// notify.js alongside the existing in-app notification insert — best-effort and non-blocking:
// a push failure never throws into the caller, since the in-app notification (the primary,
// already-working path) has already succeeded by the time this runs.
async function sendPushToUsers(userIds, { title, message }) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return;

  let subs;
  try {
    subs = await prisma.push_subscriptions.findMany({ where: { user_id: { in: ids } } });
  } catch (err) {
    logger.error({ err }, "[push] failed to load subscriptions");
    return;
  }
  if (subs.length === 0) return;

  const expoSubs = subs.filter(s => s.platform === "expo");
  const webSubs = subs.filter(s => s.platform === "web");

  await Promise.all([
    sendExpoPushes(expoSubs, { title, message }),
    sendWebPushes(webSubs, { title, message }),
  ]);
}

async function sendExpoPushes(subs, { title, message }) {
  if (subs.length === 0) return;
  const { Expo, instance } = getExpoModule();

  const subByToken = {};
  const messages = [];
  for (const s of subs) {
    const token = s.subscription?.token;
    if (!token || !Expo.isExpoPushToken(token)) continue;
    subByToken[token] = s;
    messages.push({ to: token, sound: "default", title, body: message || "" });
  }
  if (messages.length === 0) return;

  const deadIds = [];
  for (const chunk of instance.chunkPushNotifications(messages)) {
    try {
      const receipts = await instance.sendPushNotificationsAsync(chunk);
      receipts.forEach((r, i) => {
        // The device uninstalled the app or revoked permission — Expo will never deliver to
        // this token again, so stop trying.
        if (r.status === "error" && r.details?.error === "DeviceNotRegistered") {
          const sub = subByToken[chunk[i].to];
          if (sub) deadIds.push(sub.id);
        }
      });
    } catch (err) {
      logger.error({ err }, "[push] expo send chunk failed");
    }
  }
  if (deadIds.length > 0) {
    await prisma.push_subscriptions.deleteMany({ where: { id: { in: deadIds } } }).catch(() => {});
  }
}

async function sendWebPushes(subs, { title, message }) {
  if (subs.length === 0 || !vapidConfigured) return;

  const payload = JSON.stringify({ title, body: message || "" });
  const deadIds = [];
  await Promise.all(subs.map(async (s) => {
    const subscription = s.subscription;
    if (!subscription?.endpoint) return;
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (err) {
      // 404/410 = the browser/OS has permanently invalidated this subscription (unsubscribed,
      // uninstalled, storage cleared) — stop trying rather than erroring on every future push.
      if (err.statusCode === 404 || err.statusCode === 410) {
        deadIds.push(s.id);
      } else {
        logger.error({ err: err.message, statusCode: err.statusCode }, "[push] web push send failed");
      }
    }
  }));
  if (deadIds.length > 0) {
    await prisma.push_subscriptions.deleteMany({ where: { id: { in: deadIds } } }).catch(() => {});
  }
}

module.exports = { sendPushToUsers };
