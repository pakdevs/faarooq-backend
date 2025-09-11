// Minimal import to avoid TS type resolution issues if @types not present
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RedisLib = require('ioredis')
type Redis = InstanceType<typeof RedisLib>

let client: Redis | null = null

export function getRedis(): Redis | null {
  if (process.env.REDIS_URL) {
    if (!client) {
      client = new RedisLib(process.env.REDIS_URL, { maxRetriesPerRequest: 3 })
      client.on('error', (err: unknown) => {
        console.error('redis_error', err)
      })
    }
    return client
  }
  return null
}
