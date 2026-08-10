const supabaseAdmin = require("../config/supabaseAdmin");
const prisma = require("../config/prisma");
const { sendPushToUsers } = require("./pushNotify");
const logger = require("../config/logger");

async function notifyUser({ recipientId, type, title, message, relatedEntity, relatedId }) {
  if (!recipientId) return null;
  const { data: notification } = await supabaseAdmin.from("notifications").insert({
    recipient_id: recipientId,
    type,
    title,
    message: message || null,
    related_entity: relatedEntity || null,
    related_id: relatedId != null ? String(relatedId) : null,
    is_read: false,
    created_at: new Date().toISOString(),
  }).select().single();
  // Fire-and-forget: push failures are logged inside sendPushToUsers and never thrown here —
  // the in-app notification above is the primary path and has already succeeded.
  sendPushToUsers([recipientId], { title, message }).catch(err => logger.error({ err }, "[push] notifyUser push failed"));
  return notification;
}

async function notifyUsers(recipientIds, { type, title, message, relatedEntity, relatedId }) {
  const ids = [...new Set((recipientIds || []).filter(Boolean))];
  if (ids.length === 0) return;
  await supabaseAdmin.from("notifications").insert(ids.map(recipientId => ({
    recipient_id: recipientId,
    type,
    title,
    message: message || null,
    related_entity: relatedEntity || null,
    related_id: relatedId != null ? String(relatedId) : null,
    is_read: false,
    created_at: new Date().toISOString(),
  })));
  sendPushToUsers(ids, { title, message }).catch(err => logger.error({ err }, "[push] notifyUsers push failed"));
}

// One notification row + one push per recipient, regardless of how many underlying events
// (shifts, tasks, etc.) triggered it. Unlike notifyUsers — which sends one identical message to
// a list of recipients — each entry here carries its own title/message, since a batched summary
// is usually per-recipient ("4 shifts" for one person, "2 shifts" for another). The caller is
// responsible for aggregating events per user BEFORE calling this; this function just writes
// exactly one row per entry, not one per underlying event.
async function notifyUsersBatched(entries) {
  const rows = (entries || []).filter(e => e.recipientId).map(e => ({
    recipient_id: e.recipientId,
    type: e.type,
    title: e.title,
    message: e.message || null,
    related_entity: e.relatedEntity || null,
    related_id: e.relatedId != null ? String(e.relatedId) : null,
    is_read: false,
    created_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  await supabaseAdmin.from("notifications").insert(rows);
  // Fire-and-forget, same as notifyUser/notifyUsers — one push per entry (i.e. per recipient,
  // since the caller already aggregated), push failures logged but never thrown.
  await Promise.all(entries.map(e =>
    e.recipientId
      ? sendPushToUsers([e.recipientId], { title: e.title, message: e.message }).catch(err => logger.error({ err }, "[push] notifyUsersBatched push failed"))
      : null
  ));
}

// Union of branch_managers.user_id and any active staff at this branch whose role is "manager" —
// a branch can have more than one manager and both patterns coexist in this codebase.
async function getBranchManagerUserIds(branchId) {
  if (!branchId) return [];
  const [{ data: bm }, staffRows] = await Promise.all([
    supabaseAdmin.from("branch_managers").select("user_id").eq("branch_id", branchId),
    prisma.staff.findMany({
      where: { branch_id: branchId, is_active: true, users: { role: "manager" } },
      select: { user_id: true },
    }),
  ]);
  const ids = new Set();
  (bm || []).forEach(r => r.user_id && ids.add(r.user_id));
  staffRows.forEach(r => r.user_id && ids.add(r.user_id));
  return [...ids];
}

async function getSystemAdminUserIds() {
  const admins = await prisma.users.findMany({ where: { role: "system_admin", is_active: true }, select: { user_id: true } });
  return admins.map(a => a.user_id);
}

module.exports = { notifyUser, notifyUsers, notifyUsersBatched, getBranchManagerUserIds, getSystemAdminUserIds };
