import { Picture, Document, Grid, DataAnalysis, Box, Memo, Files } from '@element-plus/icons-vue'

// 附件类型 → 图标 + 语义色。颜色只是辅助，标签文字始终一起出现，
// 不能只靠颜色区分类型（色盲用户看不出来）。
const CATEGORIES = {
  image: { label: '图片', icon: Picture, color: '#22d3ee' },
  pdf: { label: 'PDF', icon: Document, color: '#f87171' },
  doc: { label: '文档', icon: Document, color: '#60a5fa' },
  sheet: { label: '表格', icon: Grid, color: '#34d399' },
  slide: { label: '幻灯片', icon: DataAnalysis, color: '#fb923c' },
  archive: { label: '压缩包', icon: Box, color: '#a78bfa' },
  text: { label: '文本', icon: Memo, color: '#94a3b8' },
  other: { label: '文件', icon: Files, color: '#94a3b8' },
}

const MIME_CATEGORY = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'application/vnd.ms-excel': 'sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
  'text/csv': 'sheet',
  'application/vnd.ms-powerpoint': 'slide',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slide',
  'application/zip': 'archive',
  'text/plain': 'text',
  'text/markdown': 'text',
  'application/json': 'text',
}

export const PREVIEWABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function isImageAttachment(mimeType) {
  return PREVIEWABLE_IMAGE_TYPES.includes(mimeType)
}

export function getFileMeta(mimeType) {
  if (mimeType?.startsWith('image/')) return CATEGORIES.image
  return CATEGORIES[MIME_CATEGORY[mimeType]] || CATEGORIES.other
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 后端存的是北京时间的 "YYYY-MM-DD HH:mm:ss"，直接切片显示，不做时区二次转换
export function formatNoteTime(value) {
  if (!value) return ''
  const [date, time = ''] = value.split(/[ T]/)
  // 与后端 beijingDate() 对齐，用东八区的「今天」判断，避免跨时区误标
  const todayStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  if (date === todayStr) return `今天 ${time.slice(0, 5)}`
  return `${date} ${time.slice(0, 5)}`.trim()
}
