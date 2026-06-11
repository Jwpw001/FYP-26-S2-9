const { askAssistant } = require("../services/aiAssistantService");

async function chat(req, res) {
  try {
    const { question, conversationHistory } = req.body;
    const userId = req.user?.user_id;
    const role = req.user?.role;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: "Question is required." });
    }

    if (!userId || !role) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    // Only managers and coordinators can use the AI assistant
    if (!["manager", "coordinator"].includes(role)) {
      return res.status(403).json({
        success: false,
        message: "AI Workforce Assistant is available for managers and coordinators only.",
      });
    }

    const { answer } = await askAssistant(userId, role, question.trim(), conversationHistory || []);

    return res.json({ success: true, answer });
  } catch (err) {
    console.error("AI Assistant error:", err);
    return res.status(500).json({
      success: false,
      message: "The AI assistant is temporarily unavailable. Please try again.",
    });
  }
}

module.exports = { chat };
