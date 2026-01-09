const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECERT;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

/*
Hard auth – token REQUIRED
*/
function requireAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) return res.status(401).json({ error: "NO_AUTH_TOKEN" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: payload.userId,
      email: payload.email,
    };

    next();
  } catch {
    return res.status(401).json({ error: "INVALID_AUTH_TOKEN" });
  }
}

/*
Soft auth – token OPTIONAL
*/
function optionalAuth(req, res, next) {
  const token = extractBearer(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: payload.userId,
      email: payload.email,
    };
  } catch {
    // silently drop invalid token
  }

  next();
}

/*
ONLY Authorization: Bearer <token>
*/
function extractBearer(req) {
  const header = req.headers.authorization;
  if (!header) return null;

  if (!header.startsWith("Bearer ")) return null;

  return header.slice(7).trim();
}

module.exports = {
  requireAuth,
  optionalAuth,
};
