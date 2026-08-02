import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })

export default {
  schema: './server/db/schema.js',
  out: './server/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
}
