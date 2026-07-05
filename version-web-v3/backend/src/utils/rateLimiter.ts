import { Request, Response, NextFunction } from 'express';

interface WindowEntry {
  count: number;
  resetAt: number;
}

const ipWindows = new Map<string, WindowEntry>();

/**
 * Create rate-limiting middleware.
 *
 * @param windowMs  sliding window in ms
 * @param max       max requests per IP in the window
 * @param globalMax max requests total across ALL IPs in the window (0 = unlimited)
 */
export function rateLimit(windowMs: number, max: number, globalMax = 0) {
  let globalTokens = globalMax;
  const globalMaxTokens = globalMax;
  let globalResetAt = Date.now() + windowMs;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Global limit
    if (globalMax > 0) {
      if (now > globalResetAt) {
        globalTokens = globalMaxTokens;
        globalResetAt = now + windowMs;
      }
      if (globalTokens <= 0) {
        res.status(429).json({ error: 'Global rate limit exceeded. Try again later.' });
        return;
      }
      globalTokens--;
    }

    // Per-IP limit
    let entry = ipWindows.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      ipWindows.set(ip, entry);
    }

    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.status(429).json({
        error: `Too many requests. Try again in ${retryAfter}s.`,
        retryAfter,
      });
      return;
    }

    next();
  };
}

/** Periodic cleanup of stale entries (run every 60s) */
export const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipWindows) {
    if (now > entry.resetAt) ipWindows.delete(ip);
  }
}, 60_000);
