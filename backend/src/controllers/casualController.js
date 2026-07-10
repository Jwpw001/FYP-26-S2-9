const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const generateToken = require("../utils/generateToken");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/casual/register
// Casual worker self-registers using a business join code
async function registerCasualWorker(req, res) {
  try {
    const { full_name, username: rawUsername, email, password, join_code, bio } = req.body;

    if (!full_name || !rawUsername || !email || !password || !join_code) {
      return res.status(400).json({ success: false, message: "All fields and a valid join code are required." });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const username = rawUsername.trim().toLowerCase();

    // Look up business by join code
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("business_id, name")
      .eq("join_code", join_code.trim().toUpperCase())
      .maybeSingle();

    if (!biz) {
      return res.status(404).json({ success: false, message: "Invalid join code. Please check with your employer." });
    }

    // Check email uniqueness
    const existingEmail = await prisma.users.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const existingUsername = await prisma.users.findFirst({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: "This username is already taken." });
    }

    // Create Supabase auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr) return res.status(400).json({ success: false, message: authErr.message });

    // Create user record
    const newUser = await prisma.users.create({
      data: { full_name, username, email, role: "outlet_casual_staff", is_active: true },
    });

    // Create casual_workers pool entry (pending approval)
    const { error: cwErr } = await supabaseAdmin.from("casual_workers").insert({
      user_id: newUser.user_id,
      business_id: biz.business_id,
      status: "pending",
      bio: bio || null,
    });
    if (cwErr) throw new Error(cwErr.message);

    const token = generateToken({ user_id: newUser.user_id, email: newUser.email, role: newUser.role });

    return res.status(201).json({
      success: true,
      message: `Application submitted! ${biz.name} will review and approve your account.`,
      token,
      user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
      approval_status: "pending",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CASUAL WORKER — own endpoints
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/me — approval status + pool info
async function getCasualWorkerStatus(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("id, business_id, status, bio, joined_at, approved_at")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    let businessName = null;
    if (cw.business_id) {
      const { data: biz } = await supabaseAdmin.from("businesses").select("name").eq("business_id", cw.business_id).maybeSingle();
      businessName = biz?.name || null;
    }

    return res.json({ success: true, casual_worker: { ...cw, business_name: businessName } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/requests — browse open requests for the worker's business
async function browseRequests(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("business_id, status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw || cw.status !== "approved") {
      return res.status(403).json({ success: false, message: "Your account is pending approval." });
    }

    const { data: requests } = await supabaseAdmin
      .from("casual_requests")
      .select(`
        request_id, role_name, work_date, start_time, end_time, headcount, notes, status, created_at,
        outlets ( outlet_id, name, address )
      `)
      .eq("business_id", cw.business_id)
      .eq("status", "open")
      .order("work_date", { ascending: true });

    // Check which ones this worker already applied to
    const requestIds = (requests || []).map(r => r.request_id);
    let appliedIds = new Set();
    if (requestIds.length > 0) {
      const { data: myApps } = await supabaseAdmin
        .from("casual_request_applications")
        .select("request_id")
        .eq("casual_worker_id", req.user.user_id)
        .in("request_id", requestIds);
      (myApps || []).forEach(a => appliedIds.add(a.request_id));
    }

    const enriched = (requests || []).map(r => ({
      ...r,
      already_applied: appliedIds.has(r.request_id),
    }));

    return res.json({ success: true, requests: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/requests/:id/apply — tap "I'm available"
async function applyToRequest(req, res) {
  try {
    const requestId = Number(req.params.id);

    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw || cw.status !== "approved") {
      return res.status(403).json({ success: false, message: "Your account is pending approval." });
    }

    // Check request exists and is open
    const { data: request } = await supabaseAdmin
      .from("casual_requests")
      .select("request_id, status, headcount")
      .eq("request_id", requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "open") return res.status(400).json({ success: false, message: "This request is no longer open." });

    const { error } = await supabaseAdmin.from("casual_request_applications").insert({
      request_id: requestId,
      casual_worker_id: req.user.user_id,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") return res.status(409).json({ success: false, message: "You already applied to this request." });
      throw new Error(error.message);
    }

    return res.status(201).json({ success: true, message: "Application submitted! The manager will review and confirm." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /api/casual/requests/:id/apply — withdraw application
async function withdrawApplication(req, res) {
  try {
    const requestId = Number(req.params.id);

    const { error } = await supabaseAdmin
      .from("casual_request_applications")
      .delete()
      .eq("request_id", requestId)
      .eq("casual_worker_id", req.user.user_id)
      .eq("status", "pending");

    if (error) throw new Error(error.message);

    return res.json({ success: true, message: "Application withdrawn." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/my-applications — see my applications and their status
async function getMyApplications(req, res) {
  try {
    const { data: apps } = await supabaseAdmin
      .from("casual_request_applications")
      .select(`
        application_id, status, applied_at,
        casual_requests (
          request_id, role_name, work_date, start_time, end_time, headcount, notes, status,
          outlets ( outlet_id, name, address )
        )
      `)
      .eq("casual_worker_id", req.user.user_id)
      .order("applied_at", { ascending: false });

    return res.json({ success: true, applications: apps || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER — request management
// ─────────────────────────────────────────────────────────────────────────────

async function resolveManagerOutlet(userId) {
  const link = await prisma.staff.findFirst({
    where: { user_id: userId },
    select: { outlet_id: true },
  });
  if (!link) return null;
  const outlet = await prisma.outlets.findUnique({
    where: { outlet_id: link.outlet_id },
    select: { outlet_id: true, business_id: true, name: true },
  });
  return outlet || null;
}

// POST /api/casual/manager/requests — create a new request
async function createRequest(req, res) {
  try {
    const outlet = await resolveManagerOutlet(req.user.user_id);
    if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found for this manager." });

    const { role_name, work_date, start_time, end_time, headcount, notes } = req.body;
    if (!role_name || !work_date || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: "role_name, work_date, start_time, and end_time are required." });
    }

    const { data, error } = await supabaseAdmin.from("casual_requests").insert({
      outlet_id: outlet.outlet_id,
      business_id: outlet.business_id,
      created_by: req.user.user_id,
      role_name,
      work_date,
      start_time,
      end_time,
      headcount: headcount || 1,
      notes: notes || null,
      status: "open",
    }).select().single();

    if (error) throw new Error(error.message);

    return res.status(201).json({ success: true, request: data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/manager/requests — list all requests for this outlet
async function listManagerRequests(req, res) {
  try {
    const outlet = await resolveManagerOutlet(req.user.user_id);
    if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found." });

    const { data: requests } = await supabaseAdmin
      .from("casual_requests")
      .select("request_id, role_name, work_date, start_time, end_time, headcount, notes, status, created_at")
      .eq("outlet_id", outlet.outlet_id)
      .order("work_date", { ascending: false });

    // Applicant counts per request
    const ids = (requests || []).map(r => r.request_id);
    let countMap = {};
    if (ids.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from("casual_request_applications")
        .select("request_id, status")
        .in("request_id", ids);
      (counts || []).forEach(a => {
        if (!countMap[a.request_id]) countMap[a.request_id] = { total: 0, confirmed: 0 };
        countMap[a.request_id].total++;
        if (a.status === "confirmed") countMap[a.request_id].confirmed++;
      });
    }

    const enriched = (requests || []).map(r => ({
      ...r,
      applicant_count: countMap[r.request_id]?.total || 0,
      confirmed_count: countMap[r.request_id]?.confirmed || 0,
    }));

    return res.json({ success: true, requests: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/manager/requests/:id — request detail with applicants
async function getRequestDetail(req, res) {
  try {
    const requestId = Number(req.params.id);

    const { data: request } = await supabaseAdmin
      .from("casual_requests")
      .select("*, outlets ( name, address )")
      .eq("request_id", requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ success: false, message: "Request not found." });

    // Verify manager owns this outlet
    const outlet = await resolveManagerOutlet(req.user.user_id);
    if (!outlet || outlet.outlet_id !== request.outlet_id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Get applicants with user details
    const { data: apps } = await supabaseAdmin
      .from("casual_request_applications")
      .select("application_id, status, applied_at, casual_worker_id")
      .eq("request_id", requestId)
      .order("applied_at", { ascending: true });

    const applicantsWithDetails = await Promise.all((apps || []).map(async (app) => {
      const user = await prisma.users.findUnique({
        where: { user_id: app.casual_worker_id },
        select: { user_id: true, full_name: true, email: true },
      });

      // Get skills
      const { data: skills } = await supabaseAdmin
        .from("user_skill_tags")
        .select("skills ( name )")
        .eq("user_id", app.casual_worker_id);

      // Get past confirmed jobs count
      const { count: jobCount } = await supabaseAdmin
        .from("casual_request_applications")
        .select("*", { count: "exact", head: true })
        .eq("casual_worker_id", app.casual_worker_id)
        .eq("status", "confirmed");

      return {
        ...app,
        full_name: user?.full_name,
        email: user?.email,
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
        confirmed_jobs: jobCount || 0,
      };
    }));

    return res.json({ success: true, request, applicants: applicantsWithDetails });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/manager/requests/:id/confirm/:application_id — confirm an applicant
async function confirmApplicant(req, res) {
  try {
    const requestId = Number(req.params.id);
    const applicationId = Number(req.params.application_id);

    const { data: request } = await supabaseAdmin
      .from("casual_requests")
      .select("outlet_id, headcount, status")
      .eq("request_id", requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "open") return res.status(400).json({ success: false, message: "Request is no longer open." });

    const outlet = await resolveManagerOutlet(req.user.user_id);
    if (!outlet || outlet.outlet_id !== request.outlet_id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Check confirmed count
    const { count: confirmedCount } = await supabaseAdmin
      .from("casual_request_applications")
      .select("*", { count: "exact", head: true })
      .eq("request_id", requestId)
      .eq("status", "confirmed");

    if ((confirmedCount || 0) >= request.headcount) {
      return res.status(400).json({ success: false, message: "Headcount already filled." });
    }

    const { error } = await supabaseAdmin
      .from("casual_request_applications")
      .update({ status: "confirmed" })
      .eq("application_id", applicationId)
      .eq("request_id", requestId);

    if (error) throw new Error(error.message);

    // If now fully filled, close the request
    const newConfirmed = (confirmedCount || 0) + 1;
    if (newConfirmed >= request.headcount) {
      await supabaseAdmin.from("casual_requests").update({ status: "filled" }).eq("request_id", requestId);
    }

    // Notify the worker
    const { data: app } = await supabaseAdmin
      .from("casual_request_applications")
      .select("casual_worker_id, casual_requests(role_name, work_date)")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (app?.casual_worker_id) {
      await supabaseAdmin.from("notifications").insert({
        recipient_id: app.casual_worker_id,
        type: "casual_confirmed",
        title: "You've been confirmed!",
        message: `You've been confirmed for ${app.casual_requests?.role_name || "a shift"} on ${app.casual_requests?.work_date}.`,
        related_entity: "casual_request",
        related_id: requestId,
      });
    }

    return res.json({ success: true, message: "Applicant confirmed." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/manager/requests/:id/cancel — cancel a request
async function cancelRequest(req, res) {
  try {
    const requestId = Number(req.params.id);
    const outlet = await resolveManagerOutlet(req.user.user_id);

    const { data: request } = await supabaseAdmin
      .from("casual_requests")
      .select("outlet_id")
      .eq("request_id", requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (!outlet || outlet.outlet_id !== request.outlet_id) return res.status(403).json({ success: false, message: "Access denied." });

    await supabaseAdmin.from("casual_requests").update({ status: "cancelled" }).eq("request_id", requestId);

    return res.json({ success: true, message: "Request cancelled." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/manager/requests/:id/ai-recommend — AI picks best applicant
async function aiRecommend(req, res) {
  try {
    const requestId = Number(req.params.id);

    const { data: request } = await supabaseAdmin
      .from("casual_requests")
      .select("*, outlets(name)")
      .eq("request_id", requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ success: false, message: "Request not found." });

    const outlet = await resolveManagerOutlet(req.user.user_id);
    if (!outlet || outlet.outlet_id !== request.outlet_id) return res.status(403).json({ success: false, message: "Access denied." });

    const { data: apps } = await supabaseAdmin
      .from("casual_request_applications")
      .select("application_id, casual_worker_id, applied_at")
      .eq("request_id", requestId)
      .eq("status", "pending");

    if (!apps || apps.length === 0) {
      return res.status(400).json({ success: false, message: "No pending applicants to evaluate." });
    }

    // Build applicant profiles
    const profiles = await Promise.all(apps.map(async (app) => {
      const user = await prisma.users.findUnique({
        where: { user_id: app.casual_worker_id },
        select: { full_name: true, email: true },
      });

      const { data: skills } = await supabaseAdmin
        .from("user_skill_tags")
        .select("skills(name)")
        .eq("user_id", app.casual_worker_id);

      const { count: jobsDone } = await supabaseAdmin
        .from("casual_request_applications")
        .select("*", { count: "exact", head: true })
        .eq("casual_worker_id", app.casual_worker_id)
        .eq("status", "confirmed");

      // Past experience at this outlet
      const { count: outletJobs } = await supabaseAdmin
        .from("casual_request_applications")
        .select("application_id, casual_requests!inner(outlet_id)", { count: "exact", head: true })
        .eq("casual_worker_id", app.casual_worker_id)
        .eq("status", "confirmed")
        .eq("casual_requests.outlet_id", outlet.outlet_id);

      return {
        application_id: app.application_id,
        casual_worker_id: app.casual_worker_id,
        full_name: user?.full_name || "Unknown",
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
        total_confirmed_jobs: jobsDone || 0,
        jobs_at_this_outlet: outletJobs || 0,
        applied_at: app.applied_at,
      };
    }));

    const prompt = `You are helping a manager pick the best casual worker for a job request.

Request details:
- Role needed: ${request.role_name}
- Date: ${request.work_date}
- Time: ${request.start_time} – ${request.end_time}
- Branch: ${request.outlets?.name || ""}
- Notes: ${request.notes || "None"}

Applicants:
${profiles.map((p, i) => `
${i + 1}. ${p.full_name} (application_id: ${p.application_id})
   - Skills: ${p.skills.length > 0 ? p.skills.join(", ") : "None listed"}
   - Total confirmed jobs: ${p.total_confirmed_jobs}
   - Jobs at this branch: ${p.jobs_at_this_outlet}
   - Applied: ${p.applied_at}
`).join("")}

Rank these applicants and recommend the best one. Consider:
1. Skill match with the role
2. Experience at this specific branch (familiarity is a plus)
3. Overall reliability (more confirmed jobs = more reliable)
4. Who applied earliest (tie-breaker)

Respond in JSON only:
{
  "recommended_application_id": <number>,
  "recommended_name": "<string>",
  "reason": "<one concise sentence explaining why they're the best pick>",
  "ranking": [
    { "application_id": <number>, "name": "<string>", "score_reason": "<short>" }
  ]
}`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    let result;
    try {
      const text = msg.content[0].text.trim().replace(/^```json\s*|```$/g, "");
      result = JSON.parse(text);
    } catch {
      return res.status(500).json({ success: false, message: "AI response parsing failed." });
    }

    return res.json({ success: true, recommendation: result, applicants: profiles });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS OWNER — pool management
// ─────────────────────────────────────────────────────────────────────────────

async function resolveOwnerBusiness(userId) {
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("business_id, name, join_code")
    .eq("owner_id", userId)
    .maybeSingle();
  return biz || null;
}

// GET /api/casual/pool — all casual workers in this business
async function getPool(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { status } = req.query;

    let query = supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status, bio, joined_at, approved_at")
      .eq("business_id", biz.business_id)
      .order("joined_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data: workers } = await query;

    const enriched = await Promise.all((workers || []).map(async (w) => {
      const user = await prisma.users.findUnique({
        where: { user_id: w.user_id },
        select: { full_name: true, email: true, username: true },
      });
      const { data: skills } = await supabaseAdmin
        .from("user_skill_tags")
        .select("skills(name)")
        .eq("user_id", w.user_id);

      return {
        ...w,
        full_name: user?.full_name,
        email: user?.email,
        username: user?.username,
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
      };
    }));

    return res.json({ success: true, workers: enriched, join_code: biz.join_code });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/pool/:id/approve
async function approveWorker(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { error } = await supabaseAdmin
      .from("casual_workers")
      .update({ status: "approved", approved_by: req.user.user_id, approved_at: new Date().toISOString() })
      .eq("id", Number(req.params.id))
      .eq("business_id", biz.business_id);

    if (error) throw new Error(error.message);

    // Get worker user_id to notify
    const { data: cw } = await supabaseAdmin.from("casual_workers").select("user_id").eq("id", Number(req.params.id)).maybeSingle();
    if (cw?.user_id) {
      await supabaseAdmin.from("notifications").insert({
        recipient_id: cw.user_id,
        type: "casual_approved",
        title: "Your application was approved!",
        message: `You've been approved as a casual worker for ${biz.name}. You can now browse and apply to open requests.`,
        related_entity: "casual_worker",
        related_id: Number(req.params.id),
      });
    }

    return res.json({ success: true, message: "Worker approved." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/pool/:id/reject
async function rejectWorker(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { error } = await supabaseAdmin
      .from("casual_workers")
      .update({ status: "rejected" })
      .eq("id", Number(req.params.id))
      .eq("business_id", biz.business_id);

    if (error) throw new Error(error.message);

    return res.json({ success: true, message: "Worker rejected." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/join-code — get join code for BO
async function getJoinCode(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    // Generate one if missing
    if (!biz.join_code) {
      const code = generateJoinCode();
      await supabaseAdmin.from("businesses").update({ join_code: code }).eq("business_id", biz.business_id);
      return res.json({ success: true, join_code: code });
    }

    return res.json({ success: true, join_code: biz.join_code });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/join-code/regenerate
async function regenerateJoinCode(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const code = generateJoinCode();
    const { error } = await supabaseAdmin.from("businesses").update({ join_code: code }).eq("business_id", biz.business_id);
    if (error) throw new Error(error.message);

    return res.json({ success: true, join_code: code });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${rand(4)}-${rand(4)}`;
}

module.exports = {
  registerCasualWorker,
  getCasualWorkerStatus,
  browseRequests,
  applyToRequest,
  withdrawApplication,
  getMyApplications,
  createRequest,
  listManagerRequests,
  getRequestDetail,
  confirmApplicant,
  cancelRequest,
  aiRecommend,
  getPool,
  approveWorker,
  rejectWorker,
  getJoinCode,
  regenerateJoinCode,
};
