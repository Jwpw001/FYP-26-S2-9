const prisma = require("../config/prisma");

// Append-only audit trail. Never throws into the caller — a logging failure shouldn't
// block the actual state change it's recording.
async function logAudit({ actorId, action, entity, entityId, before, after }) {
  try {
    await prisma.audit_logs.create({
      data: {
        actor_id: actorId ?? null,
        action,
        entity,
        entity_id: entityId ?? null,
        before: before ?? null,
        after: after ?? null,
      },
    });
  } catch (err) {
    console.error("[audit log] failed to write entry:", err.message);
  }
}

module.exports = { logAudit };
