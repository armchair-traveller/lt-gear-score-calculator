import assert from 'node:assert/strict'
import {
  generateKeyPairSync,
  sign,
} from 'node:crypto'
import test from 'node:test'
import {
  createApp,
  toWebHandler,
} from 'h3'
import discordInteractionHandler from '../server/api/discord/interactions.post.js'
import { discordJobLimiter } from '../server/utils/discord-rate-limit.js'
import { discordInteractionReplayGuard } from '../server/utils/discord-request.js'

test('Discord interaction route verifies and answers a signed PING', async () => {
  const previousApplicationId = process.env.DISCORD_APPLICATION_ID
  const previousPublicKey = process.env.DISCORD_PUBLIC_KEY
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const applicationId = '123456789'
  const publicKeyHex = publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-32)
    .toString('hex')
  const timestamp = String(Math.floor(Date.now() / 1000))
  const body = JSON.stringify({
    type: 1,
    application_id: applicationId,
  })
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]),
    privateKey,
  ).toString('hex')

  process.env.DISCORD_APPLICATION_ID = applicationId
  process.env.DISCORD_PUBLIC_KEY = publicKeyHex

  try {
    const app = createApp()
    app.use(discordInteractionHandler)
    const handle = toWebHandler(app)
    const response = await handle(new Request(
      'http://localhost/api/discord/interactions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature-ed25519': signature,
          'x-signature-timestamp': timestamp,
        },
        body,
      },
    ))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { type: 1 })

    const rejected = await handle(new Request(
      'http://localhost/api/discord/interactions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature-ed25519': '00'.repeat(64),
          'x-signature-timestamp': timestamp,
        },
        body,
      },
    ))
    assert.equal(rejected.status, 401)

    const staleTimestamp = String(Number(timestamp) - 10 * 60)
    const staleSignature = sign(
      null,
      Buffer.concat([Buffer.from(staleTimestamp), Buffer.from(body)]),
      privateKey,
    ).toString('hex')
    const stale = await handle(new Request(
      'http://localhost/api/discord/interactions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature-ed25519': staleSignature,
          'x-signature-timestamp': staleTimestamp,
        },
        body,
      },
    ))
    assert.equal(stale.status, 401)
  }
  finally {
    restoreEnvironmentVariable('DISCORD_APPLICATION_ID', previousApplicationId)
    restoreEnvironmentVariable('DISCORD_PUBLIC_KEY', previousPublicKey)
  }
})

test('duplicate signed commands keep the original deferred response semantics', async () => {
  const previousApplicationId = process.env.DISCORD_APPLICATION_ID
  const previousPublicKey = process.env.DISCORD_PUBLIC_KEY
  const previousVercel = process.env.VERCEL
  const originalFetch = globalThis.fetch
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const applicationId = '987654321'
  const publicKeyHex = publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-32)
    .toString('hex')
  const timestamp = String(Math.floor(Date.now() / 1000))
  const body = JSON.stringify({
    id: `interaction-${Date.now()}`,
    type: 2,
    application_id: applicationId,
    token: 'interaction-token',
    member: {
      user: { id: 'user-1' },
    },
    data: {
      name: 'gear-score',
      options: [
        { type: 11, name: 'image', value: 'image-1' },
        { type: 5, name: 'private', value: false },
      ],
      resolved: {
        attachments: {
          'image-1': {
            id: 'image-1',
            url: 'https://cdn.discordapp.com/attachments/channel/message/gear.png',
            content_type: 'image/png',
            size: 4,
            width: 1,
            height: 1,
          },
        },
      },
    },
  })
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]),
    privateKey,
  ).toString('hex')
  const backgroundTasks = []
  const fetchCalls = []

  process.env.DISCORD_APPLICATION_ID = applicationId
  process.env.DISCORD_PUBLIC_KEY = publicKeyHex
  delete process.env.VERCEL
  discordInteractionReplayGuard.reset()
  discordJobLimiter.reset()
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ method: options.method || 'GET', url: String(url) })
    if ((options.method || 'GET') === 'GET') {
      return new Response(new Uint8Array([0, 0, 0, 0]), {
        headers: {
          'content-type': 'image/png',
          'content-length': '4',
        },
      })
    }
    return new Response('{}')
  }

  try {
    const app = createApp()
    app.use((event) => {
      event.waitUntil = promise => backgroundTasks.push(promise)
    })
    app.use(discordInteractionHandler)
    const handle = toWebHandler(app)
    const createRequest = () => new Request(
      'http://localhost/api/discord/interactions',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature-ed25519': signature,
          'x-signature-timestamp': timestamp,
        },
        body,
      },
    )

    const first = await handle(createRequest())
    const duplicate = await handle(createRequest())

    assert.equal(first.status, 200)
    assert.equal(duplicate.status, 200)
    assert.deepEqual(await first.json(), { type: 5, data: {} })
    assert.deepEqual(await duplicate.json(), { type: 5, data: {} })
    assert.equal(backgroundTasks.length, 1)

    await Promise.allSettled(backgroundTasks)
    assert.equal(fetchCalls.filter(call => call.method === 'GET').length, 1)
    assert.equal(fetchCalls.filter(call => call.method === 'PATCH').length, 1)
  }
  finally {
    globalThis.fetch = originalFetch
    discordInteractionReplayGuard.reset()
    discordJobLimiter.reset()
    restoreEnvironmentVariable('DISCORD_APPLICATION_ID', previousApplicationId)
    restoreEnvironmentVariable('DISCORD_PUBLIC_KEY', previousPublicKey)
    restoreEnvironmentVariable('VERCEL', previousVercel)
  }
})

test('duplicate limiter rejections replay the original immediate response', async () => {
  const previousApplicationId = process.env.DISCORD_APPLICATION_ID
  const previousPublicKey = process.env.DISCORD_PUBLIC_KEY
  const previousVercel = process.env.VERCEL
  const originalFetch = globalThis.fetch
  const fixture = createSignedGearScoreCommand({
    applicationId: '246813579',
    interactionId: `limited-interaction-${Date.now()}`,
  })
  const backgroundTasks = []

  process.env.DISCORD_APPLICATION_ID = fixture.applicationId
  process.env.DISCORD_PUBLIC_KEY = fixture.publicKeyHex
  delete process.env.VERCEL
  discordInteractionReplayGuard.reset()
  discordJobLimiter.reset()
  globalThis.fetch = async () => {
    throw new Error('A limited interaction must not start background work.')
  }

  try {
    assert.equal(discordJobLimiter.acquire('blocker-1').ok, true)
    assert.equal(discordJobLimiter.acquire('blocker-2').ok, true)

    const app = createApp()
    app.use((event) => {
      event.waitUntil = promise => backgroundTasks.push(promise)
    })
    app.use(discordInteractionHandler)
    const handle = toWebHandler(app)

    const first = await handle(fixture.createRequest())
    const duplicate = await handle(fixture.createRequest())
    const firstPayload = await first.json()
    const duplicatePayload = await duplicate.json()

    assert.equal(first.status, 200)
    assert.equal(duplicate.status, 200)
    assert.deepEqual(duplicatePayload, firstPayload)
    assert.equal(firstPayload.type, 4)
    assert.equal(firstPayload.data.flags, 64)
    assert.match(firstPayload.data.content, /handling other screenshots/i)
    assert.equal(backgroundTasks.length, 0)
  }
  finally {
    globalThis.fetch = originalFetch
    discordInteractionReplayGuard.reset()
    discordJobLimiter.reset()
    restoreEnvironmentVariable('DISCORD_APPLICATION_ID', previousApplicationId)
    restoreEnvironmentVariable('DISCORD_PUBLIC_KEY', previousPublicKey)
    restoreEnvironmentVariable('VERCEL', previousVercel)
  }
})

test('failed background registration cancels work and releases the replay claim', async () => {
  const previousApplicationId = process.env.DISCORD_APPLICATION_ID
  const previousPublicKey = process.env.DISCORD_PUBLIC_KEY
  const previousVercel = process.env.VERCEL
  const originalFetch = globalThis.fetch
  const fixture = createSignedGearScoreCommand({
    applicationId: '135792468',
    interactionId: `unregistered-interaction-${Date.now()}`,
  })
  let fetchCalls = 0

  process.env.DISCORD_APPLICATION_ID = fixture.applicationId
  process.env.DISCORD_PUBLIC_KEY = fixture.publicKeyHex
  delete process.env.VERCEL
  discordInteractionReplayGuard.reset()
  discordJobLimiter.reset()
  globalThis.fetch = async () => {
    fetchCalls += 1
    throw new Error('Cancelled background work must not make requests.')
  }

  try {
    const app = createApp()
    app.use(discordInteractionHandler)
    const response = await toWebHandler(app)(fixture.createRequest())

    assert.equal(response.status, 500)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(fetchCalls, 0)
    assert.equal(discordJobLimiter.activeJobs, 0)
    assert.equal(
      discordInteractionReplayGuard.claim(fixture.interactionId),
      true,
    )
  }
  finally {
    globalThis.fetch = originalFetch
    discordInteractionReplayGuard.reset()
    discordJobLimiter.reset()
    restoreEnvironmentVariable('DISCORD_APPLICATION_ID', previousApplicationId)
    restoreEnvironmentVariable('DISCORD_PUBLIC_KEY', previousPublicKey)
    restoreEnvironmentVariable('VERCEL', previousVercel)
  }
})

function createSignedGearScoreCommand({
  applicationId,
  interactionId,
  isPrivate = false,
}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const publicKeyHex = publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-32)
    .toString('hex')
  const timestamp = String(Math.floor(Date.now() / 1000))
  const body = JSON.stringify({
    id: interactionId,
    type: 2,
    application_id: applicationId,
    token: 'interaction-token',
    member: {
      user: { id: 'user-1' },
    },
    data: {
      name: 'gear-score',
      options: [
        { type: 11, name: 'image', value: 'image-1' },
        { type: 5, name: 'private', value: isPrivate },
      ],
      resolved: {
        attachments: {
          'image-1': {
            id: 'image-1',
            url: 'https://cdn.discordapp.com/attachments/channel/message/gear.png',
            content_type: 'image/png',
            size: 4,
            width: 1,
            height: 1,
          },
        },
      },
    },
  })
  const signature = sign(
    null,
    Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]),
    privateKey,
  ).toString('hex')

  return {
    applicationId,
    interactionId,
    publicKeyHex,
    createRequest() {
      return new Request(
        'http://localhost/api/discord/interactions',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-signature-ed25519': signature,
            'x-signature-timestamp': timestamp,
          },
          body,
        },
      )
    },
  }
}

function restoreEnvironmentVariable(name, value) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
