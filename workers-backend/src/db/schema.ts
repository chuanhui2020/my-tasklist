import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').default(''),
  status: text('status', { enum: ['pending', 'done'] }).notNull().default('pending'),
  due_date: text('due_date'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  user_id: integer('user_id').notNull().references(() => users.id),
}, (table) => [
  index('idx_tasks_user_status').on(table.user_id, table.status),
  index('idx_tasks_user_due_date').on(table.user_id, table.due_date),
])

export const bmiProfiles = sqliteTable('bmi_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().unique().references(() => users.id),
  gender: text('gender').notNull().default('male'),
  age: integer('age').notNull().default(28),
  height: integer('height').notNull().default(170),
  weight: real('weight').notNull().default(65.0),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const fortuneRecords = sqliteTable('fortune_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  fortune_number: integer('fortune_number').notNull(),
  fortune_type: text('fortune_type').notNull(),
  type_text: text('type_text').notNull(),
  poem: text('poem').notNull(),
  interpretation: text('interpretation').notNull(),
  advice: text('advice').notNull(),
  work_fortune: text('work_fortune'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const secureNotes = sqliteTable('secure_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description').default(''),
  encrypted_content: text('encrypted_content').notNull(),
  salt: text('salt').notNull(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const weightRecords = sqliteTable('weight_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  weight: real('weight').notNull(),
  date: text('date').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('idx_weight_user_date').on(table.user_id, table.date),
])

export const countdowns = sqliteTable('countdowns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  target_time: text('target_time').notNull(),
  remind_before: integer('remind_before').notNull().default(5),
  remind_level: text('remind_level', { enum: ['normal', 'urgent', 'crazy'] }).notNull().default('urgent'),
  status: text('status', { enum: ['active', 'expired', 'dismissed'] }).notNull().default('active'),
  user_id: integer('user_id').notNull().references(() => users.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const taskImages = sqliteTable('task_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  task_id: integer('task_id').notNull().references(() => tasks.id),
  user_id: integer('user_id').notNull().references(() => users.id),
  r2_key: text('r2_key').notNull(),
  filename: text('filename').notNull(),
  mime_type: text('mime_type').notNull(),
  size: integer('size').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_task_images_task_id').on(table.task_id),
])

export const weeklyMenus = sqliteTable('weekly_menus', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  week_start: text('week_start').notNull().unique(),
  menu_json: text('menu_json').notNull(),
  uploaded_by: integer('uploaded_by').notNull().references(() => users.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
})
