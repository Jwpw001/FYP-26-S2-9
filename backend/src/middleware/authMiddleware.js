const jwt = require("jsonwebtoken");
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Decodes a Bearer token into req.user if present/valid, but never blocks the request.
// For routes that serve both an anonymous flow and an "as the logged-in user" flow
// (e.g. invitation accept: new account vs. linking an existing account).
verifyToken.optional = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      // invalid/expired token on an optional route — proceed unauthenticated
    }
  }
  next();
};

module.exports = verifyToken;