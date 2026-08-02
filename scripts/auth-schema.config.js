import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../server/db/schema.js'
import { createAuth } from '../server/utils/auth-config.js'

const schemaClient = createClient({ url: ':memory:' })
const schemaDatabase = drizzle(schemaClient, { schema })

export const auth = createAuth({
  db: schemaDatabase,
  schema,
  baseURL: 'http://localhost:3000',
  secret: 'schema-generation-only-value-not-used-at-runtime',
  discordClientId: 'schema-generation-only',
  discordClientSecret: 'schema-generation-only',
})
