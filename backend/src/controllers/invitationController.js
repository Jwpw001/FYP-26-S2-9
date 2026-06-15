const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const crypto = require("crypto");

const ROLE_HIERARCHY = {
  system_admin:        5,
  business_owner:      4,
  outlet_manager:      3,
  regular_staff:       2,
  outlet_casual_staff: 2,
  krewby_casual_worker:1,
};

// POST /api/invitations/send
const sendInvitation = async (req, res) => {
  try {
    const sender = req.user;
    const { email, role, outlet_id, business_id } = req.body;

    if (!email || !role) return res.status(400).json({ success: false, message: "Email and role are required." });

    // Enforce hierarchy — cannot invite to a role >= own role
    const senderLevel = ROLE_HIERARCHY[sender.role] || 0;
    const targetLevel = ROLE_HIERARCHY[role] || 0;
    if (targetLevel >= senderLevel) return res.status(403).json({ success: false, message: "You cannot invite someone to a role equal or higher than your own." });

    // Check if user already exists
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ success: false, message: "A user with this email already exists." });

    // Cancel any existing pending invite for this email + role
    await supabaseAdmin.from("invitations").update({ status: "cancelled" }).eq("email", email).eq("status", "pending");

    const token = crypto.randomBytes(32).toString("hex");
    const { error } = await supabaseAdmin.from("invitations").insert({
      token,
      email,
      role,
      outlet_id: outlet_id || null,
      business_id: business_id || null,
      invited_by: sender.user_id,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    const inviteLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/invite/${token}`;
    return res.status(201).json({ success: true, message: "Invitation created.", invite_link: inviteLink, token });
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
      .select("*")
      .eq("invited_by", req.user.user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ success: true, invitations: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/invitations/:token — public, get invite details for the accept page
const getInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const { data, error } = await supabaseAdmin.from("invitations").select("*").eq("token", token).maybeSingle();
    if (error || !data) return res.status(404).json({ success: false, message: "Invitation not found or expired." });
    if (data.status !== "pending") return res.status(410).json({ success: false, message: "This invitation has already been used or cancelled." });
    if (new Date(data.expires_at) < new Date()) return res.status(410).json({ success: false, message: "This invitation has expired." });

    return res.json({ success: true, invitation: { email: data.email, role: data.role, outlet_id: data.outlet_id, business_id: data.business_id } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/invitations/:token/accept — public, create account from invite
const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;
    const { full_name, username, password } = req.body;

    if (!full_name || !username || !password) return res.status(400).json({ success: false, message: "Full name, username, and password are required." });
    if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });

    const { data: invite, error: fetchErr } = await supabaseAdmin.from("invitations").select("*").eq("token", token).maybeSingle();
    if (fetchErr || !invite) return res.status(404).json({ success: false, message: "Invitation not found." });
    if (invite.status !== "pending") return res.status(410).json({ success: false, message: "This invitation has already been used." });
    if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ success: false, message: "This invitation has expired." });

    const existing = await prisma.users.findUnique({ where: { email: invite.email } });
    if (existing) return res.status(409).json({ success: false, message: "An account with this email already exists." });

    const existingUsername = await prisma.users.findFirst({ where: { username: username.toLowerCase() } });
    if (existingUsername) return res.status(409).json({ success: false, message: "This username is already taken." });

    // Create Supabase auth user
    const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email, password, email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr) return res.status(400).json({ success: false, message: authErr.message });

    // Create user record
    const newUser = await prisma.users.create({
      data: { full_name, username: username.toLowerCase(), email: invite.email, role: invite.role, is_active: true },
    });

    // Create staff record if outlet assigned
    if (invite.outlet_id && ["regular_staff", "outlet_casual_staff"].includes(invite.role)) {
      await prisma.staff.create({
        data: { user_id: newUser.user_id, outlet_id: invite.outlet_id, staff_type: invite.role === "outlet_casual_staff" ? "casual" : "regular", is_active: true },
      });
    }

    // Mark invite as accepted
    await supabaseAdmin.from("invitations").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("token", token);

    const generateToken = require("../utils/generateToken");
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

module.exports = { sendInvitation, listInvitations, getInvitation, acceptInvitation, cancelInvitation };
