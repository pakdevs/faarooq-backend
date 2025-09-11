import { getRedis } from './redis'

export interface MediaJob {
  type: 'thumbnail' | 'probe'
  mediaId: string
  url: string
  createdAt: string
}

const QUEUE_KEY = 'queue:media'

export async function enqueueMediaJob(job: Omit<MediaJob, 'createdAt'>) {
  const redis = getRedis()
  if (!redis) return false
  const payload: MediaJob = { ...job, createdAt: new Date().toISOString() }
  try {
    await redis.rpush(QUEUE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export async function dequeueMediaJobs(max = 10): Promise<MediaJob[]> {
  const redis = getRedis()
  if (!redis) return []
  const jobs: MediaJob[] = []
  for (let i = 0; i < max; i++) {
    const raw = await redis.lpop(QUEUE_KEY)
    if (!raw) break
    try {
      jobs.push(JSON.parse(raw))
    } catch {}
  }
  return jobs
}

export async function queueDepth() {
  const redis = getRedis()
  if (!redis) return 0
  try {
    return await redis.llen(QUEUE_KEY)
  } catch {
    return 0
  }
}
