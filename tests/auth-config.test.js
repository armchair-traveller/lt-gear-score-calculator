import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AUTH_ALLOWED_BASE_URLS,
  AUTH_SESSION_EXPIRES_IN,
  DISCORD_AUTH_SCOPES,
  getDiscordUserEmail,
  mapDiscordProfileToUser,
  readAuthEnvironment,
  writeRedactedAuthLog,
} from '../server/utils/auth-config.js'

const validEnvironment = Object.freeze({
  BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters-long',
  BETTER_AUTH_URL: 'http://localhost:3000/',
  DISCORD_APPLICATION_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'discord-client-secret',
  TURSO_DATABASE_URL: 'libsql://ltgear-auth.example.turso.io',
  TURSO_AUTH_TOKEN: 'turso-auth-token',
})

test('auth environment parsing normalizes public configuration', () => {
  assert.deepEqual(readAuthEnvironment(validEnvironment), {
    baseURL: 'http://localhost:3000',
    databaseURL: 'libsql://ltgear-auth.example.turso.io',
    databaseAuthToken: 'turso-auth-token',
    discordClientId: '123456789012345678',
    discordClientSecret: 'discord-client-secret',
    isProduction: false,
    secret: 'test-secret-at-least-thirty-two-characters-long',
  })
  assert.deepEqual([...DISCORD_AUTH_SCOPES], ['identify', 'email'])
  assert.deepEqual([...AUTH_ALLOWED_BASE_URLS], [
    'http://localhost:3000',
    'https://ltgear.vercel.app',
  ])
  assert.equal(AUTH_SESSION_EXPIRES_IN, 60 * 60 * 24 * 7)
})

test('auth environment errors name missing keys without exposing values', () => {
  const environment = {
    ...validEnvironment,
    BETTER_AUTH_SECRET: '',
    TURSO_AUTH_TOKEN: '',
  }

  assert.throws(
    () => readAuthEnvironment(environment),
    (error) => {
      assert.match(error.message, /BETTER_AUTH_SECRET, TURSO_AUTH_TOKEN/)
      assert.doesNotMatch(error.message, /discord-client-secret|turso-auth-token/)
      return true
    },
  )
})

test('auth requires a strong secret and Discord snowflake in every runtime', () => {
  assert.throws(
    () => readAuthEnvironment({
      ...validEnvironment,
      BETTER_AUTH_URL: 'https://ltgear.vercel.app',
      BETTER_AUTH_SECRET: 'short',
    }),
    /at least 32 characters/,
  )
  assert.throws(
    () => readAuthEnvironment({
      ...validEnvironment,
      BETTER_AUTH_URL: 'https://ltgear.vercel.app',
      DISCORD_APPLICATION_ID: 'not-a-snowflake',
    }),
    /Discord snowflake/,
  )

  assert.equal(
    readAuthEnvironment({ ...validEnvironment, NODE_ENV: 'production' }).isProduction,
    false,
  )
  assert.equal(
    readAuthEnvironment({
      ...validEnvironment,
      BETTER_AUTH_URL: 'https://ltgear.vercel.app',
    }).isProduction,
    true,
  )
})

test('auth accepts only the registered localhost and production origins', () => {
  for (const baseURL of [
    'https://preview.example.vercel.app',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://localhost:3000/api/auth',
  ]) {
    assert.throws(
      () => readAuthEnvironment({ ...validEnvironment, BETTER_AUTH_URL: baseURL }),
      /must be one of/,
      baseURL,
    )
  }
})

test('Vercel Production requires the canonical origin and a remote database', () => {
  assert.throws(
    () => readAuthEnvironment({
      ...validEnvironment,
      VERCEL_ENV: 'production',
    }),
    /Vercel Production requires BETTER_AUTH_URL/,
  )
  assert.throws(
    () => readAuthEnvironment({
      ...validEnvironment,
      VERCEL_ENV: 'production',
      BETTER_AUTH_URL: 'https://ltgear.vercel.app',
      TURSO_DATABASE_URL: 'file:local-auth.db',
    }),
    /TURSO_DATABASE_URL must use libsql or https in production/,
  )
})

test('auth logging never stringifies supplied errors or metadata', () => {
  const sentinel = 'do-not-log-discord-user-or-token'
  const logged = []
  const originalConsoleError = console.error

  console.error = (...values) => logged.push(values.join(' '))
  try {
    writeRedactedAuthLog(
      'error',
      new Error(`SQL parameters: ${sentinel}`),
      { email: `${sentinel}@example.com` },
    )
  }
  finally {
    console.error = originalConsoleError
  }

  assert.deepEqual(logged, ['[better-auth] Authentication error'])
  assert.ok(!logged.join(' ').includes(sentinel))
})

test('Discord profile mapping supports real and phone-only accounts', () => {
  assert.equal(
    getDiscordUserEmail({ id: '123', email: ' Player@Example.COM ' }),
    'player@example.com',
  )
  assert.equal(getDiscordUserEmail({ id: '123', email: null }), '123@discord.invalid')
  assert.throws(() => getDiscordUserEmail({ email: null }), /profile ID is required/)

  assert.deepEqual(
    mapDiscordProfileToUser({ id: '123', email: 'player@example.com', verified: true }),
    { email: 'player@example.com', emailVerified: true },
  )
  assert.deepEqual(
    mapDiscordProfileToUser({ id: '123', email: null, verified: true }),
    { email: '123@discord.invalid', emailVerified: false },
  )
})
