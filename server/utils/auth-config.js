import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import * as defaultSchema from '../db/schema.js'

export const AUTH_SESSION_EXPIRES_IN = 60 * 60 * 24 * 7
export const DISCORD_AUTH_SCOPES = Object.freeze(['identify', 'email'])
export const AUTH_ALLOWED_BASE_URLS = Object.freeze([
  'http://localhost:3000',
  'https://ltgear.vercel.app',
])

export function writeRedactedAuthLog(level) {
  const logMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'
  const safeMessage = level === 'error'
    ? 'Authentication error'
    : level === 'warn'
      ? 'Authentication warning'
      : 'Authentication event'

  console[logMethod](`[better-auth] ${safeMessage}`)
}

const requiredRuntimeEnvironment = Object.freeze([
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'DISCORD_APPLICATION_ID',
  'DISCORD_CLIENT_SECRET',
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
])

function readRequiredValue(environment, name) {
  const value = environment[name]
  return typeof value === 'string' ? value.trim() : ''
}

function parseUrl(value, name) {
  try {
    return new URL(value)
  }
  catch {
    throw new Error(`${name} must be a valid absolute URL.`)
  }
}

export function getDiscordUserEmail(profile) {
  const email = typeof profile?.email === 'string' ? profile.email.trim() : ''

  if (email) {
    return email.toLowerCase()
  }

  const profileId = String(profile?.id || '').trim()
  if (!profileId) {
    throw new TypeError('A Discord profile ID is required to create an email fallback.')
  }

  return `${profileId}@discord.invalid`
}

export function mapDiscordProfileToUser(profile) {
  const hasDiscordEmail = typeof profile?.email === 'string'
    && profile.email.trim().length > 0

  return {
    email: getDiscordUserEmail(profile),
    emailVerified: hasDiscordEmail && profile.verified === true,
  }
}

export function readAuthEnvironment(environment = process.env) {
  const missing = requiredRuntimeEnvironment.filter(
    name => !readRequiredValue(environment, name),
  )

  if (missing.length) {
    throw new Error(
      `Missing required authentication environment variables: ${missing.join(', ')}.`,
    )
  }

  const baseURL = parseUrl(
    readRequiredValue(environment, 'BETTER_AUTH_URL'),
    'BETTER_AUTH_URL',
  )
  const databaseURL = parseUrl(
    readRequiredValue(environment, 'TURSO_DATABASE_URL'),
    'TURSO_DATABASE_URL',
  )
  const secret = readRequiredValue(environment, 'BETTER_AUTH_SECRET')
  const discordClientId = readRequiredValue(environment, 'DISCORD_APPLICATION_ID')
  const normalizedBaseURL = baseURL.toString().replace(/\/$/, '')
  const isVercelProduction = readRequiredValue(environment, 'VERCEL_ENV').toLowerCase() === 'production'
  const isProduction = normalizedBaseURL === 'https://ltgear.vercel.app'

  if (!['http:', 'https:'].includes(baseURL.protocol)) {
    throw new Error('BETTER_AUTH_URL must use http or https.')
  }

  if (!AUTH_ALLOWED_BASE_URLS.includes(normalizedBaseURL)) {
    throw new Error(
      `BETTER_AUTH_URL must be one of: ${AUTH_ALLOWED_BASE_URLS.join(', ')}.`,
    )
  }

  if (isVercelProduction && !isProduction) {
    throw new Error(
      'Vercel Production requires BETTER_AUTH_URL=https://ltgear.vercel.app.',
    )
  }

  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.')
  }

  if (!/^\d+$/.test(discordClientId)) {
    throw new Error('DISCORD_APPLICATION_ID must be a Discord snowflake.')
  }

  if (
    isProduction
    && !['libsql:', 'https:'].includes(databaseURL.protocol)
  ) {
    throw new Error('TURSO_DATABASE_URL must use libsql or https in production.')
  }

  return {
    baseURL: normalizedBaseURL,
    databaseURL: databaseURL.toString(),
    databaseAuthToken: readRequiredValue(environment, 'TURSO_AUTH_TOKEN'),
    discordClientId,
    discordClientSecret: readRequiredValue(environment, 'DISCORD_CLIENT_SECRET'),
    isProduction,
    secret,
  }
}

export function createAuth({
  db,
  schema = defaultSchema,
  baseURL,
  secret,
  discordClientId,
  discordClientSecret,
  backgroundTaskHandler,
  plugins = [],
} = {}) {
  if (!db) {
    throw new TypeError('A Drizzle database instance is required.')
  }

  for (const [name, value] of Object.entries({
    baseURL,
    secret,
    discordClientId,
    discordClientSecret,
  })) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new TypeError(`${name} is required.`)
    }
  }

  if (backgroundTaskHandler !== undefined && typeof backgroundTaskHandler !== 'function') {
    throw new TypeError('backgroundTaskHandler must be a function when provided.')
  }

  return betterAuth({
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    onAPIError: {
      errorURL: '/auth/error',
      onError: () => writeRedactedAuthLog('error'),
    },
    logger: {
      level: 'warn',
      log: writeRedactedAuthLog,
    },
    secret,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      discord: {
        clientId: discordClientId,
        clientSecret: discordClientSecret,
        disableDefaultScope: true,
        scope: [...DISCORD_AUTH_SCOPES],
        mapProfileToUser: mapDiscordProfileToUser,
        overrideUserInfoOnSignIn: true,
      },
    },
    account: {
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
      },
      encryptOAuthTokens: true,
      storeStateStrategy: 'database',
    },
    session: {
      expiresIn: AUTH_SESSION_EXPIRES_IN,
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
    },
    advanced: backgroundTaskHandler
      ? {
          backgroundTasks: {
            handler: backgroundTaskHandler,
          },
        }
      : undefined,
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path === '/link-social') {
          throw APIError.from('FORBIDDEN', {
            code: 'ACCOUNT_LINKING_DISABLED',
            message: 'Account linking is disabled.',
          })
        }

        if (
          context.path === '/sign-in/social'
          && context.body?.provider === 'discord'
        ) {
          context.body.scopes = []
        }
      }),
      after: createAuthMiddleware(async (context) => {
        const location = context.context.responseHeaders?.get('location')
        if (!location) {
          return
        }

        const errorURL = new URL(location, baseURL)
        if (
          errorURL.origin !== new URL(baseURL).origin
          || errorURL.pathname !== '/auth/error'
          || !errorURL.searchParams.has('error_description')
        ) {
          return
        }

        errorURL.searchParams.delete('error_description')
        context.setHeader(
          'location',
          location.startsWith('http')
            ? errorURL.toString()
            : `${errorURL.pathname}${errorURL.search}${errorURL.hash}`,
        )
      }),
    },
    plugins,
  })
}
