const defaultCooldownMs = 30_000
const defaultMaxActiveJobs = 2

export function createDiscordJobLimiter({
  cooldownMs = defaultCooldownMs,
  maxActiveJobs = defaultMaxActiveJobs,
} = {}) {
  const activeUsers = new Set()
  const lastStartedAt = new Map()
  let activeJobs = 0

  function acquire(userKey, now = Date.now()) {
    const normalizedUserKey = String(userKey || '')
    pruneOldEntries(now)

    if (activeUsers.has(normalizedUserKey)) {
      return {
        ok: false,
        code: 'USER_ACTIVE',
        retryAfterSeconds: null,
      }
    }

    const elapsed = now - (lastStartedAt.get(normalizedUserKey) ?? Number.NEGATIVE_INFINITY)
    if (elapsed < cooldownMs) {
      return {
        ok: false,
        code: 'COOLDOWN',
        retryAfterSeconds: Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000)),
      }
    }

    if (activeJobs >= maxActiveJobs) {
      return {
        ok: false,
        code: 'BUSY',
        retryAfterSeconds: null,
      }
    }

    activeUsers.add(normalizedUserKey)
    lastStartedAt.set(normalizedUserKey, now)
    activeJobs += 1
    let released = false

    return {
      ok: true,
      release() {
        if (released) {
          return
        }

        released = true
        activeUsers.delete(normalizedUserKey)
        activeJobs = Math.max(0, activeJobs - 1)
      },
    }
  }

  function pruneOldEntries(now) {
    const retentionMs = Math.max(cooldownMs * 2, 60_000)
    for (const [userKey, startedAt] of lastStartedAt) {
      if (!activeUsers.has(userKey) && now - startedAt >= retentionMs) {
        lastStartedAt.delete(userKey)
      }
    }
  }

  function reset() {
    activeUsers.clear()
    lastStartedAt.clear()
    activeJobs = 0
  }

  return {
    acquire,
    reset,
    get activeJobs() {
      return activeJobs
    },
  }
}

export const discordJobLimiter = createDiscordJobLimiter()
