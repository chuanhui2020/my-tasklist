// 任务截止时间状态分级
// 依据 due_date (YYYY-MM-DD，可选) 与 status (pending/done) 计算紧急程度，
// 用于任务卡片上的时间状态徽章。颜色 + 图标 + 文案三者并用，
// 不依赖颜色单一维度传达信息（无障碍要求）。

// 把 YYYY-MM-DD 解析为「当天 00:00」的本地时间，避免时区偏移
function parseLocalDate(ymd) {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// 今天 00:00（本地）
function todayStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// 计算 due 距今天的「天数差」：负数=已过，0=今天，正数=未来还剩几天
function diffDays(ymd) {
  const due = parseLocalDate(ymd)
  if (!due) return null
  const MS_PER_DAY = 86400000
  return Math.round((due - todayStart()) / MS_PER_DAY)
}

/**
 * 返回任务的截止状态描述对象，供徽章组件渲染。
 * @returns {{
 *   level: 'done'|'none'|'overdue'|'today'|'soon'|'upcoming'|'future',
 *   label: string,   // 徽章文案
 *   icon: string,    // Element Plus 图标组件名
 *   days: number|null
 * }}
 */
export function getDueStatus(task) {
  // 已完成：淡化处理，不强调紧急度
  if (task.status === 'done') {
    return { level: 'done', label: '已完成', icon: 'CircleCheck', days: null }
  }

  const days = diffDays(task.due_date)

  // 无截止日期
  if (days === null) {
    return { level: 'none', label: '无期限', icon: 'Minus', days: null }
  }

  // 已逾期
  if (days < 0) {
    const n = Math.abs(days)
    return { level: 'overdue', label: `已逾期${n}天`, icon: 'Warning', days }
  }

  // 今天到期
  if (days === 0) {
    return { level: 'today', label: '今天到期', icon: 'AlarmClock', days }
  }

  // 3 天内（含第 1~3 天）
  if (days <= 3) {
    return { level: 'soon', label: `还剩${days}天`, icon: 'Clock', days }
  }

  // 一周内
  if (days <= 7) {
    return { level: 'upcoming', label: `还剩${days}天`, icon: 'Calendar', days }
  }

  // 更远的未来：直接展示日期，避免「还剩30天」这类弱信息
  return { level: 'future', label: task.due_date.slice(5), icon: 'Calendar', days }
}
