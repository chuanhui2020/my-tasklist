<template>
  <el-card class="bmi-card delta-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <div>
          <div class="card-title">成分变化分解</div>
          <div class="card-subtitle">Δ体重 = Δ体脂量 + Δ去脂体重，基于最近 90 天内带体脂率的记录</div>
        </div>
        <div v-if="result" class="verdict-chip" :class="result.verdict.tone">
          {{ result.verdict.label }}
        </div>
      </div>
    </template>

    <div v-if="result" class="delta-stage">
      <p class="verdict-desc">{{ result.verdict.desc }}</p>

      <div class="delta-grid">
        <div v-for="item in deltaItems" :key="item.label" class="delta-item" :class="item.tone">
          <span class="delta-label">{{ item.label }}</span>
          <span class="delta-value">{{ item.delta }}</span>
          <span class="delta-detail">{{ item.detail }}</span>
        </div>
      </div>

      <div class="comp-bars">
        <div v-for="row in bars" :key="row.key" class="comp-bar-row">
          <span class="comp-bar-label">
            {{ row.label }}
            <em>{{ row.date }}</em>
          </span>
          <div class="comp-bar-track">
            <div class="comp-bar" :style="{ width: row.width }">
              <div class="comp-seg lean" :style="{ flexGrow: row.lean }">
                <span v-if="row.showText">{{ row.lean }}</span>
              </div>
              <div class="comp-seg fat" :style="{ flexGrow: row.fat }">
                <span v-if="row.showText">{{ row.fat }}</span>
              </div>
            </div>
          </div>
          <span class="comp-bar-value">{{ row.weight }} kg</span>
        </div>

        <div class="comp-legend">
          <span><i class="legend-dot lean"></i>去脂体重 (肌肉/水分/骨量)</span>
          <span><i class="legend-dot fat"></i>体脂量</span>
          <span class="comp-span">跨度 {{ result.spanDays }} 天 · {{ result.count }} 次记录</span>
        </div>
      </div>
    </div>

    <div v-else class="delta-placeholder">
      <span class="delta-placeholder-icon">🧬</span>
      <div class="delta-placeholder-title">{{ placeholderTitle }}</div>
      <div class="delta-placeholder-text">{{ placeholderText }}</div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { assessRecomposition, fatMass } from '@/utils/bodyComposition'

const props = defineProps({
  history: { type: Array, default: () => [] },
})

const result = computed(() => assessRecomposition(props.history))

const usableCount = computed(() =>
  props.history.filter(r => fatMass(r.weight, r.body_fat) !== null).length
)

const placeholderTitle = computed(() =>
  usableCount.value === 0 ? '记录体脂率，看清体重变化的构成' : '再记录一次体脂数据即可解锁'
)

const placeholderText = computed(() => {
  if (usableCount.value === 0) {
    return '同样是掉 2kg，掉脂肪和掉肌肉是完全相反的两件事。录入体脂率后，这里会把体重变化拆成脂肪和去脂体重两部分。'
  }
  return `近 90 天有 ${usableCount.value} 条带体脂率的记录，还需要至少 1 条才能计算变化。`
})

const formatDelta = (value, unit) => `${value > 0 ? '+' : ''}${value} ${unit}`

// 脂肪下降是好事，去脂体重上升是好事；体重本身的增减不作褒贬
const toneOf = (value, threshold, goodWhenUp) => {
  if (Math.abs(value) < threshold) return 'flat'
  return (value > 0) === goodWhenUp ? 'good' : 'warn'
}

const deltaItems = computed(() => {
  const r = result.value
  if (!r) return []
  return [
    {
      label: '体重',
      delta: formatDelta(r.dWeight, 'kg'),
      detail: `${r.start.weight} → ${r.end.weight} kg`,
      tone: 'neutral',
    },
    {
      label: '体脂量',
      delta: formatDelta(r.dFat, 'kg'),
      detail: `${r.start.fat} → ${r.end.fat} kg (${r.start.bodyFat}% → ${r.end.bodyFat}%)`,
      tone: toneOf(r.dFat, 0.5, false),
    },
    {
      label: '去脂体重',
      delta: formatDelta(r.dLean, 'kg'),
      detail: `${r.start.lean} → ${r.end.lean} kg`,
      tone: toneOf(r.dLean, 0.3, true),
    },
  ]
})

// 两条堆叠条按体重等比缩放，直观看出总量和构成同时怎么变
const bars = computed(() => {
  const r = result.value
  if (!r) return []
  const maxWeight = Math.max(r.start.weight, r.end.weight) || 1
  return [
    { key: 'start', label: '起始', ...r.start },
    { key: 'end', label: '最新', ...r.end },
  ].map(row => ({
    key: row.key,
    label: row.label,
    date: row.date,
    weight: row.weight,
    lean: row.lean,
    fat: row.fat,
    width: `${(row.weight / maxWeight) * 100}%`,
    // 段太窄时数字会被挤成一团，直接不显示
    showText: row.fat / row.weight > 0.12,
  }))
})
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

.delta-card { margin-top: 24px; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.verdict-chip {
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.6);
  color: var(--text-primary);
}

.verdict-chip.best {
  border-color: rgba(16, 185, 129, 0.5);
  color: #10b981;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
}

.verdict-chip.good {
  border-color: rgba(16, 185, 129, 0.4);
  color: #10b981;
}

.verdict-chip.neutral {
  border-color: rgba(96, 165, 250, 0.4);
  color: #60a5fa;
}

.verdict-chip.warn {
  border-color: rgba(245, 158, 11, 0.45);
  color: #f59e0b;
}

.verdict-chip.bad {
  border-color: rgba(239, 68, 68, 0.45);
  color: #ef4444;
}

.verdict-chip.flat {
  border-color: rgba(148, 163, 184, 0.3);
  color: var(--text-secondary);
}

.delta-stage {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.verdict-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.delta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.delta-item {
  padding: 16px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.delta-label {
  font-size: 12px;
  color: var(--text-muted);
}

.delta-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.delta-item.good .delta-value { color: #10b981; }
.delta-item.warn .delta-value { color: #f59e0b; }
.delta-item.flat .delta-value { color: var(--text-secondary); }

.delta-detail {
  font-size: 12px;
  color: var(--text-muted);
}

.comp-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--glass-border);
}

.comp-bar-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr) 72px;
  align-items: center;
  gap: 12px;
}

.comp-bar-label {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comp-bar-label em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-muted);
}

.comp-bar-track {
  width: 100%;
  height: 26px;
}

.comp-bar {
  display: flex;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  transition: width 0.4s ease;
}

.comp-seg {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.85);
  min-width: 0;
}

.comp-seg.lean { background: rgba(16, 185, 129, 0.75); }
.comp-seg.fat { background: rgba(245, 158, 11, 0.75); }

.comp-bar-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
}

.comp-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.comp-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.comp-span { margin-left: auto; }

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-dot.lean { background: rgba(16, 185, 129, 0.75); }
.legend-dot.fat { background: rgba(245, 158, 11, 0.75); }

.delta-placeholder {
  padding: 40px 20px;
  text-align: center;
}

.delta-placeholder-icon {
  font-size: 34px;
}

.delta-placeholder-title {
  margin-top: 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.delta-placeholder-text {
  margin: 8px auto 0;
  max-width: 520px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-muted);
}

@media (max-width: 720px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .delta-grid {
    grid-template-columns: 1fr;
  }

  .comp-bar-row {
    grid-template-columns: 76px minmax(0, 1fr) 62px;
    gap: 8px;
  }

  .comp-span {
    margin-left: 0;
  }
}
</style>
