import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { testUtils } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createApp, toWebHandler } from 'h3'
import { createPublicBuildGetHandler } from '../server/api/build/[slug].get.js'
import { createGearPlanSharePostHandler } from '../server/api/gear-plan/share.post.js'
import { createGearPlanPutHandler } from '../server/api/gear-plan.put.js'
import { createDatabase } from '../server/db/client.js'
import * as schema from '../server/db/schema.js'
import { createAuth } from '../server/utils/auth-config.js'
import {
  createPublicBuildSlugCandidate,
  isValidPublicBuildSlug,
  normalizePublicBuildSlugBase,
  publicBuildOutcome,
  publicBuildShareBodyLimitBytes,
  publicBuildSlugMaxLength,
} from '../server/utils/public-build-api.js'

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
    secret: 'public-build-test-secret-at-least-thirty-two-characters',
    discordClientId: '123456789012345678',
    discordClientSecret: 'discord-client-secret-for-tests',
    plugins: [testUtils()],
  })
  const outcomes = []

  const shareApp = createApp()
  shareApp.use(createGearPlanSharePostHandler({
    getAuthInstance: () => auth,
    getDatabaseInstance: () => db,
    writeOutcome: outcome => outcomes.push(outcome),
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
    outcomes,
    putFetch: toWebHandler(putApp),
    shareFetch: toWebHandler(shareApp),
  }
}

async function createLogin(auth, {
  id,
  name = id,
  image = 'https://cdn.discordapp.com/avatars/example/avatar.png',
} = {}) {
  const context = await auth.$context
  const user = context.test.createUser({
    id,
    name,
    image,
    email: `${id}@example.com`,
  })
  await context.test.saveUser(user)
  return context.test.login({ userId: user.id })
}

function authenticatedHeaders(login, values = {}) {
  const headers = new Headers(login.headers)
  for (const [name, value] of Object.entries(values)) {
    headers.set(name, value)
  }
  return headers
}

function shareRequest(fetch, login, {
  body = '{}',
  headers = {},
} = {}) {
  return fetch(new Request('http://localhost:3000/api/gear-plan/share', {
    method: 'POST',
    headers: authenticatedHeaders(login, {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      ...headers,
    }),
    body,
  }))
}

function putRequest(fetch, login, plan, expectedRevision = 0) {
  return fetch(new Request('http://localhost:3000/api/gear-plan', {
    method: 'PUT',
    headers: authenticatedHeaders(login, {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    }),
    body: JSON.stringify({ plan, expectedRevision }),
  }))
}

function publicBuildRequest({ db, slug, writeOutcome = () => {} }) {
  const app = createApp()
  app.use(createPublicBuildGetHandler({
    getDatabaseInstance: () => db,
    getSlug: () => slug,
    writeOutcome,
  }))
  return toWebHandler(app)(
    new Request(`http://localhost:3000/api/build/${encodeURIComponent(slug)}`),
  )
}

test('public build slug normalization is human-readable, bounded, and strict', () => {
  assert.equal(normalizePublicBuildSlugBase("  Fáng’s Cool_Name!!  "), 'fangs-cool-name')
  assert.equal(normalizePublicBuildSlugBase('✨🌙'), 'player')
  assert.equal(normalizePublicBuildSlugBase(null), 'player')

  const longBase = normalizePublicBuildSlugBase('A'.repeat(100))
  assert.equal(longBase.length, publicBuildSlugMaxLength)
  const suffixed = createPublicBuildSlugCandidate(longBase, 500)
  assert.equal(suffixed.length, publicBuildSlugMaxLength)
  assert.match(suffixed, /-500$/)

  assert.equal(isValidPublicBuildSlug('fangs-build-2'), true)
  for (const invalid of ['', 'Fangs-Build', '-fang', 'fang-', 'fang--build', 'fang/build', 'a'.repeat(65)]) {
    assert.equal(isValidPublicBuildSlug(invalid), false, invalid)
  }
})

test('share API requires auth, exact origin, JSON, and an empty object', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, {
    id: 'share-validation-owner',
    name: 'Share Validation',
  })

  const anonymousResponse = await shareRequest(context.shareFetch, { headers: {} })
  assert.equal(anonymousResponse.status, 401)
  assert.equal(anonymousResponse.headers.get('cache-control'), 'private, no-store')

  const wrongOrigin = await shareRequest(context.shareFetch, login, {
    headers: { origin: 'https://attacker.example' },
  })
  assert.equal(wrongOrigin.status, 403)

  const wrongContentType = await shareRequest(context.shareFetch, login, {
    headers: { 'content-type': 'text/plain' },
  })
  assert.equal(wrongContentType.status, 415)

  const missingBody = await context.shareFetch(new Request(
    'http://localhost:3000/api/gear-plan/share',
    {
      method: 'POST',
      headers: authenticatedHeaders(login, {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      }),
    },
  ))
  assert.equal(missingBody.status, 400)

  const invalidJson = await shareRequest(context.shareFetch, login, { body: '{' })
  assert.equal(invalidJson.status, 400)

  const extraFields = await shareRequest(context.shareFetch, login, {
    body: JSON.stringify({ userId: 'someone-else' }),
  })
  assert.equal(extraFields.status, 400)

  const oversized = await shareRequest(context.shareFetch, login, {
    body: JSON.stringify({ padding: 'x'.repeat(publicBuildShareBodyLimitBytes) }),
  })
  assert.equal(oversized.status, 413)
  assert.equal(oversized.headers.get('cache-control'), 'private, no-store')

  assert.ok(context.outcomes.every(
    outcome => Object.values(publicBuildOutcome).includes(outcome),
  ))
  assert.ok(context.outcomes.includes(publicBuildOutcome.shareAuthRequired))
  assert.ok(context.outcomes.includes(publicBuildOutcome.shareOriginRejected))
  assert.ok(context.outcomes.includes(publicBuildOutcome.shareRejected))
  assert.equal(context.outcomes.join(' ').includes('share-validation-owner'), false)
})

test('share API rejects absent or empty plans and hides corrupt storage', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, {
    id: 'empty-public-owner',
    name: 'Empty Public Owner',
  })

  const absentResponse = await shareRequest(context.shareFetch, login)
  assert.equal(absentResponse.status, 409)
  assert.equal((await absentResponse.json()).data.code, 'PUBLIC_BUILD_EMPTY')

  const emptyWrite = await putRequest(
    context.putFetch,
    login,
    { version: 1, slots: {} },
  )
  assert.equal(emptyWrite.status, 200)
  const emptyResponse = await shareRequest(context.shareFetch, login)
  assert.equal(emptyResponse.status, 409)
  assert.equal((await emptyResponse.json()).data.code, 'PUBLIC_BUILD_EMPTY')

  await context.db
    .update(schema.gearPlan)
    .set({ plan: { version: 999, slots: {} } })
    .where(eq(schema.gearPlan.userId, 'empty-public-owner'))
  const invalidResponse = await shareRequest(context.shareFetch, login)
  assert.equal(invalidResponse.status, 503)
  assert.equal((await invalidResponse.json()).data.code, 'PUBLIC_BUILD_UNAVAILABLE')
  assert.equal(invalidResponse.headers.get('cache-control'), 'private, no-store')
})

test('share API allocates stable collision suffixes and is idempotent', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const firstLogin = await createLogin(context.auth, {
    id: 'collision-owner-a',
    name: 'Same Display Name',
  })
  const secondLogin = await createLogin(context.auth, {
    id: 'collision-owner-b',
    name: 'Same Display Name',
  })

  assert.equal(
    (await putRequest(context.putFetch, firstLogin, createValidPlan(1))).status,
    200,
  )
  assert.equal(
    (await putRequest(context.putFetch, secondLogin, createValidPlan(2))).status,
    200,
  )

  const [firstConcurrentShare, secondConcurrentShare] = await Promise.all([
    shareRequest(context.shareFetch, firstLogin),
    shareRequest(context.shareFetch, firstLogin),
  ])
  assert.equal(firstConcurrentShare.status, 200)
  assert.equal(secondConcurrentShare.status, 200)
  const firstPublication = await firstConcurrentShare.json()
  assert.deepEqual(await secondConcurrentShare.json(), firstPublication)
  assert.deepEqual(firstPublication, {
    slug: 'same-display-name',
    path: '/build/same-display-name',
  })

  const secondPublicationResponse = await shareRequest(context.shareFetch, secondLogin)
  assert.equal(secondPublicationResponse.status, 200)
  assert.deepEqual(await secondPublicationResponse.json(), {
    slug: 'same-display-name-2',
    path: '/build/same-display-name-2',
  })

  await context.db
    .update(schema.user)
    .set({ name: 'A Completely Different Name' })
    .where(eq(schema.user.id, 'collision-owner-a'))
  const afterRename = await shareRequest(context.shareFetch, firstLogin)
  assert.equal(afterRename.status, 200)
  assert.deepEqual(await afterRename.json(), firstPublication)

  const shares = await context.db.select().from(schema.gearPlanShare)
  assert.equal(shares.length, 2)
  assert.deepEqual(
    shares.map(share => share.slug).toSorted(),
    ['same-display-name', 'same-display-name-2'],
  )
})

test('anonymous public read returns the live plan and only public owner fields', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, {
    id: 'public-response-owner',
    name: 'Visible Builder',
    image: 'https://cdn.discordapp.com/avatars/visible/avatar.png',
  })
  const initialPlan = createValidPlan(1)
  assert.equal((await putRequest(context.putFetch, login, initialPlan)).status, 200)
  const shareResponse = await shareRequest(context.shareFetch, login)
  const { slug } = await shareResponse.json()

  const readOutcomes = []
  const publicResponse = await publicBuildRequest({
    db: context.db,
    slug,
    writeOutcome: outcome => readOutcomes.push(outcome),
  })
  assert.equal(publicResponse.status, 200)
  assert.equal(publicResponse.headers.get('cache-control'), 'private, no-store')
  const publicBody = await publicResponse.json()
  assert.deepEqual(Object.keys(publicBody).toSorted(), ['owner', 'plan', 'updatedAt'])
  assert.deepEqual(Object.keys(publicBody.owner).toSorted(), ['displayName', 'image'])
  assert.deepEqual(publicBody.owner, {
    displayName: 'Visible Builder',
    image: 'https://cdn.discordapp.com/avatars/visible/avatar.png',
  })
  assert.deepEqual(publicBody.plan, initialPlan)
  assert.ok(Number.isFinite(Date.parse(publicBody.updatedAt)))
  assert.equal('revision' in publicBody, false)
  assert.equal('userId' in publicBody, false)
  assert.equal('email' in publicBody.owner, false)
  assert.deepEqual(readOutcomes, [publicBuildOutcome.readFound])

  const changedPlan = createValidPlan(3)
  const updatedAt = new Date(Date.now() + 60_000)
  await context.db
    .update(schema.gearPlan)
    .set({
      plan: changedPlan,
      revision: 2,
      updatedAt,
    })
    .where(eq(schema.gearPlan.userId, 'public-response-owner'))
  const liveResponse = await publicBuildRequest({ db: context.db, slug })
  assert.equal(liveResponse.status, 200)
  const liveBody = await liveResponse.json()
  assert.deepEqual(liveBody.plan, changedPlan)
  assert.equal(liveBody.updatedAt, updatedAt.toISOString())
})

test('public builds never emit an owner-controlled avatar URL', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, {
    id: 'untrusted-avatar-owner',
    name: 'Untrusted Avatar Owner',
    image: 'https://tracker.example/pixel.png?viewer=public-build',
  })
  assert.equal(
    (await putRequest(context.putFetch, login, createValidPlan())).status,
    200,
  )
  const { slug } = await (await shareRequest(context.shareFetch, login)).json()

  const response = await publicBuildRequest({ db: context.db, slug })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.owner, {
    displayName: 'Untrusted Avatar Owner',
    image: null,
  })
  assert.equal(JSON.stringify(body).includes('tracker.example'), false)
})

test('public read hides lookup details and normalizes corrupt or failed storage', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())

  for (const slug of ['Unknown-Build', '../private', 'missing-build']) {
    const response = await publicBuildRequest({ db: context.db, slug })
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal((await response.json()).data.code, 'PUBLIC_BUILD_NOT_FOUND')
  }

  const login = await createLogin(context.auth, {
    id: 'corrupt-public-owner',
    name: 'Corrupt Public Owner',
  })
  assert.equal(
    (await putRequest(context.putFetch, login, createValidPlan())).status,
    200,
  )
  const { slug } = await (await shareRequest(context.shareFetch, login)).json()
  await context.db
    .update(schema.gearPlan)
    .set({ plan: { version: 999, slots: {} } })
    .where(eq(schema.gearPlan.userId, 'corrupt-public-owner'))

  const corruptResponse = await publicBuildRequest({ db: context.db, slug })
  assert.equal(corruptResponse.status, 503)
  assert.equal(corruptResponse.headers.get('cache-control'), 'private, no-store')
  assert.equal((await corruptResponse.json()).data.code, 'PUBLIC_BUILD_UNAVAILABLE')

  const failedResponse = await publicBuildRequest({
    db: {
      select() {
        throw new Error('private database failure details')
      },
    },
    slug: 'valid-public-slug',
  })
  assert.equal(failedResponse.status, 503)
  const failedBody = await failedResponse.json()
  assert.deepEqual(failedBody.data, { code: 'PUBLIC_BUILD_UNAVAILABLE' })
  assert.equal(JSON.stringify(failedBody).includes('private database failure'), false)
})

test('share database failures return a private no-store unavailable response', async (t) => {
  const context = await createTestContext()
  t.after(() => context.client.close())
  const login = await createLogin(context.auth, {
    id: 'failed-share-owner',
    name: 'Failed Share Owner',
  })

  const outcomes = []
  const app = createApp()
  app.use(createGearPlanSharePostHandler({
    getAuthInstance: () => context.auth,
    getDatabaseInstance: () => ({
      select() {
        throw new Error('private database failure details')
      },
    }),
    writeOutcome: outcome => outcomes.push(outcome),
  }))
  const response = await shareRequest(toWebHandler(app), login)
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json()
  assert.deepEqual(body.data, { code: 'PUBLIC_BUILD_UNAVAILABLE' })
  assert.equal(JSON.stringify(body).includes('private database failure'), false)
  assert.deepEqual(outcomes, [publicBuildOutcome.shareUnavailable])
})
