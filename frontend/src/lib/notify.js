import { supabase } from "./supabaseClient";

export async function notifyUser({ recipientId, type, title, message, relatedEntity, relatedId }) {
  if (!recipientId) return;
  await supabase.from("notifications").insert({
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

export async function notifyUsers(recipientIds, { type, title, message, relatedEntity, relatedId }) {
  const ids = [...new Set((recipientIds || []).filter(Boolean))];
  if (ids.length === 0) return;
  await supabase.from("notifications").insert(ids.map(recipientId => ({
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

// Union of branch_managers.user_id and any active manager staff at this branch.
export async function getBranchManagerUserIds(branchId) {
  if (!branchId) return [];
  const [{ data: bm }, { data: staffRows }] = await Promise.all([
    supabase.from("branch_managers").select("user_id").eq("branch_id", branchId),
    supabase.from("staff").select("user_id, users:user_id(role)").eq("branch_id", branchId).eq("is_active", true),
  ]);
  const ids = new Set();
  (bm || []).forEach(r => r.user_id && ids.add(r.user_id));
  (staffRows || []).forEach(r => { if (r.users?.role === "manager") ids.add(r.user_id); });
  return [...ids];
}
