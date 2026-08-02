import { relations, sql } from 'drizzle-orm'
import {
  check,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import { user } from './auth-schema.js'

export const gearPlan = sqliteTable(
  'gear_plan',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    schemaVersion: integer('schema_version').notNull().default(1),
    plan: text('plan_json', { mode: 'json' }).notNull(),
    revision: integer('revision').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    check('gear_plan_schema_version_positive', sql`${table.schemaVersion} >= 1`),
    check('gear_plan_revision_positive', sql`${table.revision} >= 1`),
  ],
)

export const gearPlanRelations = relations(gearPlan, ({ one }) => ({
  user: one(user, {
    fields: [gearPlan.userId],
    references: [user.id],
  }),
}))
