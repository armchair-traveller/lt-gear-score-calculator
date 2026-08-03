import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { testUtils } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createApp, toWebHandler } from 'h3'
import { createAuthEventHandler } from '../server/api/auth/[...all].js'
import { createDatabase } from '../server/db/client.js'
import * as schema from '../server/db/schema.js'
import {
  AUTH_SESSION_EXPIRES_IN,
  createAuth,
} from '../server/utils/auth-config.js'

const migrationsFolder = fileURLToPath(
  new URL('../server/db/migrations', import.meta.url),
)

async function createTestAuth({
  baseURL = 'http://localhost:3000',
  backgroundTaskHandler,
} = {}) {
  const { client, db } = createDatabase({ url: ':memory:' })
  await migrate(db, { migrationsFolder })

  const auth = createAuth({
    db,
    schema,
    baseURL,
    secret: 'integration-test-secret-at-least-thirty-two-characters',
    discordClientId: '123456789012345678',
    discordClientSecret: 'discord-client-secret-for-tests',
    backgroundTaskHandler,
    plugins: [testUtils()],
  })

  const app = createApp()
  app.use(createAuthEventHandler(() => auth))

  return {
    auth,
    client,
    db,
    fetch: toWebHandler(app),
  }
}

function request(fetch, path, init = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('x-forwarded-for')) {
    headers.set('x-forwarded-for', '203.0.113.10')
  }

  return fetch(new Request(`http://localhost:3000${path}`, {
    ...init,
    headers,
  }))
}

test('auth migration declares every table and enforces cascades in local libSQL', async (t) => {
  const { client, db } = await createTestAuth()
  t.after(() => client.close())

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  )
  const tableNames = tables.rows.map(row => row.name)

  for (const tableName of ['account', 'rate_limit', 'session', 'user', 'verification']) {
    assert.ok(tableNames.includes(tableName), `missing ${tableName}`)
  }

  for (const tableName of ['account', 'session']) {
    const foreignKeys = await client.execute(`PRAGMA foreign_key_list('${tableName}')`)
    assert.ok(foreignKeys.rows.some(row => (
      row.table === 'user'
      && row.from === 'user_id'
      && String(row.on_delete).toUpperCase() === 'CASCADE'
    )), `${tableName}.user_id must cascade`)
  }

  await db.insert(schema.user).values({
    id: 'cascade-user',
    name: 'Cascade User',
    email: 'cascade@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await db.insert(schema.session).values({
    id: 'cascade-session',
    token: 'cascade-token',
    userId: 'cascade-user',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await db.delete(schema.user).where(eq(schema.user.id, 'cascade-user'))

  const cascadeResult = await client.execute({
    sql: 'SELECT COUNT(*) AS count FROM session WHERE id = ?',
    args: ['cascade-session'],
  })
  assert.equal(Number(cascadeResult.rows[0].count), 0)
})

test('Better Auth sessions resolve, expire, and revoke through the H3 route', async (t) => {
  const { auth, client, db, fetch } = await createTestAuth()
  t.after(() => client.close())

  const context = await auth.$context
  const user = context.test.createUser({
    id: 'better-auth-user',
    name: 'Gear Planner',
    email: 'gear-planner@example.com',
  })
  await context.test.saveUser(user)

  await context.internalAdapter.createAccount({
    accountId: '987654321098765432',
    providerId: 'discord',
    userId: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const discordAccount = await context.internalAdapter.findAccountByProviderId(
    '987654321098765432',
    'discord',
  )
  assert.equal(discordAccount.accountId, '987654321098765432')
  assert.equal(discordAccount.providerId, 'discord')
  assert.equal(discordAccount.userId, 'better-auth-user')
  assert.notEqual(discordAccount.accountId, discordAccount.userId)

  const login = await context.test.login({ userId: user.id })
  assert.ok(
    Math.abs(
      login.session.expiresAt.getTime()
      - login.session.createdAt.getTime()
      - (AUTH_SESSION_EXPIRES_IN * 1000),
    ) < 1_000,
  )

  const sessionResponse = await request(fetch, '/api/auth/get-session', {
    headers: login.headers,
  })
  assert.equal(sessionResponse.status, 200)
  const sessionBody = await sessionResponse.json()
  assert.equal(sessionBody.user.id, user.id)
  assert.equal(sessionBody.session.id, login.session.id)

  const untrustedHeaders = new Headers(login.headers)
  untrustedHeaders.set('origin', 'https://attacker.example')
  const untrustedSignOut = await request(fetch, '/api/auth/sign-out', {
    method: 'POST',
    headers: untrustedHeaders,
  })
  assert.equal(untrustedSignOut.status, 403)

  const protectedSession = await request(fetch, '/api/auth/get-session', {
    headers: login.headers,
  })
  assert.equal((await protectedSession.json()).session.id, login.session.id)

  const signOutHeaders = new Headers(login.headers)
  signOutHeaders.set('origin', 'http://localhost:3000')
  const signOutResponse = await request(fetch, '/api/auth/sign-out', {
    method: 'POST',
    headers: signOutHeaders,
  })
  assert.equal(signOutResponse.status, 200)
  assert.deepEqual(await signOutResponse.json(), { success: true })

  const revokedResponse = await request(fetch, '/api/auth/get-session', {
    headers: login.headers,
  })
  assert.equal(await revokedResponse.json(), null)

  const expiringLogin = await context.test.login({ userId: user.id })
  await db
    .update(schema.session)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(schema.session.id, expiringLogin.session.id))

  const expiredResponse = await request(fetch, '/api/auth/get-session', {
    headers: expiringLogin.headers,
  })
  assert.equal(await expiredResponse.json(), null)
})

test('Discord OAuth start fixes the callback and enforces only identify and email', async (t) => {
  const { auth, client, fetch } = await createTestAuth()
  t.after(() => client.close())

  const response = await request(fetch, '/api/auth/sign-in/social', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      provider: 'discord',
      callbackURL: 'http://localhost:3000/planner?build=shared#priority',
      errorCallbackURL: 'http://localhost:3000/auth/error?returnTo=%2Fplanner%3Fbuild%3Dshared%23priority',
      disableRedirect: true,
      scopes: ['guilds', 'bot', 'applications.commands'],
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.redirect, false)

  const authorizationURL = new URL(body.url)
  assert.equal(authorizationURL.origin, 'https://discord.com')
  assert.equal(authorizationURL.pathname, '/api/oauth2/authorize')
  assert.equal(
    authorizationURL.searchParams.get('redirect_uri'),
    'http://localhost:3000/api/auth/callback/discord',
  )
  assert.deepEqual(
    authorizationURL.searchParams.get('scope').split(' ').sort(),
    ['email', 'identify'],
  )
  for (const forbiddenScope of ['guilds', 'bot', 'applications.commands']) {
    assert.ok(!authorizationURL.searchParams.get('scope').includes(forbiddenScope))
  }

  const stateRows = await client.execute('SELECT identifier FROM verification')
  assert.equal(stateRows.rows.length, 1)
  assert.ok(String(stateRows.rows[0].identifier).length > 0)

  const rateLimitRows = await client.execute('SELECT key FROM rate_limit')
  assert.ok(rateLimitRows.rows.length > 0)

  const context = await auth.$context
  const discordProvider = context.socialProviders.find(provider => provider.id === 'discord')
  assert.equal(discordProvider.options.overrideUserInfoOnSignIn, true)
  assert.equal(auth.options.account.encryptOAuthTokens, true)
  assert.equal(auth.options.account.storeStateStrategy, 'database')
  assert.deepEqual(auth.options.account.accountLinking, {
    enabled: false,
    disableImplicitLinking: true,
  })
  assert.equal(context.sessionConfig.updateAge, 60 * 60 * 24)

  const cancellationResponse = await request(
    fetch,
    `/api/auth/callback/discord?error=access_denied&error_description=${encodeURIComponent('provider details must stay hidden')}&state=${encodeURIComponent(authorizationURL.searchParams.get('state'))}`,
    {
      redirect: 'manual',
      headers: {
        cookie: response.headers
          .getSetCookie()
          .map(cookie => cookie.split(';', 1)[0])
          .join('; '),
      },
    },
  )
  assert.equal(cancellationResponse.status, 302)
  const cancellationURL = new URL(
    cancellationResponse.headers.get('location'),
    'http://localhost:3000',
  )
  assert.equal(cancellationURL.pathname, '/auth/error')
  assert.equal(cancellationURL.searchParams.get('error'), 'access_denied')
  assert.equal(
    cancellationURL.searchParams.get('returnTo'),
    '/planner?build=shared#priority',
  )
  assert.equal(cancellationURL.searchParams.has('error_description'), false)
})

test('account linking is rejected before an OAuth consent URL or state is created', async (t) => {
  const { auth, client, fetch } = await createTestAuth()
  t.after(() => client.close())

  const context = await auth.$context
  const user = context.test.createUser({
    id: 'linking-disabled-user',
    name: 'Linking Disabled',
    email: 'linking-disabled@example.com',
  })
  await context.test.saveUser(user)
  const login = await context.test.login({ userId: user.id })
  const headers = new Headers(login.headers)
  headers.set('content-type', 'application/json')
  headers.set('origin', 'http://localhost:3000')

  const response = await request(fetch, '/api/auth/link-social', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: 'discord',
      callbackURL: 'http://localhost:3000/',
      disableRedirect: true,
      scopes: ['guilds', 'bot', 'applications.commands'],
    }),
  })

  assert.equal(response.status, 403)
  const body = await response.json()
  assert.equal(body.code, 'ACCOUNT_LINKING_DISABLED')
  assert.ok(!JSON.stringify(body).includes('discord.com'))

  const stateRows = await client.execute('SELECT COUNT(*) AS count FROM verification')
  assert.equal(Number(stateRows.rows[0].count), 0)
})

test('Discord-managed profile fields cannot be changed through Better Auth', async (t) => {
  const { auth, client, db, fetch } = await createTestAuth()
  t.after(() => client.close())

  const context = await auth.$context
  const user = context.test.createUser({
    id: 'discord-profile-owner',
    name: 'Discord Display Name',
    email: 'discord-profile-owner@example.com',
    image: 'https://cdn.discordapp.com/avatars/123/avatar.png',
  })
  await context.test.saveUser(user)
  const login = await context.test.login({ userId: user.id })
  const headers = new Headers(login.headers)
  headers.set('content-type', 'application/json')
  headers.set('origin', 'http://localhost:3000')

  const response = await request(fetch, '/api/auth/update-user', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Injected Display Name',
      image: 'https://tracker.example/pixel.png',
    }),
  })

  assert.equal(response.status, 403)
  assert.equal((await response.json()).code, 'PROFILE_EDITING_DISABLED')
  const [storedUser] = await db
    .select({ image: schema.user.image, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, user.id))
    .limit(1)
  assert.deepEqual(storedUser, {
    image: 'https://cdn.discordapp.com/avatars/123/avatar.png',
    name: 'Discord Display Name',
  })
})

test('production auth context uses secure cookies and one trusted origin', async (t) => {
  const queuedTasks = []
  const backgroundTaskHandler = promise => queuedTasks.push(promise)
  const { auth, client } = await createTestAuth({
    baseURL: 'https://ltgear.vercel.app',
    backgroundTaskHandler,
  })
  t.after(() => client.close())

  const context = await auth.$context
  assert.equal(context.authCookies.sessionToken.attributes.httpOnly, true)
  assert.equal(context.authCookies.sessionToken.attributes.secure, true)
  assert.equal(context.authCookies.sessionToken.attributes.sameSite, 'lax')
  assert.deepEqual(auth.options.trustedOrigins, ['https://ltgear.vercel.app'])
  assert.equal(
    auth.options.advanced.backgroundTasks.handler,
    backgroundTaskHandler,
  )

  const task = Promise.resolve('complete')
  auth.options.advanced.backgroundTasks.handler(task)
  assert.deepEqual(queuedTasks, [task])
})

test('invalid OAuth state redirects to the public allowlisted error page', async (t) => {
  const { client, fetch } = await createTestAuth()
  t.after(() => client.close())

  const response = await request(
    fetch,
    '/api/auth/callback/discord?code=forged&state=missing',
    { redirect: 'manual' },
  )

  assert.equal(response.status, 302)
  const location = response.headers.get('location')
  assert.ok(location.startsWith('/auth/error?'))
  const errorURL = new URL(location, 'http://localhost:3000')
  assert.ok([
    'state_not_found',
    'state_mismatch',
    'state_invalid',
    'internal_server_error',
  ].includes(errorURL.searchParams.get('error')))
  assert.equal(errorURL.searchParams.has('error_description'), false)
})
