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

export const datasetRequests = pgTable('dataset_requests', {
  id: serial('id').primaryKey(),
  company: text('company').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  useCase: text('use_case'),
  userId: text('user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const fleetSubscriptions = pgTable('fleet_subscriptions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  company: text('company').notNull(),
  vehicles: integer('vehicles').notNull(),
  status: text('status').notNull(),
  stripeSessionId: text('stripe_session_id').notNull().unique(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AlertRow = typeof alerts.$inferSelect
