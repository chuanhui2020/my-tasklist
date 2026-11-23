const HOLIDAYS = [
  { name: '元旦', start: '2025-01-01', end: '2025-01-01' },
  { name: '春节', start: '2025-01-28', end: '2025-02-04' },
  { name: '清明节', start: '2025-04-04', end: '2025-04-06' },
  { name: '劳动节', start: '2025-05-01', end: '2025-05-05' },
  { name: '端午节', start: '2025-05-31', end: '2025-06-02' },
  { name: '中秋节+国庆节', start: '2025-10-01', end: '2025-10-08' },
  { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
  { name: '春节', start: '2026-02-15', end: '2026-02-23' },
  { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
  // 国办发明电〔2026〕10号 https://www.gov.cn/zhengce/content/202611/content_7085101.htm
  { name: '元旦', start: '2027-01-01', end: '2027-01-03' },
  { name: '春节', start: '2027-02-05', end: '2027-02-13' },
  { name: '清明节', start: '2027-04-03', end: '2027-04-05' },
  { name: '劳动节', start: '2027-05-01', end: '2027-05-05' },
  { name: '端午节', start: '2027-06-09', end: '2027-06-09' },
  { name: '中秋节', start: '2027-09-15', end: '2027-09-15' },
  { name: '国庆节', start: '2027-10-01', end: '2027-10-07' },
]

const makeupWorkdays = new Set([
  '2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28', '2025-10-11',
  '2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10',
  '2027-01-31', '2027-02-14', '2027-05-08', '2027-09-26', '2027-10-09',
])

const DAY_MS = 86400000

// 北京时间全年为 UTC+8。以 UTC 方法读取平移后的时钟，避免设备时区影响日期。
export function beijingClock(instant) {
  return new Date(instant.getTime() + 8 * 3600000)
}

function isRestWeekend(day) {
  const weekday = day.getUTCDay()
  return (weekday === 0 || weekday === 6) && !makeupWorkdays.has(day.toISOString().slice(0, 10))
}

function nextNewYearHoliday(dateKey) {
  const year = Number.parseInt(dateKey.slice(0, 4), 10) + 1
  const start = `${year}-01-01`
  return { name: '元旦', start, end: start }
}

export function calendarDay(dateKey) {
  const day = new Date(dateKey + 'T00:00:00Z')
  // 数据用尽后至少保证元旦当天算假期（有数据的年份表里已含元旦，这里不会命中）
  const holiday = HOLIDAYS.find(h => h.start <= dateKey && dateKey <= h.end)
    || (dateKey.endsWith('-01-01') ? { name: '元旦', start: dateKey, end: dateKey } : undefined)
  // 官方安排只发布到 2027 年，数据末尾后仍可计算下一年的元旦。
  const nextHoliday = holiday || HOLIDAYS.find(h => h.start > dateKey) || nextNewYearHoliday(dateKey)
  let daysToWeekend = 0
  const candidate = new Date(day)
  while (!isRestWeekend(candidate)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1)
    daysToWeekend++
  }
  return {
    holiday, nextHoliday, daysToWeekend,
    isWorkday: !holiday && daysToWeekend !== 0,
    daysToHoliday: nextHoliday && !holiday ? (Date.parse(nextHoliday.start) - day.getTime()) / DAY_MS : 0,
  }
}
