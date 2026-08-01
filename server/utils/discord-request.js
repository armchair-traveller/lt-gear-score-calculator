import { createHash } from 'node:crypto'
import { verifyKey } from 'discord-interactions'

const defaultTimestampToleranceMs = 5 * 60_000
const defaultReplayTtlMs = 15 * 60_000
const defaultReplayMaxEntries = 4_096

export async function verifyDiscordRequest({
  body,
  signature,
  timestamp,
  publicKey,
  now = Date.now(),
  timestampToleranceMs = defaultTimestampToleranceMs,
}) {
  if (!body || !signature || !timestamp || !publicKey) {
    return false
  }

  const timestampSeconds = Number(timestamp)
  if (
    !/^\d+$/.test(String(timestamp))
    || !Number.isSafeInteger(timestampSeconds)
    || Math.abs(now - timestampSeconds * 1000) > timestampToleranceMs
  ) {
    return false
  }

  try {
    return await verifyKey(body, signature, timestamp, publicKey)
  }
  catch {
    return false
  }
}

export function getDiscordSafetyIdentifier(userId, applicationId) {
  return createHash('sha256')
    .update(`${String(applicationId || '')}:${String(userId || '')}`)
    .digest('hex')
}

export function createDiscordInteractionReplayGuard({
  ttlMs = defaultReplayTtlMs,
  maxEntries = defaultReplayMaxEntries,
} = {}) {
  const normalizedTtlMs = Number.isFinite(ttlMs)
    ? Math.max(1, Math.floor(ttlMs))
    : defaultReplayTtlMs
  const normalizedMaxEntries = Number.isFinite(maxEntries)
    ? Math.max(1, Math.floor(maxEntries))
    : defaultReplayMaxEntries
  const seenInteractionIds = new Map()

  function claim(interactionId, now = Date.now()) {
    const normalizedId = String(interactionId || '')
    if (!normalizedId) {
      return false
    }

    prune(now)
    if (seenInteractionIds.has(normalizedId)) {
      return false
    }

    while (seenInteractionIds.size >= normalizedMaxEntries) {
      const oldestId = seenInteractionIds.keys().next().value
      seenInteractionIds.delete(oldestId)
    }
    seenInteractionIds.set(normalizedId, {
      response: null,
      seenAt: now,
    })
    return true
  }

  function getResponse(interactionId, now = Date.now()) {
    prune(now)
    return seenInteractionIds.get(String(interactionId || ''))?.response ?? null
  }

  function setResponse(interactionId, response) {
    const entry = seenInteractionIds.get(String(interactionId || ''))
    if (!entry) {
      return false
    }

    entry.response = response
    return true
  }

  function release(interactionId) {
    return seenInteractionIds.delete(String(interactionId || ''))
  }

  function prune(now) {
    for (const [interactionId, entry] of seenInteractionIds) {
      if (now - entry.seenAt < normalizedTtlMs) {
        break
      }
      seenInteractionIds.delete(interactionId)
    }
  }

  function reset() {
    seenInteractionIds.clear()
  }

  return {
    claim,
    getResponse,
    setResponse,
    release,
    reset,
    get size() {
      return seenInteractionIds.size
    },
  }
}

export const discordInteractionReplayGuard = createDiscordInteractionReplayGuard()
