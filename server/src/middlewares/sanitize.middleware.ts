import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize middleware — Strip HTML tags, null bytes, and trim strings.
 * Áp dụng đệ quy cho tất cả string values trong req.body, req.query, req.params.
 *
 * Chống:
 *  - XSS (strip <script>, <img onerror>, etc.)
 *  - Null byte injection (\0)
 *  - Whitespace padding
 */

// Regex strip HTML tags (bao gồm self-closing và attributes)
const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
// Null bytes
const NULL_BYTE_RE = /\0/g;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(NULL_BYTE_RE, '')   // Remove null bytes
      .replace(HTML_TAG_RE, '')    // Strip HTML tags
      .trim();                     // Trim whitespace
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    sanitized[key] = sanitizeValue(obj[key]);
  }
  return sanitized;
}

export const sanitize = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as any;
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as any;
  }

  next();
};
