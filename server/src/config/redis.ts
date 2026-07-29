import Redis from 'ioredis';
import Redlock from 'redlock';
import { env } from './env';
import { logger } from './logger';

let redis: Redis | null = null;
let isConnected = false;

export function getRedis(): Redis | null {
  if (redis) return redis;

  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn('[Redis] Max retries reached, giving up reconnection');
          return null;
        }
        return Math.min(times * 500, 3000);
      },
      lazyConnect: false,
    });

    redis.on('connect', () => {
      isConnected = true;
      logger.info('[Redis] Connected successfully');
    });

    redis.on('error', (err) => {
      isConnected = false;
      logger.error('[Redis] Connection error', { error: err.message });
    });

    redis.on('close', () => {
      isConnected = false;
      logger.warn('[Redis] Connection closed');
    });

    return redis;
  } catch (err: any) {
    logger.error('[Redis] Failed to create client', { error: err.message });
    return null;
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redis !== null;
}

let redlock: Redlock | null = null;
export function getRedlock(): Redlock | null {
  if (redlock) return redlock;
  const client = getRedis();
  if (client && isConnected) {
    redlock = new Redlock([client], {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 200,
      retryJitter: 200,
    });
    return redlock;
  }
  return null;
}

export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client || !isConnected) return null;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCache(key: string, data: any, ttlSeconds: number = 86400): Promise<void> {
  try {
    const client = getRedis();
    if (!client || !isConnected) return;
    await client.setex(key, ttlSeconds, JSON.stringify(data));
  } catch {
  }
}

export async function delCache(key: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client || !isConnected) return;
    await client.del(key);
  } catch {
  }
}

export async function delPattern(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client || !isConnected) return;

    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
  }
}

export async function sIsMember(key: string, member: string): Promise<boolean> {
  try {
    const client = getRedis();
    if (!client || !isConnected) return false;
    const result = await client.sismember(key, member);
    return result === 1;
  } catch {
    return false;
  }
}

export async function sAdd(key: string, member: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client || !isConnected) return;
    await client.sadd(key, member);
  } catch {
  }
}

export async function sRem(key: string, member: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client || !isConnected) return;
    await client.srem(key, member);
  } catch {
  }
}
