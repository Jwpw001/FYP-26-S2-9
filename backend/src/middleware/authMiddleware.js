const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.users.findUnique({
      where: { user_id: decoded.user_id },
      select: { is_active: true },
    });
    if (!user || !user.is_active) {
      return res.status(403).json({ success: false, message: "Account is deactivated." });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
module.exports = verifyToken;
