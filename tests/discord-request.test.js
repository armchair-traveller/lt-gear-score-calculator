import assert from 'node:assert/strict'
import {
  generateKeyPairSync,
  sign,
} from 'node:crypto'
import test from 'node:test'
import { scheduleDiscordBackgroundTask } from '../server/api/discord/interactions.post.js'
import { registerDiscordBackgroundTask } from '../server/utils/discord-background.js'
import {
  createDiscordInteractionReplayGuard,
  getDiscordSafetyIdentifier,
  verifyDiscordRequest,
} from '../server/utils/discord-request.js'

test('verifies the exact timestamp-prefixed Discord request body', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const rawPublicKey = publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-32)
    .toString('hex')
  const now = 1_777_777_777_000
  const timestamp = String(now / 1000)
  const body = Buffer.from('{"type":1,"application_id":"123"}')
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(timestamp), body]),
    privateKey,
  ).toString('hex')

  assert.equal(await verifyDiscordRequest({
    body,
    signature,
    timestamp,
    publicKey: rawPublicKey,
    now,
  }), true)
  assert.equal(await verifyDiscordRequest({
    body: Buffer.from('{"type":2}'),
    signature,
    timestamp,
    publicKey: rawPublicKey,
    now,
  }), false)
})

test('rejects valid signatures with stale or malformed Discord timestamps', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const rawPublicKey = publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-32)
    .toString('hex')
  const timestamp = '1777777777'
  const body = Buffer.from('{"type":1,"application_id":"123"}')
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(timestamp), body]),
    privateKey,
  ).toString('hex')

  assert.equal(await verifyDiscordRequest({
    body,
    signature,
    timestamp,
    publicKey: rawPublicKey,
    now: Number(timestamp) * 1000 + 5 * 60_000 + 1,
  }), false)
  assert.equal(await verifyDiscordRequest({
    body,
    signature,
    timestamp: 'not-a-timestamp',
    publicKey: rawPublicKey,
    now: Number(timestamp) * 1000,
  }), false)
})

test('deduplicates interaction IDs for a bounded warm-instance window', () => {
  const guard = createDiscordInteractionReplayGuard({
    ttlMs: 1_000,
    maxEntries: 2,
  })

  assert.equal(guard.claim('interaction-1', 10_000), true)
  assert.equal(guard.claim('interaction-1', 10_001), false)
  assert.equal(guard.claim('interaction-2', 10_001), true)
  const response = { type: 5, data: {} }
  assert.equal(guard.setResponse('interaction-2', response), true)
  assert.equal(guard.getResponse('interaction-2', 10_001), response)
  assert.equal(guard.claim('interaction-3', 10_002), true)
  assert.equal(guard.size, 2)
  assert.equal(guard.claim('interaction-2', 11_002), true)
  assert.equal(guard.release('interaction-2'), true)
  assert.equal(guard.getResponse('interaction-2', 11_002), null)
  assert.equal(guard.claim('', 11_002), false)
})

test('hashes Discord user IDs into stable non-reversible safety identifiers', () => {
  const first = getDiscordSafetyIdentifier('user-123', 'application')
  const second = getDiscordSafetyIdentifier('user-123', 'application')

  assert.equal(first, second)
  assert.equal(first.length, 64)
  assert.equal(first.includes('user-123'), false)
  assert.notEqual(first, getDiscordSafetyIdentifier('user-123', 'another-application'))
})

test('registers one background promise with both H3 and Vercel lifecycles', () => {
  const calls = []
  const task = Promise.resolve()
  registerDiscordBackgroundTask(
    {
      waitUntil(promise) {
        calls.push(['h3', promise])
      },
    },
    task,
    {
      isVercel: true,
      vercelWaitUntilImpl(promise) {
        calls.push(['vercel', promise])
      },
    },
  )

  assert.deepEqual(calls, [
    ['h3', task],
    ['vercel', task],
  ])
})

test('rejects a runtime with no background lifecycle support', () => {
  assert.throws(
    () => registerDiscordBackgroundTask({}, Promise.resolve(), { isVercel: false }),
    /does not support background request work/,
  )
})

test('does not start Discord work until the deferred response can be returned', async () => {
  let scheduledCallback
  let started = false
  const task = scheduleDiscordBackgroundTask(
    () => {
      started = true
    },
    (callback) => {
      scheduledCallback = callback
    },
  )

  assert.equal(started, false)
  scheduledCallback()
  await task
  assert.equal(started, true)
})
