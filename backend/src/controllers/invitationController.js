const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const crypto = require("crypto");
const { getLimits } = require("../utils/planLimits");
const dns = require("dns").promises;
const { sendMail } = require("../utils/mailer");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const ROLE_HIERARCHY = {
  system_admin:        5,
  business_owner:      4,
  manager:      3,
  regular_staff:       2,
  casual_staff: 2,
};

const ROLE_LABELS = {
  manager:      "Manager",
  regular_staff:       "Regular Staff",
  casual_staff: "Casual Staff",
};

async function isEmailDomainValid(email) {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch (err) {
    // Only reject if domain definitively doesn't exist (NXDOMAIN)
    // Allow through on timeout, SERVFAIL, or any other network error
    if (err.code === "ENOTFOUND" || err.code === "ENODATA") return false;
    return true;
  }
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${rand(4)}-${rand(4)}`;
}

async function sendInviteEmail({ to, inviterName, roleName, branchName, inviteLink, code }) {
  await sendMail({
    to,
    subject: `You've been invited to join ${branchName || "a business"} on Krewby`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:#F59E0B;color:#1C1917;font-weight:800;font-size:22px;width:44px;height:44px;line-height:44px;border-radius:10px;text-align:center;">K</div>
          <span style="font-size:20px;font-weight:800;color:#0F172A;vertical-align:middle;margin-left:10px;">Krewby</span>
        </div>
        <h2 style="font-size:20px;font-weight:700;color:#0F172A;margin-bottom:8px;">You're invited!</h2>
        <p style="color:#475569;font-size:14px;line-height:1.6;margin-bottom:20px;">
          <strong>${inviterName}</strong> has invited you to join <strong>${branchName || "their branch"}</strong> as <strong>${roleName}</strong>.
        </p>
        <a href="${inviteLink}" style="display:block;background:#F59E0B;color:#1C1917;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:24px;">
          Accept Invitation
        </a>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px;">
          <p style="font-size:12px;color:#64748B;margin-bottom:6px;">Or join using this invitation code:</p>
          <p style="font-size:28px;font-weight:800;color:#0F172A;letter-spacing:0.1em;">${code}</p>
          <p style="font-size:12px;color:#94A3B8;">Go to <strong>${FRONTEND_URL}/join-invite</strong> and enter the code</p>
        </div>
        <p style="font-size:12px;color:#94A3B8;text-align:center;">This invitation expires in 7 days. If you didn't expect this, you can ignore this email.</p>
      </div>
    `,
  });
}

// POST /api/invitations/send
const sendInvitation = async (req, res) => {
  try {
    const sender = req.user;
    const { email, role, branch_id: branch_id, business_id } = req.body;

    if (!email || !role) return res.status(400).json({ success: false, message: "Email and role are required." });
    if (!branch_id) return res.status(400).json({ success: false, message: "Branch is required." });

    const senderLevel = ROLE_HIERARCHY[sender.role] || 0;
    const targetLevel = ROLE_HIERARCHY[role] || 0;
    if (targetLevel >= senderLevel) {
      return res.status(403).json({ success: false, message: "You cannot invite someone to a role equal or higher than your own." });
    }

    // Enforce staff limit based on business plan
    const branchRow = await prisma.branches.findUnique({ where: { branch_id: Number(branch_id) }, select: { business_id: true } });
    if (branchRow?.business_id) {
      const { data: biz } = await supabaseAdmin.from("businesses").select("plan").eq("business_id", branchRow.business_id).maybeSingle();
      const limits = getLimits(biz?.plan || "free");
      if (limits.staff !== Infinity) {
        const { count: staffCount } = await supabaseAdmin
          .from("staff").select("*", { count: "exact", head: true })
          .eq("branch_id", Number(branch_id)).eq("is_active", true);
        if ((staffCount || 0) >= limits.staff) {
          return res.status(403).json({
            success: false,
            limitReached: true,
            limitType: "staff",
            plan: biz?.plan || "free",
            message: `Your ${biz?.plan || "free"} plan allows ${limits.staff} staff per branch. Upgrade to add more.`,
          });
        }
      }
    }

    // Verify email domain has real MX records
    const domainValid = await isEmailDomainValid(email);
    if (!domainValid) {
      return res.status(400).json({ success: false, message: "The email domain doesn't appear to be valid. Please enter a real email address." });
    }

    // Check if user already exists — allowed, we'll link them
    const existing = await prisma.users.findUnique({ where: { email } });

    // Cancel any existing pending invite for this email + branch
    await supabaseAdmin.from("invitations").update({ status: "cancelled" })
      .eq("email", email).eq("branch_id", branch_id).eq("status", "pending");

    // Get branch name for email
    const branch = await prisma.branches.findUnique({ where: { branch_id: Number(branch_id) }, select: { name: true } });
    const branchName = branch?.name || "";

    // Get sender name
    const senderUser = await prisma.users.findUnique({ where: { user_id: sender.user_id }, select: { full_name: true } });
    const inviterName = senderUser?.full_name || "Someone";

    const token = crypto.randomBytes(32).toString("hex");
    let code = generateCode();
    // Ensure code uniqueness (retry up to 5 times)
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabaseAdmin.from("invitations").select("id").eq("invitation_code", code).maybeSingle();
      if (!existing) break;
      code = generateCode();
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("invitations").insert({
      token,
      invitation_code: code,
      email,
      role,
      branch_id: Number(branch_id),
      business_id: business_id ? Number(business_id) : null,
      invited_by: sender.user_id,
      status: "pending",
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const inviteLink = `${FRONTEND_URL}/invite/${token}`;
    const roleName = ROLE_LABELS[role] || role;

    await sendInviteEmail({ to: email, inviterName, roleName, branchName, inviteLink, code });

    return res.status(201).json({ success: true, message: "Invitation sent.", invite_link: inviteLink, code });
  } catch (error) {
    console.error("sendInvitation error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invitations — list invitations sent by the current user
const listInvitations = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .select("*, branches(name)")
      .eq("invited_by", req.user.user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ success: true, invitations: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invitations/:token — public, get invite details
const getInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .select("*, branches(name)")
      .eq("token", token)
      .maybeSingle();
    if (error || !data) return res.status(404).json({ success: false, message: "Invitation not found or expired." });
    if (data.status !== "pending") return res.status(410).json({ success: false, message: "This invitation has already been used or cancelled." });
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: "This invitation has expired." });
    }
    return res.json({ success: true, invitation: {
      email: data.email, role: data.role, branch_id: data.branch_id,
      branch_name: data.branches?.name || null, business_id: data.business_id,
      invitation_code: data.invitation_code,
    }});
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invitations/check-code/:code — public, look up invite by code
const getInvitationByCode = async (req, res) => {
  try {
    const code = req.params.code?.toUpperCase().trim();
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .select("*, branches(name)")
      .eq("invitation_code", code)
      .maybeSingle();
    if (error || !data) return res.status(404).json({ success: false, message: "Invitation code not found." });
    if (data.status !== "pending") return res.status(410).json({ success: false, message: "This invitation has already been used or cancelled." });
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: "This invitation code has expired." });
    }
    return res.json({ success: true, invitation: {
      token: data.token, email: data.email, role: data.role,
      branch_id: data.branch_id, branch_name: data.branches?.name || null,
      business_id: data.business_id, invitation_code: data.invitation_code,
    }});
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/invitations/:token/accept — create account OR link existing user
const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const { full_name, username, password, existing_user_id } = req.body;

    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from("invitations").select("*, branches(name)").eq("token", token).maybeSingle();
    if (fetchErr || !invite) return res.status(404).json({ success: false, message: "Invitation not found." });
    if (invite.status !== "pending") return res.status(410).json({ success: false, message: "This invitation has already been used." });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: "This invitation has expired." });
    }

    const generateToken = require("../utils/generateToken");

    // Case 1: existing logged-in user linking to the invitation
    if (existing_user_id) {
      // The caller must be authenticated as the exact account being linked — otherwise
      // anyone holding a valid invite token could pass an arbitrary existing_user_id and
      // get that account promoted (e.g. to manager) without ever proving they own it.
      if (!req.user || Number(req.user.user_id) !== Number(existing_user_id)) {
        return res.status(401).json({ success: false, message: "You must be logged in as the account you're linking to accept this invitation." });
      }

      const user = await prisma.users.findUnique({ where: { user_id: Number(existing_user_id) } });
      if (!user) return res.status(404).json({ success: false, message: "User not found." });

      // Create staff record if needed
      if (invite.branch_id && ["regular_staff", "casual_staff"].includes(invite.role)) {
        // Update role from pending to the invited role
        if (user.role === "pending") {
          await prisma.users.update({ where: { user_id: user.user_id }, data: { role: invite.role } });
        }
        const alreadyStaff = await prisma.staff.findFirst({ where: { user_id: user.user_id, branch_id: invite.branch_id } });
        if (!alreadyStaff) {
          await prisma.staff.create({
            data: { user_id: user.user_id, branch_id: invite.branch_id, staff_type: invite.role === "casual_staff" ? "casual" : "regular", is_active: true },
          });
        }
      } else if (invite.branch_id && invite.role === "manager") {
        // Update user role if needed
        if (user.role !== "manager" && user.role !== "business_owner" && user.role !== "system_admin") {
          await prisma.users.update({ where: { user_id: user.user_id }, data: { role: "manager" } });
        }
        const { data: alreadyMgr } = await supabaseAdmin.from("branch_managers").select("id").eq("user_id", user.user_id).eq("branch_id", invite.branch_id).maybeSingle();
        if (!alreadyMgr) {
          await supabaseAdmin.from("branch_managers").insert({ user_id: user.user_id, branch_id: invite.branch_id, is_primary: false });
        }
      }

      await supabaseAdmin.from("invitations").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: user.user_id }).eq("token", token);
      const updatedUser = await prisma.users.findUnique({ where: { user_id: user.user_id } });
      const jwtToken = generateToken({ user_id: updatedUser.user_id, email: updatedUser.email, role: updatedUser.role });
      return res.json({ success: true, message: "Joined successfully.", token: jwtToken, user: { user_id: updatedUser.user_id, full_name: updatedUser.full_name, email: updatedUser.email, role: updatedUser.role } });
    }

    // Case 2: new account creation
    if (!full_name || !username || !password) {
      return res.status(400).json({ success: false, message: "Full name, username, and password are required." });
    }
    if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });

    const existingByEmail = await prisma.users.findUnique({ where: { email: invite.email } });
    if (existingByEmail) return res.status(409).json({ success: false, message: "An account with this email already exists. Please log in instead." });

    const existingUsername = await prisma.users.findFirst({ where: { username: username.toLowerCase() } });
    if (existingUsername) return res.status(409).json({ success: false, message: "This username is already taken." });

    const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email, password, email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr) return res.status(400).json({ success: false, message: authErr.message });

    const newUser = await prisma.users.create({
      data: { full_name, username: username.toLowerCase(), email: invite.email, role: invite.role, is_active: true },
    });

    if (invite.branch_id && ["regular_staff", "casual_staff"].includes(invite.role)) {
      await prisma.staff.create({
        data: { user_id: newUser.user_id, branch_id: invite.branch_id, staff_type: invite.role === "casual_staff" ? "casual" : "regular", is_active: true },
      });
    } else if (invite.branch_id && invite.role === "manager") {
      const { data: alreadyMgr } = await supabaseAdmin.from("branch_managers").select("id").eq("user_id", newUser.user_id).eq("branch_id", invite.branch_id).maybeSingle();
      if (!alreadyMgr) {
        await supabaseAdmin.from("branch_managers").insert({ user_id: newUser.user_id, branch_id: invite.branch_id, is_primary: false });
      }
    }

    await supabaseAdmin.from("invitations").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: newUser.user_id }).eq("token", token);

    const jwtToken = generateToken({ user_id: newUser.user_id, email: newUser.email, role: newUser.role });
    return res.status(201).json({
      success: true, message: "Account created successfully.",
      token: jwtToken,
      user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
    });
  } catch (error) {
    console.error("acceptInvitation error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/invitations/:id/cancel
const cancelInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    await supabaseAdmin.from("invitations").update({ status: "cancelled" }).eq("id", id).eq("invited_by", req.user.user_id);
    return res.json({ success: true, message: "Invitation cancelled." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/invitations/resend/:id — resend the email for a pending invitation
const resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: invite } = await supabaseAdmin
      .from("invitations").select("*, branches(name)").eq("id", id).eq("invited_by", req.user.user_id).maybeSingle();
    if (!invite) return res.status(404).json({ success: false, message: "Invitation not found." });
    if (invite.status !== "pending") return res.status(400).json({ success: false, message: "Can only resend pending invitations." });

    const senderUser = await prisma.users.findUnique({ where: { user_id: req.user.user_id }, select: { full_name: true } });
    const inviteLink = `${FRONTEND_URL}/invite/${invite.token}`;
    await sendInviteEmail({
      to: invite.email, inviterName: senderUser?.full_name || "Someone",
      roleName: ROLE_LABELS[invite.role] || invite.role,
      branchName: invite.branches?.name || "", inviteLink, code: invite.invitation_code,
    });
    return res.json({ success: true, message: "Invitation resent." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { sendInvitation, listInvitations, getInvitation, getInvitationByCode, acceptInvitation, cancelInvitation, resendInvitation };
