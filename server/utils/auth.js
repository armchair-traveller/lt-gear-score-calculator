import { waitUntil as vercelWaitUntil } from '@vercel/functions'
import { createDatabase } from '../db/client.js'
import * as schema from '../db/schema.js'
import { createAuth, readAuthEnvironment } from './auth-config.js'

let runtimeServices

export function createRuntimeServices({
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

  return {
    db: database,
    auth: createAuth({
      db: database,
      schema,
      baseURL: authEnvironment.baseURL,
      secret: authEnvironment.secret,
      discordClientId: authEnvironment.discordClientId,
      discordClientSecret: authEnvironment.discordClientSecret,
      backgroundTaskHandler: backgroundTaskHandler
        ?? (environment.VERCEL ? vercelWaitUntil : undefined),
    }),
  }
}

export function createRuntimeAuth(options) {
  return createRuntimeServices(options).auth
}

export function getRuntimeServices() {
  runtimeServices ||= createRuntimeServices()
  return runtimeServices
}

export function getAuth() {
  return getRuntimeServices().auth
}

export function getDatabase() {
  return getRuntimeServices().db
}
