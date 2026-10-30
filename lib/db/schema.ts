import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

export const alerts = pgTable('alerts', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(),
  severity: integer('severity').notNull(),
  description: text('description'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('active'),
  isDemo: boolean('is_demo').notNull().default(false),
  reporterHash: text('reporter_hash').notNull(),
  flagCount: integer('flag_count').notNull().default(0),
  confirmCount: integer('confirm_count').notNull().default(0),
})

export const alertFlags = pgTable(
  'alert_flags',
  {
    id: serial('id').primaryKey(),
    alertId: integer('alert_id').notNull(),
    reporterHash: text('reporter_hash').notNull(),
    kind: text('kind').notNull().default('false'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.alertId, t.reporterHash)],
)

export type AlertRow = typeof alerts.$inferSelect
