/**
 * MySQL JSON → D1 导入脚本
 *
 * 用法:
 *   1. 先在服务器上运行 export_data.py 导出 data.json
 *   2. 将 data.json 放到 backend/scripts/ 目录
 *   3. 运行: npx wrangler d1 execute tasklist-db --remote --file=scripts/import.sql
 *      或者用本脚本生成 SQL: npx tsx scripts/import-to-d1.ts > scripts/import.sql
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const dataPath = join(import.meta.dirname || __dirname, 'data.json')
const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

function esc(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return String(val)
  const s = String(val).replace(/'/g, "''")
  return `'${s}'`
}

function formatDatetime(val: string | null): string {
  if (!val) return 'NULL'
  // MySQL: "2024-01-01 12:00:00" → keep as-is for D1 TEXT columns
  return esc(val)
}

function formatDate(val: string | null): string {
  if (!val) return 'NULL'
  // Just the date part
  return esc(val.slice(0, 10))
}

const lines: string[] = []

// Users
for (const row of data.users || []) {
  lines.push(
    `INSERT INTO users (id, username, password_hash, role, created_at) VALUES (${row.id}, ${esc(row.username)}, ${esc(row.password_hash)}, ${esc(row.role)}, ${formatDatetime(row.created_at)});`
  )
}

// Tasks
for (const row of data.tasks || []) {
  lines.push(
    `INSERT INTO tasks (id, title, description, status, due_date, created_at, user_id) VALUES (${row.id}, ${esc(row.title)}, ${esc(row.description)}, ${esc(row.status)}, ${formatDate(row.due_date)}, ${formatDatetime(row.created_at)}, ${row.user_id});`
  )
}

// BMI Profiles
for (const row of data.bmi_profiles || []) {
  lines.push(
    `INSERT INTO bmi_profiles (id, user_id, gender, age, height, weight, updated_at) VALUES (${row.id}, ${row.user_id}, ${esc(row.gender)}, ${row.age}, ${row.height}, ${row.weight}, ${formatDatetime(row.updated_at)});`
  )
}

// Fortune Records
for (const row of data.fortune_records || []) {
  lines.push(
    `INSERT INTO fortune_records (id, user_id, fortune_number, fortune_type, type_text, poem, interpretation, advice, work_fortune, created_at) VALUES (${row.id}, ${row.user_id}, ${row.fortune_number}, ${esc(row.fortune_type)}, ${esc(row.type_text)}, ${esc(row.poem)}, ${esc(row.interpretation)}, ${esc(row.advice)}, ${esc(row.work_fortune)}, ${formatDatetime(row.created_at)});`
  )
}

// Secure Notes (encrypted_content + salt + password_hash 原样迁移)
for (const row of data.secure_notes || []) {
  lines.push(
    `INSERT INTO secure_notes (id, user_id, title, encrypted_content, salt, password_hash, created_at, updated_at) VALUES (${row.id}, ${row.user_id}, ${esc(row.title)}, ${esc(row.encrypted_content)}, ${esc(row.salt)}, ${esc(row.password_hash)}, ${formatDatetime(row.created_at)}, ${formatDatetime(row.updated_at)});`
  )
}

// Weight Records
for (const row of data.weight_records || []) {
  lines.push(
    `INSERT INTO weight_records (id, user_id, weight, date, created_at) VALUES (${row.id}, ${row.user_id}, ${row.weight}, ${formatDate(row.date)}, ${formatDatetime(row.created_at)});`
  )
}

// Countdowns
for (const row of data.countdowns || []) {
  lines.push(
    `INSERT INTO countdowns (id, title, target_time, remind_before, remind_level, status, user_id, created_at) VALUES (${row.id}, ${esc(row.title)}, ${formatDatetime(row.target_time)}, ${row.remind_before}, ${esc(row.remind_level)}, ${esc(row.status)}, ${row.user_id}, ${formatDatetime(row.created_at)});`
  )
}

// Weekly Menus
for (const row of data.weekly_menus || []) {
  lines.push(
    `INSERT INTO weekly_menus (id, week_start, menu_json, uploaded_by, created_at, updated_at) VALUES (${row.id}, ${formatDate(row.week_start)}, ${esc(row.menu_json)}, ${row.uploaded_by}, ${formatDatetime(row.created_at)}, ${formatDatetime(row.updated_at)});`
  )
}

console.log(lines.join('\n'))
