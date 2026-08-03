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

function createUser(id) {
  return {
    id,
    name: 'Shared Display Name',
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createPlan(userId) {
  return {
    userId,
    schemaVersion: 1,
    plan: { version: 1, slots: {} },
    revision: 1,
  }
}

test('public build migration enforces one unique cascading share per cloud plan', async (t) => {
  const { client, db } = createDatabase({ url: ':memory:' })
  t.after(() => client.close())
  await migrate(db, { migrationsFolder })

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  )
  assert.ok(tables.rows.some(row => row.name === 'gear_plan_share'))

  const columns = await client.execute("PRAGMA table_info('gear_plan_share')")
  assert.deepEqual(
    columns.rows.map(row => row.name),
    ['user_id', 'slug', 'created_at'],
  )

  const foreignKeys = await client.execute(
    "PRAGMA foreign_key_list('gear_plan_share')",
  )
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
      table: 'gear_plan',
      to: 'user_id',
    }],
  )

  const indexes = await client.execute("PRAGMA index_list('gear_plan_share')")
  const slugIndex = indexes.rows.find(
    row => row.name === 'gear_plan_share_slug_unique',
  )
  assert.ok(slugIndex)
  assert.equal(Number(slugIndex.unique), 1)

  await db.insert(schema.user).values([
    createUser('public-owner-a'),
    createUser('public-owner-b'),
  ])
  await db.insert(schema.gearPlan).values([
    createPlan('public-owner-a'),
    createPlan('public-owner-b'),
  ])
  await db.insert(schema.gearPlanShare).values({
    userId: 'public-owner-a',
    slug: 'shared-display-name',
  })

  await assert.rejects(
    db.insert(schema.gearPlanShare).values({
      userId: 'public-owner-a',
      slug: 'renamed-build',
    }),
    error => /UNIQUE constraint failed/.test(String(error.cause?.message)),
  )
  await assert.rejects(
    db.insert(schema.gearPlanShare).values({
      userId: 'public-owner-b',
      slug: 'shared-display-name',
    }),
    error => /UNIQUE constraint failed/.test(String(error.cause?.message)),
  )

  await db
    .delete(schema.gearPlan)
    .where(eq(schema.gearPlan.userId, 'public-owner-a'))
  const remainingAfterPlanDelete = await client.execute(
    "SELECT COUNT(*) AS count FROM gear_plan_share WHERE user_id = 'public-owner-a'",
  )
  assert.equal(Number(remainingAfterPlanDelete.rows[0].count), 0)

  await db.insert(schema.gearPlanShare).values({
    userId: 'public-owner-b',
    slug: 'shared-display-name-2',
  })
  await db.delete(schema.user).where(eq(schema.user.id, 'public-owner-b'))
  const remainingAfterUserDelete = await client.execute(
    "SELECT COUNT(*) AS count FROM gear_plan_share WHERE user_id = 'public-owner-b'",
  )
  assert.equal(Number(remainingAfterUserDelete.rows[0].count), 0)
})

test('public build migration remains idempotent', async (t) => {
  const { client, db } = createDatabase({ url: ':memory:' })
  t.after(() => client.close())

  await migrate(db, { migrationsFolder })
  await migrate(db, { migrationsFolder })

  const tables = await client.execute(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'gear_plan_share'",
  )
  const indexes = await client.execute(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'gear_plan_share_slug_unique'",
  )
  assert.equal(Number(tables.rows[0].count), 1)
  assert.equal(Number(indexes.rows[0].count), 1)
})
