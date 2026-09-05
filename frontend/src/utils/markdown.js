import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.use({ gfm: true, breaks: true })

// 笔记正文是用户自己写的，但渲染前一律过一遍 DOMPurify：
// 粘贴来的内容同样会走这条路径，不能假设它干净。
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank')
    // 不加 noopener 的话新页面能通过 window.opener 反向操纵本页
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function renderMarkdown(source) {
  if (!source) return ''
  return DOMPurify.sanitize(marked.parse(source), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'],
    FORBID_ATTR: ['style'],
  })
}

// 卡片摘要用：把 markdown 记号剥掉，只留可读文本。
// 卡片上直接渲染 HTML 既慢又会把排版撑乱，纯文本 + line-clamp 更稳。
export function markdownExcerpt(source, limit = 180) {
  if (!source) return ''
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*([-*_]\s*){3,}$/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}
