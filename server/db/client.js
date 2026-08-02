import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as defaultSchema from './schema.js'

export function createDatabaseClient({ url, authToken }) {
  if (!url) {
    throw new TypeError('A libSQL database URL is required.')
  }

  return createClient({
    url,
    authToken: authToken || undefined,
  })
}

export function createDatabase({
  url,
  authToken,
  client,
  schema = defaultSchema,
} = {}) {
  const databaseClient = client || createDatabaseClient({ url, authToken })

  return {
    client: databaseClient,
    db: drizzle(databaseClient, { schema }),
  }
}
