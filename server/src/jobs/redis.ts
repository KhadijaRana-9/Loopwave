import { Redis } from 'ioredis'
import { env } from '@/config/env.js'

let sharedClient: Redis | null = null

// The persistent connection handed to BullMQ's Queue/Worker — normal
// reconnection behavior is correct here, since in production Redis is
// expected to actually be there and a transient blip should be retried.
// maxRetriesPerRequest: null is required for BullMQ's blocking commands.
export function redisConnection(): Redis {
  if (!sharedClient) {
    sharedClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
    // BullMQ surfaces connection problems through its own 'failed'/job
    // events; without this listener Node logs "Unhandled error event" for
    // every dropped connection, which is noise, not a real error report.
    sharedClient.on('error', () => {})
  }
  return sharedClient
}

let availability: Promise<boolean> | null = null

// A one-shot, non-retrying probe on its own throwaway connection — kept
// separate from redisConnection() above so that in an environment without
// Redis (like local dev without Docker), this doesn't leave a connection
// endlessly retrying and spamming error events in the background, and
// doesn't interfere with the shared connection's own retry policy once
// Redis really is reachable. Cached for the life of the process.
export function isRedisAvailable(): Promise<boolean> {
  if (!availability) {
    availability = new Promise((resolve) => {
      const probe = new Redis(env.REDIS_URL, { lazyConnect: true, retryStrategy: () => null, reconnectOnError: () => false })
      probe.on('error', () => {})
      probe
        .connect()
        .then(() => {
          resolve(true)
          probe.disconnect()
        })
        .catch(() => {
          resolve(false)
          probe.disconnect()
        })
    })
  }
  return availability
}
