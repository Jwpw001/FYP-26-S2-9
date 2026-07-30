const OpenAI = require("openai");
const { buildMessages, buildBriefMessages, TOOLS } = require("../services/aiAssistantService");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function chat(req, res) {
  try {
    const { question, conversationHistory } = req.body;
    const userId = req.user?.user_id;
    const role   = req.user?.role;

    if (!question?.trim()) {
      return res.status(400).json({ success: false, message: "Question is required." });
    }
    if (!userId || !role) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    if (!["manager", "business_owner", "regular_staff", "casual_staff"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "AI Workforce Assistant is not available for your role.",
      });
    }

    const messages = await buildMessages(userId, role, question.trim(), conversationHistory || []);

    // Stream via SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Only managers get action tools (business owners are read-only for now)
    const tools = role === "manager" ? TOOLS : undefined;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
      max_tokens: 1000,
      temperature: 0.3,
      stream: true,
    });

    let toolCallBuffer = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;

      // Accumulate tool call chunks
      if (delta?.tool_calls) {
        if (!toolCallBuffer) toolCallBuffer = { name: "", arguments: "" };
        toolCallBuffer.name      += delta.tool_calls[0]?.function?.name      || "";
        toolCallBuffer.arguments += delta.tool_calls[0]?.function?.arguments || "";
      }

      // Regular text content
      if (delta?.content) {
        res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
      }

      // Tool call complete — emit as special event so the frontend can show a confirmation card
      if (finishReason === "tool_calls" && toolCallBuffer) {
        try {
          const args = JSON.parse(toolCallBuffer.arguments);
          res.write(`data: ${JSON.stringify({ tool_call: { name: toolCallBuffer.name, args } })}\n\n`);
        } catch (e) {
          console.error("[AI] Failed to parse tool call args:", e);
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("AI Assistant error:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "The AI assistant is temporarily unavailable. Please try again.",
      });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted." })}\n\n`);
      res.end();
    } catch {}
  }
}

// Non-streaming proactive brief for the auto-brief on chat open (Phase 3.1)
async function brief(req, res) {
  try {
    const userId = req.user?.user_id;
    const role   = req.user?.role;

    if (!userId || !role) return res.status(401).json({ success: false, message: "Unauthorized." });
    if (!["manager", "business_owner", "regular_staff", "casual_staff"].includes(role)) {
      return res.status(403).json({ success: false, message: "Not available for your role." });
    }

    const messages = await buildBriefMessages(userId, role);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 400,
      temperature: 0.3,
    });

    res.json({ success: true, content: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI brief error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Brief unavailable." });
    }
  }
}

// Non-streaming AI review for a single shift draft in the Generate Week flow
async function shiftReview(req, res) {
  try {
    const role = req.user?.role;
    if (role !== "manager") return res.status(403).json({ success: false, message: "Managers only." });

    const { shift, roster } = req.body;
    if (!shift) return res.status(400).json({ success: false, message: "shift is required." });

    const date = new Date().toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" });

    // Build a name → roster lookup for quick access
    const rosterByName = {};
    (roster || []).forEach(s => { rosterByName[s.full_name] = s; });

    const rolesText = (shift.roles || []).map(r => {
      const assigned = (r.assigned_staff || []).filter(Boolean);
      const filled = assigned.length;
      const needed = r.headcount || 1;

      const assignedDetail = assigned.map(name => {
        const s = rosterByName[name];
        if (!s) return `${name} (no data)`;
        const issues = [
          s.is_on_leave       ? "ON LEAVE"        : null,
          s.is_double_booked  ? "DOUBLE-BOOKED"   : null,
          s.staff_type === "casual" && s.casual_available_today === false
            ? `casual NOT available this shift window` : null,
          s.staff_type === "casual" && s.casual_available_today === true && s.casual_avail_from
            ? `casual available ${s.casual_avail_from.slice(0,5)}–${s.casual_avail_to?.slice(0,5)}` : null,
        ].filter(Boolean).join(", ");
        const skillLevel = (s.skills || []).map(sk => sk.experience_level || sk).filter(Boolean).join(", ");
        const levelNote = skillLevel ? ` [skill level: ${skillLevel}]` : "";
        return issues ? `${name}${levelNote} [⚠️ ${issues}]` : `${name}${levelNote} (✅ ok)`;
      }).join(", ") || "nobody";

      const diffNote = r.difficulty && r.difficulty !== "any" ? ` [requires ${r.difficulty} level]` : "";
      return `  Role: "${r.role_name}"${diffNote} — needs ${needed}, assigned: ${assignedDetail}${filled < needed ? " → STILL NEEDS " + (needed - filled) + " more" : ""}`;
    }).join("\n") || "  (no roles defined)";

    const rosterText = (roster || []).map(s => {
      const skills = (s.skills || []).map(sk => sk.name || sk).filter(Boolean).join(", ") || "none";
      const status = s.is_on_leave
        ? "ON LEAVE"
        : s.is_double_booked
        ? "DOUBLE-BOOKED"
        : s.staff_type === "casual" && s.casual_available_today === false
        ? `casual — NOT available for this window${s.casual_avail_from ? ` (available ${s.casual_avail_from.slice(0,5)}–${s.casual_avail_to?.slice(0,5)} but doesn't cover shift)` : " (no availability set)"}`
        : s.staff_type === "casual" && s.casual_available_today === true
        ? `casual — available ${s.casual_avail_from?.slice(0,5) || "all day"}–${s.casual_avail_to?.slice(0,5) || ""}`
        : `regular — available`;
      return `  - ${s.full_name}: ${status}, skills: [${skills}], ${s.hours_this_week || 0}h worked this week`;
    }).join("\n") || "  (no roster data)";

    const messages = [
      {
        role: "system",
        content: `You are Krewby AI — a workforce scheduling assistant for F&B and service businesses in Singapore. Today is ${date}.
Review the shift draft below. Base your review ONLY on the data provided — do not invent or assume anything not listed.
Provide:
1. One-sentence overall assessment (✅ if all roles are filled with available staff, ⚠️ if there are issues)
2. For any role that is unfilled OR where an assigned staff member has a conflict/leave/unavailability, suggest the best UNASSIGNED available staff member with brief reasoning
3. Any warnings about current assignments — including skill-level mismatches (e.g. a beginner assigned to a role that requires senior level)
Be concise — max 6 bullet points. Bullet format only. No preamble.`,
      },
      {
        role: "user",
        content: `SHIFT: ${shift.title} on ${shift.date}, ${shift.start_time?.slice(0,5)}–${shift.end_time?.slice(0,5)}

CURRENT ROLE ASSIGNMENTS:
${rolesText}

ALL BRANCH STAFF (for suggestions):
${rosterText}

Review this shift assignment.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 400,
      temperature: 0.3,
    });

    res.json({ success: true, review: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI shift review error:", err);
    res.status(500).json({ success: false, message: "AI review unavailable." });
  }
}

// Non-streaming weekly schedule review — reviews all shifts for the week holistically
async function weeklyReview(req, res) {
  try {
    const role = req.user?.role;
    if (role !== "manager") return res.status(403).json({ success: false, message: "Managers only." });

    const { schedule, branchStaff } = req.body;
    if (!schedule?.length) return res.status(400).json({ success: false, message: "schedule is required." });

    const date = new Date().toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" });

    const scheduleText = schedule.map(s => {
      const rolesText = (s.roles || []).map(r => {
        const assigned = (r.assigned_staff || []).filter(Boolean);
        const gap = (r.headcount || 1) - assigned.length;
        return `    - ${r.role_name} (needs ${r.headcount||1}): ${assigned.length ? assigned.join(", ") : "NOBODY"}${gap > 0 ? ` [⚠️ ${gap} unfilled]` : ""}`;
      }).join("\n") || "    (no roles)";
      return `${s.date} | ${s.title} ${s.start_time?.slice(0,5)}–${s.end_time?.slice(0,5)}\n${rolesText}`;
    }).join("\n\n");

    const staffText = (branchStaff || []).map(s => `  - ${s.full_name} (${s.staff_type || "regular"})`).join("\n") || "  (no staff data)";

    // Count how often each staff member appears
    const countMap = {};
    (schedule || []).forEach(s => (s.roles || []).forEach(r => (r.assigned_staff || []).forEach(n => { countMap[n] = (countMap[n] || 0) + 1; })));
    const workloadText = Object.entries(countMap).sort((a,b)=>b[1]-a[1]).map(([n,c]) => `  - ${n}: ${c} shift(s)`).join("\n") || "  (none)";

    const messages = [
      {
        role: "system",
        content: `You are Krewby AI — a workforce scheduling assistant for F&B and service businesses in Singapore. Today is ${date}.
Review the full week schedule below. Focus on:
1. Overall coverage — are all roles filled?
2. Staff workload balance — anyone overloaded or underused?
3. Skill or headcount gaps that need urgent attention
4. Any quick-win suggestions to improve the schedule
Be concise — max 8 bullet points. Bullet format only. Lead with an overall verdict (✅ Ready / ⚠️ Needs attention / ❌ Critical gaps). No preamble.`,
      },
      {
        role: "user",
        content: `WEEKLY SCHEDULE:\n${scheduleText}\n\nSHIFT WORKLOAD:\n${workloadText}\n\nALL STAFF:\n${staffText}\n\nReview this week's schedule.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
      temperature: 0.3,
    });

    res.json({ success: true, review: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI weekly review error:", err);
    res.status(500).json({ success: false, message: "AI review unavailable." });
  }
}

module.exports = { chat, brief, shiftReview, weeklyReview };
