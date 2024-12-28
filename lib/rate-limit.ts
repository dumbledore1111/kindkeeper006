import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
})

export async function rateLimit(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'anonymous'
  const limit = 100 // requests
  const duration = 3600 // 1 hour in seconds

  const key = `rate-limit:${ip}`
  const count = await redis.incr(key)

  if (count === 1) {
    await redis.expire(key, duration)
  }

  if (count > limit) {
    throw new Error('Rate limit exceeded')
  }
} 