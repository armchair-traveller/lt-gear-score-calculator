import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { testUtils } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createApp, toWebHandler } from 'h3'
import { createGearPlanGetHandler } from '../server/api/gear-plan.get.js'
import { createGearPlanPutHandler } from '../server/api/gear-plan.put.js'
import { createDatabase } from '../server/db/client.js'
import * as schema from '../server/db/schema.js'
import { createAuth } from '../server/utils/auth-config.js'
import { gearPlanBodyLimitBytes } from '../server/utils/gear-plan-api.js'

const migrationsFolder = fileURLToPath(
  new URL('../server/db/migrations', import.meta.url),
)

function createValidPlan(value = 1) {
  return {
    version: 1,
    slots: {
      '[sLv5] Accessories::Cloak': {
        gearType: '[sLv5] Accessories',
        pieceType: 'Cloak',
        statType: [
          'Critical Damage',
          'Basic Stats %',
          'Attack/Intensity',
          'Strength/Magic',
          'Basic Stats',
        ],
        statInput: [value, 1, 1, 0, 0],
      },
    },
  }
}

async function createTestContext() {
  const { client, db } = createDatabase({ url: ':memory:' })
  await migrate(db, { migrationsFolder })

  const auth = createAuth({
    db,
    schema,
    baseURL: 'http://localhost:3000',
    secret: 'gear-plan-test-secret-at-least-thirty-two-characters',
    discordClientId: '123456789012345678',
    discordClientSecret: 'discord-client-secret-for-tests',
    plugins: [testUtils()],
  })

  const getApp = createApp()
  getApp.use(createGearPlanGetHandler({
    getAuthInstance: () => auth,
    getDatabaseInstance: () => db,
  }))
  const putApp = createApp()
  putApp.use(createGearPlanPutHandler({
    getAuthInstance: () => auth,
    getDatabaseInstance: () => db,
  }))

  return {
    auth,
    client,
    db,
    getFetch: toWebHandler(getApp),
    putFetch: toWebHandler(putApp),
  }
}

async function createLogin(auth, id) {
  const context = await auth.$context
  const user = context.test.createUser({
    id,
    name: id,
    email: `${id}@example.com`,
  })
  await context.test.saveUser(user)
  return context.test.login({ userId: user.id })
}

function request(fetch, init = {}) {
  return fetch(new Request('http://localhost:3000/api/gear-plan', init))
}

function authenticatedHeaders(login, values = {}) {
  const headers = new Headers(login.headers)
  for (const [name, value] of Object.entries(values)) {
    headers.set(name, value)
  }
  return headers
}

function putRequest(fetch, login, body, headers = {}) {
  return request(fetch, {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      ...headers,
    }),
    body: JSON.stringify(body),
  })
}

test('gear plan API requires a Better Auth session and isolates ownership', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())

  const anonymousResponse = await request(context.getFetch)
  assert.equal(anonymousResponse.status, 401)
  assert.equal(anonymousResponse.headers.get('cache-control'), 'private, no-store')

  const ownerLogin = await createLogin(context.auth, 'plan-owner')
  const otherLogin = await createLogin(context.auth, 'plan-other')

  const invalidSessionResponse = await request(context.getFetch, {
    headers: {
      cookie: 'better-auth.session_token=invalid-session-token',
    },
  })
  assert.equal(invalidSessionResponse.status, 401)

  const emptyResponse = await request(context.getFetch, {
    headers: ownerLogin.headers,
  })
  assert.equal(emptyResponse.status, 200)
  assert.equal(emptyResponse.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await emptyResponse.json(), {
    plan: null,
    revision: 0,
    updatedAt: null,
  })

  const plan = createValidPlan()
  const writeResponse = await putRequest(context.putFetch, ownerLogin, {
    plan,
    expectedRevision: 0,
    userId: 'plan-other',
  })
  assert.equal(writeResponse.status, 200)
  assert.equal(writeResponse.headers.get('cache-control'), 'private, no-store')
  const written = await writeResponse.json()
  assert.deepEqual(written.plan, plan)
  assert.equal(written.revision, 1)
  assert.ok(Number.isFinite(Date.parse(written.updatedAt)))

  const ownerResponse = await request(context.getFetch, {
    headers: ownerLogin.headers,
  })
  assert.deepEqual(await ownerResponse.json(), written)

  await context.db
    .update(schema.session)
    .set({ expiresAt: new Date(Date.now() + (5 * 24 * 60 * 60 * 1_000)) })
    .where(eq(schema.session.id, ownerLogin.session.id))
  const refreshingResponse = await request(context.getFetch, {
    headers: ownerLogin.headers,
  })
  assert.equal(refreshingResponse.status, 200)
  assert.ok(refreshingResponse.headers.getSetCookie().length > 0)

  const otherResponse = await request(context.getFetch, {
    headers: otherLogin.headers,
  })
  assert.deepEqual(await otherResponse.json(), {
    plan: null,
    revision: 0,
    updatedAt: null,
  })

  await context.db
    .update(schema.session)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(schema.session.id, otherLogin.session.id))
  const expiredSessionResponse = await request(context.getFetch, {
    headers: otherLogin.headers,
  })
  assert.equal(expiredSessionResponse.status, 401)
  assert.ok(expiredSessionResponse.headers.getSetCookie().length > 0)
})

test('gear plan PUT enforces same-origin JSON, size, and strict validation', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, 'validated-owner')

  const wrongOrigin = await request(context.putFetch, {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-type': 'application/json',
      origin: 'https://attacker.example',
    }),
    body: JSON.stringify({ plan: createValidPlan(), expectedRevision: 0 }),
  })
  assert.equal(wrongOrigin.status, 403)

  const wrongContentType = await request(context.putFetch, {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-type': 'text/plain',
      origin: 'http://localhost:3000',
    }),
    body: JSON.stringify({ plan: createValidPlan(), expectedRevision: 0 }),
  })
  assert.equal(wrongContentType.status, 415)

  const invalidJsonResponse = await request(context.putFetch, {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    }),
    body: '{',
  })
  assert.equal(invalidJsonResponse.status, 400)

  const invalidPlan = createValidPlan()
  invalidPlan.slots['[sLv5] Accessories::Cloak'].statInput[0] = '1'
  const invalidResponse = await putRequest(context.putFetch, login, {
    plan: invalidPlan,
    expectedRevision: 0,
  })
  assert.equal(invalidResponse.status, 422)
  assert.equal(invalidResponse.headers.get('cache-control'), 'private, no-store')
  assert.equal((await invalidResponse.json()).data.code, 'GEAR_PLAN_INVALID')

  const oversizedBody = JSON.stringify({
    plan: createValidPlan(),
    expectedRevision: 0,
    padding: 'x'.repeat(gearPlanBodyLimitBytes),
  })
  assert.ok(Buffer.byteLength(oversizedBody) > gearPlanBodyLimitBytes)
  const oversizedResponse = await request(context.putFetch, {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    }),
    body: oversizedBody,
  })
  assert.equal(oversizedResponse.status, 413)

  const availableChunkCount = 100
  let chunkCount = 0
  let streamCancelled = false
  const chunkedBody = new ReadableStream({
    pull(controller) {
      chunkCount += 1
      if (chunkCount > availableChunkCount) {
        controller.close()
        return
      }
      controller.enqueue(new Uint8Array(8 * 1024).fill(120))
    },
    cancel() {
      streamCancelled = true
    },
  })
  const chunkedRequest = new Request(
    'http://localhost:3000/api/gear-plan',
    {
      method: 'PUT',
      headers: authenticatedHeaders(login, {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      }),
      body: chunkedBody,
      duplex: 'half',
    },
  )
  assert.equal(chunkedRequest.headers.has('content-length'), false)
  const chunkedResponse = await context.putFetch(chunkedRequest)
  assert.equal(chunkedResponse.status, 413)
  assert.equal(chunkedResponse.headers.get('cache-control'), 'private, no-store')
  assert.equal(streamCancelled, true)
  assert.ok(chunkCount < availableChunkCount)

  const declaredOversizedResponse = await request(context.putFetch, {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-length': String(gearPlanBodyLimitBytes + 1),
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    }),
    body: JSON.stringify({ plan: createValidPlan(), expectedRevision: 0 }),
  })
  assert.equal(declaredOversizedResponse.status, 413)

  const exactBodyBase = JSON.stringify({
    plan: createValidPlan(),
    expectedRevision: 0,
    padding: '',
  })
  const exactBody = JSON.stringify({
    plan: createValidPlan(),
    expectedRevision: 0,
    padding: 'x'.repeat(
      gearPlanBodyLimitBytes - Buffer.byteLength(exactBodyBase),
    ),
  })
  assert.equal(Buffer.byteLength(exactBody), gearPlanBodyLimitBytes)
  const exactLimitResponse = await request(context.putFetch, {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    }),
    body: exactBody,
  })
  assert.equal(exactLimitResponse.status, 200)
})

test('gear plan database failures return a private no-store 503', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, 'failed-database-owner')

  const app = createApp()
  app.use(createGearPlanGetHandler({
    getAuthInstance: () => context.auth,
    getDatabaseInstance: () => ({
      select() {
        throw new Error('simulated database failure')
      },
    }),
  }))

  const response = await request(toWebHandler(app), {
    headers: login.headers,
  })
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual((await response.json()).data, {
    code: 'GEAR_PLAN_UNAVAILABLE',
  })
})

test('gear plan PUT uses atomic revisions, returns conflicts, and persists reset', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, 'revision-owner')

  const initialResponse = await putRequest(context.putFetch, login, {
    plan: createValidPlan(1),
    expectedRevision: 0,
  })
  assert.equal(initialResponse.status, 200)
  assert.equal((await initialResponse.json()).revision, 1)

  const [firstUpdate, secondUpdate] = await Promise.all([
    putRequest(context.putFetch, login, {
      plan: createValidPlan(2),
      expectedRevision: 1,
    }),
    putRequest(context.putFetch, login, {
      plan: createValidPlan(3),
      expectedRevision: 1,
    }),
  ])
  assert.deepEqual(
    [firstUpdate.status, secondUpdate.status].toSorted(),
    [200, 409],
  )

  const conflictResponse = firstUpdate.status === 409 ? firstUpdate : secondUpdate
  assert.equal(conflictResponse.headers.get('cache-control'), 'private, no-store')
  const conflictBody = await conflictResponse.json()
  assert.equal(conflictBody.data.code, 'GEAR_PLAN_CONFLICT')
  assert.equal(conflictBody.data.cloud.revision, 2)
  assert.ok(conflictBody.data.cloud.plan)

  const resetResponse = await putRequest(context.putFetch, login, {
    plan: { version: 1, slots: {} },
    expectedRevision: 2,
  })
  assert.equal(resetResponse.status, 200)
  const reset = await resetResponse.json()
  assert.deepEqual(reset.plan, { version: 1, slots: {} })
  assert.equal(reset.revision, 3)

  const readResponse = await request(context.getFetch, {
    headers: login.headers,
  })
  assert.deepEqual(await readResponse.json(), reset)
})
