import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_parking',

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',

  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  MOMO_PARTNER_CODE: process.env.MOMO_PARTNER_CODE || '',
  MOMO_ACCESS_KEY: process.env.MOMO_ACCESS_KEY || '',
  MOMO_SECRET_KEY: process.env.MOMO_SECRET_KEY || '',
  MOMO_API_URL: process.env.MOMO_API_URL || 'https://test-payment.momo.vn/v2/gateway/api/create',
  MOMO_QUERY_URL: process.env.MOMO_QUERY_URL || 'https://test-payment.momo.vn/v2/gateway/api/query',
  MOMO_IPN_URL: process.env.MOMO_IPN_URL || 'http://localhost:8000/api/v1/payments/webhook',
} as const;
