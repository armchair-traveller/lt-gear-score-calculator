import { waitUntil as vercelWaitUntil } from '@vercel/functions'
import { createDatabase } from '../db/client.js'
import * as schema from '../db/schema.js'
import { createAuth, readAuthEnvironment } from './auth-config.js'

let runtimeAuth

export function createRuntimeAuth({
  environment = process.env,
  db,
  backgroundTaskHandler,
} = {}) {
  const authEnvironment = readAuthEnvironment(environment)
  const database = db || createDatabase({
    url: authEnvironment.databaseURL,
    authToken: authEnvironment.databaseAuthToken,
    schema,
  }).db

  return createAuth({
    db: database,
    schema,
    baseURL: authEnvironment.baseURL,
    secret: authEnvironment.secret,
    discordClientId: authEnvironment.discordClientId,
    discordClientSecret: authEnvironment.discordClientSecret,
    backgroundTaskHandler: backgroundTaskHandler
      ?? (environment.VERCEL ? vercelWaitUntil : undefined),
  })
}

export function getAuth() {
  runtimeAuth ||= createRuntimeAuth()
  return runtimeAuth
}
