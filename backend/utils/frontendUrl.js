const DEFAULT_DEV_FRONTEND_URL = 'http://localhost:5173';
let warnedMultiFrontendUrl = false;

/**
 * Parse a comma-separated URL/origin list into unique normalized HTTP(S) origins
 * (scheme + host + optional port, without trailing slashes or paths).
 */
const parseOrigins = (raw) => {
  if (!raw || typeof raw !== 'string') return [];

  const origins = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        origins.push(parsed.origin);
      }
    } catch {
      // Ignore malformed origin entries safely.
    }
  }
  return [...new Set(origins)];
};

/**
 * Resolve the single canonical frontend base URL used for email action links
 * (account verification, password reset). Safely extracts a single valid origin
 * if a comma-separated list is accidentally provided.
 */
const getFrontendUrl = () => {
  const candidates = parseOrigins(process.env.FRONTEND_URL);

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1) {
    if (!warnedMultiFrontendUrl) {
      warnedMultiFrontendUrl = true;
      console.warn(
        '⚠️ FRONTEND_URL contains multiple comma-separated URLs. Set FRONTEND_URL to a single canonical URL and configure additional CORS domains in CORS_ORIGINS.'
      );
    }
    return candidates.find((origin) => !origin.includes('hostel-snacks')) || candidates[0];
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL must be configured with a valid http/https URL in production.');
  }

  return DEFAULT_DEV_FRONTEND_URL;
};

/**
 * Resolve all allowed CORS origins from FRONTEND_URL and CORS_ORIGINS.
 */
const getAllowedOrigins = () => {
  const combined = [
    ...new Set([
      ...parseOrigins(process.env.FRONTEND_URL),
      ...parseOrigins(process.env.CORS_ORIGINS),
    ]),
  ];
  return combined.length > 0 ? combined : [DEFAULT_DEV_FRONTEND_URL];
};

module.exports = {
  parseOrigins,
  getFrontendUrl,
  getAllowedOrigins,
};
