<template>
  <el-card class="bmi-card analysis-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <div>
          <div class="card-title">AI 体重分析</div>
          <div class="card-subtitle">固定基于最近 90 天数据生成，不受图表时间范围切换影响</div>
        </div>
        <div class="analysis-actions">
          <span class="analysis-status-chip" :class="{ ready: hasEnoughData }">
            {{ analysisStatusText }}
          </span>
          <el-button size="small" type="primary" :loading="analyzing" :disabled="!hasEnoughData" @click="requestAnalysis">
            {{ analyzing ? '分析中...' : '🤖 生成分析' }}
          </el-button>
        </div>
      </div>
    </template>

    <div v-if="history.length" class="analysis-overview">
      <div v-for="item in overview" :key="item.label" class="analysis-metric">
        <span class="analysis-metric-label">{{ item.label }}</span>
        <span class="analysis-metric-value" :class="item.tone">{{ item.value }}</span>
      </div>
    </div>

    <div v-if="analyzing && !analysis" class="analysis-loading">
      <div class="analysis-skeleton analysis-skeleton-hero"></div>
      <div class="analysis-skeleton-grid">
        <div v-for="i in 4" :key="i" class="analysis-skeleton analysis-skeleton-card"></div>
      </div>
    </div>

    <div v-else-if="analysis" class="analysis-stage">
      <div v-if="!isFresh" class="analysis-update-banner">
        近 90 天体重数据有更新，当前分析已不是最新结果，建议重新生成。
      </div>
      <div class="analysis-hero">
        <div class="analysis-hero-top">
          <div class="analysis-hero-label">AI 洞察</div>
          <div class="analysis-hero-meta">{{ metaText }}</div>
        </div>
        <div class="analysis-hero-text">{{ lead }}</div>
        <div v-if="insightTags.length" class="analysis-insight-tags">
          <span v-for="tag in insightTags" :key="tag" class="analysis-insight-tag">{{ tag }}</span>
        </div>
      </div>
      <div v-if="blocks.length" class="analysis-grid">
        <article v-for="(block, index) in blocks" :key="`${index}-${block.title}`" class="analysis-panel">
          <div class="analysis-panel-title">{{ block.title }}</div>
          <p class="analysis-panel-text">{{ block.content }}</p>
        </article>
      </div>
    </div>

    <div v-else class="analysis-placeholder">
      <span class="analysis-placeholder-icon">{{ hasEnoughData ? '🧠' : '📉' }}</span>
      <div class="analysis-placeholder-title">{{ hasEnoughData ? '生成更有层次的体重洞察' : '先积累足够的体重记录' }}</div>
      <div class="analysis-placeholder-text">{{ placeholderText }}</div>
    </div>
  </el-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const props = defineProps({
  history: { type: Array, default: () => [] },
  bmiLevel: { type: Object, default: () => ({ label: '--' }) }
})

const analysis = ref('')
const analyzing = ref(false)
const generatedAt = ref('')
const snapshotKey = ref('')

const currentSnapshotKey = computed(() =>
  props.history.map(item => `${item.date}:${item.weight}`).join('|')
)

const hasEnoughData = computed(() => props.history.length >= 3)

const isFresh = computed(() =>
  !!analysis.value && snapshotKey.value === currentSnapshotKey.value
)

const analysisStatusText = computed(() => {
  if (!props.history.length) return '暂无记录'
  if (!hasEnoughData.value) return `还差 ${3 - props.history.length} 次`
  if (!analysis.value) return `近 90 天 ${props.history.length} 条`
  return isFresh.value ? '结果已同步' : '结果待更新'
})

const placeholderText = computed(() => {
  if (!props.history.length) return '先记录体重，累计至少 3 条近 3 个月内的数据后即可生成分析。'
  if (!hasEnoughData.value) return `当前已有 ${props.history.length} 条记录，还需要至少 ${3 - props.history.length} 条。`
  return '点击右上角按钮，AI 将结合近期趋势、BMI 和变化节奏生成结构化分析。'
})

const overview = computed(() => {
  if (!props.history.length) return []
  const records = props.history
  const first = records[0]
  const last = records[records.length - 1]
  const change = Number((last.weight - first.weight).toFixed(1))
  const spanDays = Math.max(0, Math.round((new Date(last.date) - new Date(first.date)) / 86400000))
  const average = Number((records.reduce((sum, item) => sum + Number(item.weight), 0) / records.length).toFixed(1))

  let trendText = '基本持平'
  let trendTone = 'flat'
  if (change >= 1) { trendText = `上升 ${change} kg`; trendTone = 'up' }
  else if (change <= -1) { trendText = `下降 ${Math.abs(change)} kg`; trendTone = 'down' }

  return [
    { label: '最近记录', value: `${last.weight} kg`, tone: 'neutral' },
    { label: '区间变化', value: trendText, tone: trendTone },
    { label: '记录跨度', value: spanDays > 0 ? `${spanDays} 天` : '当天', tone: 'neutral' },
    { label: '平均体重', value: `${average} kg`, tone: 'neutral' }
  ]
})

const metaText = computed(() => {
  if (!generatedAt.value) return '最近 90 天数据'
  return `${isFresh.value ? '已更新' : '待更新'} · ${generatedAt.value}`
})

const insightTags = computed(() => {
  if (!props.history.length) return []
  const tags = [`BMI ${props.bmiLevel.label}`, `记录 ${props.history.length} 次`]
  const trendItem = overview.value.find(item => item.label === '区间变化')
  if (trendItem) tags.push(trendItem.value)
  const spanItem = overview.value.find(item => item.label === '记录跨度')
  if (spanItem) tags.push(`跨度 ${spanItem.value}`)
  return tags
})

const sectionTitles = ['趋势总结', '速率评估', 'BMI 评估', '饮食与运动', '风险提醒']

const paragraphs = computed(() => {
  if (!analysis.value) return []
  const raw = analysis.value.trim()

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const payload = JSON.parse(raw)
      if (Array.isArray(payload)) {
        const items = payload.map(item => String(item).trim()).filter(Boolean)
        if (items.length) return items
      }
      if (payload && typeof payload === 'object') {
        const keys = ['summary', 'trend', 'pace', 'bmi', 'advice', 'risk', 'analysis']
        const items = keys.map(key => payload[key]).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
        if (items.length) return items
        const fallbackItems = Object.values(payload).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
        if (fallbackItems.length) return fallbackItems
      }
    } catch { /* continue with plain-text */ }
  }

  const cleaned = raw.replace(/\r/g, '\n').replace(/\n{2,}/g, '\n').split('\n')
    .map(item => item.trim()).filter(Boolean)
    .map(item => item.replace(/^\d+[.、)\s]+/, '').replace(/^[-•]\s*/, ''))

  if (cleaned.length <= 1 && cleaned[0]) {
    const chunks = cleaned[0].split(/(?<=[。！？])/).map(item => item.trim()).filter(Boolean)
    if (chunks.length > 1) {
      const grouped = []
      for (let i = 0; i < chunks.length; i += 2) grouped.push(chunks.slice(i, i + 2).join(''))
      return grouped
    }
  }
  return cleaned
})

const lead = computed(() => paragraphs.value[0] || 'AI 将结合体重趋势和 BMI 数据，生成更清晰的健康洞察。')

const inferTitle = (content, index) => {
  if (/趋势|波动|平稳|上升|下降/.test(content)) return '趋势总结'
  if (/速率|节奏|过快|过慢|合理/.test(content)) return '速率评估'
  if (/BMI|体重指数|超重|偏瘦|肥胖|正常/.test(content)) return 'BMI 评估'
  if (/饮食|运动|热量|步行|训练|作息/.test(content)) return '饮食与运动'
  if (/风险|注意|警惕|建议就医|异常/.test(content)) return '风险提醒'
  return sectionTitles[index] || `补充分析 ${index + 1}`
}

const blocks = computed(() => {
  const p = paragraphs.value.slice(1)
  if (!p.length) return []
  return p.map((content, index) => ({ title: inferTitle(content, index), content }))
})

const requestAnalysis = async () => {
  if (!hasEnoughData.value) {
    ElMessage.warning('至少需要 3 条体重记录才能生成分析')
    return
  }
  analyzing.value = true
  try {
    const res = await api.analyzeWeight()
    analysis.value = res?.data?.data?.analysis || ''
    snapshotKey.value = currentSnapshotKey.value
    generatedAt.value = new Date().toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  } catch (e) {
    const msg = e.response?.data?.error || '分析生成失败'
    ElMessage.error(msg)
  } finally {
    analyzing.value = false
  }
}
</script>

<style scoped>
.bmi-card {
  background: var(--bg-glass) !important;
  border: 1px solid var(--glass-border) !important;
  border-radius: 24px;
  box-shadow: var(--shadow-lg) !important;
  color: var(--text-primary);
  overflow: hidden;
  position: relative;
}

.bmi-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-highlight), transparent);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.card-title { font-size: 18px; font-weight: 600; color: var(--text-primary); }
.card-subtitle { margin-top: 6px; font-size: 12px; color: var(--text-muted); }

.analysis-card { margin-top: 24px; }

.analysis-actions { display: flex; align-items: center; gap: 10px; }

.analysis-status-chip {
  padding: 6px 12px; border-radius: 999px; font-size: 12px;
  color: var(--text-muted); background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
}

.analysis-status-chip.ready {
  color: var(--text-primary);
  border-color: rgba(16, 185, 129, 0.32);
  background: rgba(16, 185, 129, 0.12);
}

.analysis-overview {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px; margin-bottom: 18px;
}

.analysis-metric {
  padding: 14px 16px; border-radius: 16px;
  background: rgba(15, 23, 42, 0.58); border: 1px solid var(--glass-border);
  display: flex; flex-direction: column; gap: 8px;
}

.analysis-metric-label { font-size: 12px; color: var(--text-muted); }
.analysis-metric-value { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.analysis-metric-value.up { color: #f59e0b; }
.analysis-metric-value.down { color: #10b981; }
.analysis-metric-value.flat, .analysis-metric-value.neutral { color: var(--text-primary); }

.analysis-loading { display: flex; flex-direction: column; gap: 14px; }

.analysis-skeleton {
  border-radius: 18px;
  background: linear-gradient(90deg, rgba(15, 23, 42, 0.5), rgba(30, 41, 59, 0.82), rgba(15, 23, 42, 0.5));
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.analysis-skeleton-hero { height: 104px; }
.analysis-skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.analysis-skeleton-card { height: 132px; }

.analysis-stage { display: flex; flex-direction: column; gap: 16px; }

.analysis-update-banner {
  padding: 12px 14px; border-radius: 16px; font-size: 13px;
  color: #fbbf24; background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.28);
}

.analysis-hero {
  position: relative; overflow: hidden; padding: 20px 22px;
  border-radius: 20px; border: 1px solid rgba(6, 182, 212, 0.2);
  background: radial-gradient(circle at top right, rgba(6, 182, 212, 0.18), transparent 35%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.78), rgba(15, 23, 42, 0.58));
}

.analysis-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

.analysis-hero-label {
  font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: #67e8f9; margin-bottom: 10px;
}

.analysis-hero-meta { font-size: 12px; color: var(--text-muted); }
.analysis-hero-text { font-size: 16px; line-height: 1.8; color: var(--text-primary); }

.analysis-insight-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }

.analysis-insight-tag {
  padding: 6px 10px; border-radius: 999px; font-size: 12px;
  color: var(--text-primary); background: rgba(6, 182, 212, 0.12);
  border: 1px solid rgba(6, 182, 212, 0.22);
}

.analysis-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }

.analysis-panel {
  padding: 18px; border-radius: 18px;
  background: rgba(15, 23, 42, 0.58); border: 1px solid var(--glass-border);
  min-height: 132px;
}

.analysis-panel-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px; }
.analysis-panel-text { margin: 0; font-size: 14px; line-height: 1.8; color: var(--text-secondary); }

.analysis-placeholder { padding: 36px 0 20px; text-align: center; color: var(--text-muted); }

.analysis-placeholder-icon {
  display: inline-flex; width: 56px; height: 56px;
  align-items: center; justify-content: center; font-size: 28px;
  border-radius: 18px; background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border); margin-bottom: 14px;
}

.analysis-placeholder-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
.analysis-placeholder-text { font-size: 14px; color: var(--text-muted); max-width: 560px; margin: 0 auto; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 1024px) {
  .analysis-overview, .analysis-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .card-header, .analysis-actions { flex-direction: column; align-items: flex-start; }
  .analysis-hero-top { flex-direction: column; align-items: flex-start; }
  .analysis-overview, .analysis-grid, .analysis-skeleton-grid { grid-template-columns: 1fr; }
}
</style>
