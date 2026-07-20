const supabaseAdmin = require("../config/supabaseAdmin");
const prisma = require("../config/prisma");

async function notifyUser({ recipientId, type, title, message, relatedEntity, relatedId }) {
  if (!recipientId) return;
  await supabaseAdmin.from("notifications").insert({
    recipient_id: recipientId,
    type,
    title,
    message: message || null,
    related_entity: relatedEntity || null,
    related_id: relatedId != null ? String(relatedId) : null,
    is_read: false,
    created_at: new Date().toISOString(),
  });
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

module.exports = { notifyUser, notifyUsers, getBranchManagerUserIds, getSystemAdminUserIds };
