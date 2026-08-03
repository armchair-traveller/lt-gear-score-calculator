import { relations, sql } from 'drizzle-orm'
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { gearPlan } from './gear-plan-schema.js'

export const gearPlanShare = sqliteTable(
  'gear_plan_share',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => gearPlan.userId, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  table => [
    uniqueIndex('gear_plan_share_slug_unique').on(table.slug),
  ],
)

export const gearPlanShareRelations = relations(gearPlanShare, ({ one }) => ({
  gearPlan: one(gearPlan, {
    fields: [gearPlanShare.userId],
    references: [gearPlan.userId],
  }),
}))
