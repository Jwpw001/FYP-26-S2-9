const OpenAI = require("openai");
const { buildMessages } = require("../services/aiAssistantService");

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
    if (!["manager", "business_owner"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "AI Workforce Assistant is available for managers and business owners only.",
      });
    }

    const messages = await buildMessages(userId, role, question.trim(), conversationHistory || []);

    // Stream via SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 700,
      temperature: 0.4,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
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

module.exports = { chat };
