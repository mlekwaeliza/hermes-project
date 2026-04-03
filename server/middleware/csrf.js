const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 *
 * Uses double-submit cookie pattern:
 * 1. Generates a token and sets it as a cookie on authenticated requests for safe methods
 * 2. Verifies that the token in request headers matches the cookie for state-changing methods
 *
 * This is appropriate for SPAs using cookie-based authentication.
 */

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Token is already stored in the csrfToken cookie - just verify it matches
function verifyToken(headerToken, cookieToken) {
  return headerToken && cookieToken && headerToken === cookieToken;
}

function csrfProtect(options = {}) {
  const {
    cookieName = 'csrfToken',
    headerName = 'X-CSRF-Token',
    ignoredMethods = ['GET', 'HEAD', 'OPTIONS']
  } = options;

  return (req, res, next) => {
    const method = req.method;

    // For safe methods (GET/HEAD/OPTIONS), set token if authenticated and cookie not present
    if (ignoredMethods.includes(method)) {
      if (req.session.userId) {
        // Set a CSRF token if not already present
        if (!req.cookies[cookieName]) {
          const token = generateToken();
          res.cookie(cookieName, token, {
            httpOnly: false, // Must be readable by JavaScript to send in headers
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
          });
        }
        // Also rotate token periodically (optional - could rotate on each safe request)
      }
      return next();
    }

    // For state-changing methods (POST/PUT/DELETE etc):
    // Only require CSRF token if user is authenticated
    if (!req.session.userId) {
      // Unauthenticated requests can proceed (e.g., login route)
      return next();
    }

    const headerToken = req.get(headerName);
    const cookieToken = req.cookies[cookieName];

    if (!headerToken) {
      return res.status(403).json({
        error: 'CSRF token missing',
        details: `Request must include '${headerName}' header`
      });
    }

    if (!cookieToken) {
      // Token cookie not found - may have been expired or not set
      return res.status(403).json({
        error: 'CSRF token not found',
        details: 'Please reload the page and try again'
      });
    }

    if (!verifyToken(headerToken, cookieToken)) {
      return res.status(403).json({
        error: 'CSRF token mismatch',
        details: 'Invalid CSRF token - possible cross-site request forgery'
      });
    }

    next();
  };
}

module.exports = { csrfProtect };
