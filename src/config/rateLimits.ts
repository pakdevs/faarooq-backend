// Central rate limit configuration (authoritative source)
// Each entry: action key consumed by rateUser middleware & docs/status dashboard.
export interface RateLimitPolicy {
  action: string
  limit: number
  windowMs: number
  description: string
}

export const rateLimitPolicies: RateLimitPolicy[] = [
  { action: 'post:create', limit: 30, windowMs: 60_000, description: 'Post creations per minute' },
  { action: 'post:reply', limit: 60, windowMs: 60_000, description: 'Replies per minute' },
  {
    action: 'user:follow',
    limit: 100,
    windowMs: 60_000,
    description: 'Follow operations per minute',
  },
  { action: 'interaction:like', limit: 240, windowMs: 60_000, description: 'Likes per minute' },
  { action: 'interaction:repost', limit: 120, windowMs: 60_000, description: 'Reposts per minute' },
]

export function getRateLimitPolicy(action: string) {
  return rateLimitPolicies.find((p) => p.action === action)
}
