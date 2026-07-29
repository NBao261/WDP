import { Request, Response, NextFunction } from 'express';

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const NULL_BYTE_RE = /\0/g;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(NULL_BYTE_RE, '')
      .replace(HTML_TAG_RE, '')
      .trim();
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
