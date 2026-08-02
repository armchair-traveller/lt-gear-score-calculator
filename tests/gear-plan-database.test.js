import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createDatabase } from '../server/db/client.js'
import * as schema from '../server/db/schema.js'

const migrationsFolder = fileURLToPath(
  new URL('../server/db/migrations', import.meta.url),
)

async function createMigratedDatabase() {
  const database = createDatabase({ url: ':memory:' })
  await migrate(database.db, { migrationsFolder })
  return database
}

function createUser(id) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

test('cloud planner migration enforces ownership, cascade, and revision invariants', async (t) => {
  const { client, db } = await createMigratedDatabase()
  t.after(() => client.close())

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  )
  assert.ok(tables.rows.some(row => row.name === 'gear_plan'))

  const columns = await client.execute("PRAGMA table_info('gear_plan')")
  assert.deepEqual(
    columns.rows.map(row => row.name),
    [
      'user_id',
      'schema_version',
      'plan_json',
      'revision',
      'created_at',
      'updated_at',
    ],
  )

  const foreignKeys = await client.execute("PRAGMA foreign_key_list('gear_plan')")
  assert.deepEqual(
    foreignKeys.rows.map(row => ({
      from: row.from,
      onDelete: String(row.on_delete).toUpperCase(),
      table: row.table,
      to: row.to,
    })),
    [{
      from: 'user_id',
      onDelete: 'CASCADE',
      table: 'user',
      to: 'id',
    }],
  )

  await db.insert(schema.user).values(createUser('planner-owner'))
  await db.insert(schema.gearPlan).values({
    userId: 'planner-owner',
    schemaVersion: 1,
    plan: { version: 1, slots: {} },
    revision: 1,
  })
  const storedPlan = await client.execute(
    "SELECT schema_version, plan_json FROM gear_plan WHERE user_id = 'planner-owner'",
  )
  assert.equal(Number(storedPlan.rows[0].schema_version), 1)
  assert.deepEqual(JSON.parse(storedPlan.rows[0].plan_json), {
    version: 1,
    slots: {},
  })

  await assert.rejects(
    db.insert(schema.gearPlan).values({
      userId: 'planner-owner',
      schemaVersion: 1,
      plan: { version: 1, slots: {} },
      revision: 1,
    }),
  )
  await assert.rejects(
    db.update(schema.gearPlan)
      .set({ revision: 0 })
      .where(eq(schema.gearPlan.userId, 'planner-owner')),
  )

  await db.delete(schema.user).where(eq(schema.user.id, 'planner-owner'))
  const remaining = await client.execute(
    "SELECT COUNT(*) AS count FROM gear_plan WHERE user_id = 'planner-owner'",
  )
  assert.equal(Number(remaining.rows[0].count), 0)
})

test('cloud planner migrations can be applied twice without duplicating schema', async (t) => {
  const { client, db } = await createMigratedDatabase()
  t.after(() => client.close())

  await migrate(db, { migrationsFolder })

  const tables = await client.execute(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'gear_plan'",
  )
  const indexes = await client.execute(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'account_provider_id_account_id_unique'",
  )
  assert.equal(Number(tables.rows[0].count), 1)
  assert.equal(Number(indexes.rows[0].count), 1)
})

test('all migrations preserve unique Discord provider-account identity', async (t) => {
  const { client, db } = await createMigratedDatabase()
  t.after(() => client.close())

  const indexes = await client.execute("PRAGMA index_list('account')")
  const identityIndex = indexes.rows.find(
    row => row.name === 'account_provider_id_account_id_unique',
  )
  assert.ok(identityIndex)
  assert.equal(Number(identityIndex.unique), 1)

  const columns = await client.execute(
    "PRAGMA index_info('account_provider_id_account_id_unique')",
  )
  assert.deepEqual(
    columns.rows
      .toSorted((left, right) => Number(left.seqno) - Number(right.seqno))
      .map(row => row.name),
    ['provider_id', 'account_id'],
  )

  await db.insert(schema.user).values([
    createUser('identity-user-a'),
    createUser('identity-user-b'),
  ])
  const now = new Date()
  await db.insert(schema.account).values({
    id: 'identity-account-a',
    accountId: '123456789012345678',
    providerId: 'discord',
    userId: 'identity-user-a',
    createdAt: now,
    updatedAt: now,
  })

  await assert.rejects(
    db.insert(schema.account).values({
      id: 'identity-account-duplicate',
      accountId: '123456789012345678',
      providerId: 'discord',
      userId: 'identity-user-b',
      createdAt: now,
      updatedAt: now,
    }),
    error => /UNIQUE constraint failed/.test(String(error.cause?.message)),
  )

  await db.insert(schema.account).values({
    id: 'identity-account-other-provider',
    accountId: '123456789012345678',
    providerId: 'test-provider',
    userId: 'identity-user-b',
    createdAt: now,
    updatedAt: now,
  })
})
