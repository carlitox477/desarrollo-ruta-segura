import {
  bigserial,
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

export const apiAccounts = pgTable('api_accounts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  company: text('company').notNull(),
  status: text('status').notNull().default('pending'),
  stripeSessionId: text('stripe_session_id').unique(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const apiUsage = pgTable('api_usage', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  keyId: integer('key_id').notNull(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  statusCode: integer('status_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AlertRow = typeof alerts.$inferSelect
