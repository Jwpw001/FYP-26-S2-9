const prisma = require("../config/prisma");

// Same device registering again (app reinstall, browser subscription refresh) should update the
// existing row rather than pile up duplicates — dedup key is the token (expo) or endpoint (web),
// since neither platform's subscription object has a stable ID we control.
function subscriptionKey(platform, subscription) {
  return platform === "expo" ? subscription?.token : subscription?.endpoint;
}

// POST /api/push/register  body: { platform: "expo" | "web", subscription: {...} }
async function registerPush(req, res) {
  try {
    const { platform, subscription } = req.body;
    if (!["expo", "web"].includes(platform)) {
      return res.status(400).json({ success: false, message: "platform must be 'expo' or 'web'." });
    }
    const key = subscriptionKey(platform, subscription);
    if (!subscription || typeof subscription !== "object" || !key) {
      return res.status(400).json({ success: false, message: "Invalid subscription payload." });
    }

    const existing = await prisma.push_subscriptions.findMany({
      where: { user_id: req.user.user_id, platform },
    });
    const dup = existing.find(s => subscriptionKey(platform, s.subscription) === key);

    if (dup) {
      await prisma.push_subscriptions.update({
        where: { id: dup.id },
        data: { subscription, last_used_at: new Date() },
      });
    } else {
      await prisma.push_subscriptions.create({
        data: { user_id: req.user.user_id, platform, subscription, last_used_at: new Date() },
      });
    }

    return res.json({ success: true, message: "Push subscription registered." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/push/unregister  body: { platform: "expo" | "web", subscription: {...} }
async function unregisterPush(req, res) {
  try {
    const { platform, subscription } = req.body;
    const key = subscriptionKey(platform, subscription);
    if (!key) return res.status(400).json({ success: false, message: "Invalid subscription payload." });

    const existing = await prisma.push_subscriptions.findMany({
      where: { user_id: req.user.user_id, platform },
    });
    const match = existing.find(s => subscriptionKey(platform, s.subscription) === key);
    if (match) await prisma.push_subscriptions.delete({ where: { id: match.id } });

    return res.json({ success: true, message: "Push subscription removed." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { registerPush, unregisterPush };
