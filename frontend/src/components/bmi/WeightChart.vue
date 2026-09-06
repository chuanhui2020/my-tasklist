<template>
  <el-card class="bmi-card chart-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <div>
          <div class="card-title">身体指标趋势</div>
          <div class="card-subtitle">体重与身体成分的变化走势</div>
        </div>
        <div class="time-range-selector">
          <el-radio-group v-model="chartRange" size="small" @change="loadWeightHistory">
            <el-radio-button :value="7">1周</el-radio-button>
            <el-radio-button :value="30">1月</el-radio-button>
            <el-radio-button :value="90">3月</el-radio-button>
            <el-radio-button :value="180">6月</el-radio-button>
            <el-radio-button :value="365">1年</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </template>

    <template v-if="weightHistory.length">
      <div class="metric-picker">
        <el-checkbox-group v-model="selectedMetrics" size="small" @change="onMetricChange">
          <el-checkbox-button v-for="metric in METRICS" :key="metric.key" :value="metric.key">
            {{ metric.label }}
          </el-checkbox-button>
        </el-checkbox-group>
        <span v-if="unavailableHint" class="metric-hint">{{ unavailableHint }}</span>
      </div>
      <div ref="chartRef" class="weight-chart-container"></div>
    </template>
    <div v-else class="chart-empty">
      <el-empty description="暂无记录">
        <el-button type="primary" @click="$emit('record')">记录今日数据</el-button>
      </el-empty>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import api from '@/api'
import { deriveRecord } from '@/utils/bodyComposition'

const _emit = defineEmits(['record'])

// axis 0 = kg(左轴)，axis 1 = %(右轴)。体重与体脂率分居两轴，
// 默认这两条线一起看就能判断减重质量。
const METRICS = [
  { key: 'weight', label: '体重', unit: 'kg', axis: 0, color: '#06b6d4' },
  { key: 'body_fat', label: '体脂率', unit: '%', axis: 1, color: '#f59e0b' },
  { key: 'fat_mass', label: '体脂量', unit: 'kg', axis: 0, color: '#ef4444' },
  { key: 'lean_mass', label: '去脂体重', unit: 'kg', axis: 0, color: '#10b981' },
  { key: 'skeletal_muscle', label: '骨骼肌', unit: 'kg', axis: 0, color: '#8b5cf6' },
]

const selectedMetrics = ref(['weight', 'body_fat'])

let echarts = null
const loadEcharts = async () => {
  if (!echarts) {
    const [core, charts, components, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers')
    ])
    core.use([charts.LineChart, components.GridComponent, components.TooltipComponent, components.DataZoomComponent, components.MarkLineComponent, renderers.CanvasRenderer])
    echarts = core
  }
  return echarts
}

const chartRef = ref(null)
const chartRange = ref(90)
const weightHistory = ref([])
let chartInstance = null
let resizeHandler = null

const records = computed(() => weightHistory.value.map(deriveRecord))

// 某个指标在当前区间内至少有一条非空数据才算「有得画」
const availableKeys = computed(() => {
  const keys = new Set(['weight'])
  for (const record of records.value) {
    for (const metric of METRICS) {
      if (Number.isFinite(record[metric.key])) keys.add(metric.key)
    }
  }
  return keys
})

// 只提示「选中了但这段区间没数据」的指标。勾选状态不因切换区间被改写，
// 否则切到一周再切回来，体脂率就莫名其妙丢了。
const unavailableHint = computed(() => {
  const missing = METRICS.filter(m => selectedMetrics.value.includes(m.key) && !availableKeys.value.has(m.key))
  return missing.length ? `${missing.map(m => m.label).join('、')} 在该区间暂无数据` : ''
})

const onMetricChange = () => {
  if (!selectedMetrics.value.length) selectedMetrics.value = ['weight']
  renderChart()
}

const loadWeightHistory = async () => {
  try {
    const res = await api.getWeightHistory(chartRange.value)
    weightHistory.value = res?.data?.data || []
    await nextTick()
    await renderChart()
  } catch (e) {
    console.error('加载体重历史失败:', e)
  }
}

const renderChart = async () => {
  if (!chartRef.value || !records.value.length) return
  if (chartInstance) chartInstance.dispose()

  const ec = await loadEcharts()
  if (!chartRef.value) return
  chartInstance = ec.init(chartRef.value)

  const dates = records.value.map(r => r.date)
  const active = METRICS.filter(m => selectedMetrics.value.includes(m.key) && availableKeys.value.has(m.key))
  // 单指标时才铺面积和均值线，多条线叠面积会糊成一片
  const solo = active.length === 1
  const usesKg = active.some(m => m.axis === 0)
  const usesPct = active.some(m => m.axis === 1)
  // 只勾了体脂率时没有左轴，把 % 轴挪到左边，别在左侧留一片空白
  const pctOnRight = usesKg && usesPct

  const unitByLabel = new Map(active.map(m => [m.label, m.unit]))

  const yAxisBase = {
    type: 'value',
    nameTextStyle: { color: '#64748b' },
    axisLine: { show: false },
    axisLabel: { color: '#64748b' },
    min: val => Math.floor(val.min - 2),
    max: val => Math.ceil(val.max + 2)
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#f1f5f9', fontSize: 13 },
      formatter: params => {
        const lines = [`<span style="color:#a8b8cc">${params[0].axisValue}</span>`]
        for (const p of params) {
          if (p.value === null || p.value === undefined) continue
          lines.push(`${p.marker}${p.seriesName}: <strong>${p.value} ${unitByLabel.get(p.seriesName) || ''}</strong>`)
        }
        return lines.join('<br/>')
      }
    },
    grid: { left: 55, right: pctOnRight ? 55 : 30, top: 30, bottom: 60 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { show: false }
    },
    yAxis: [
      {
        ...yAxisBase,
        name: 'kg',
        show: usesKg,
        position: 'left',
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)' } }
      },
      {
        ...yAxisBase,
        name: '%',
        show: usesPct,
        position: pctOnRight ? 'right' : 'left',
        splitLine: pctOnRight ? { show: false } : { lineStyle: { color: 'rgba(148,163,184,0.08)' } }
      }
    ],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      {
        type: 'slider', height: 20, bottom: 10,
        borderColor: 'rgba(6,182,212,0.2)',
        fillerColor: 'rgba(6,182,212,0.1)',
        handleStyle: { color: '#06b6d4' },
        textStyle: { color: '#64748b' }
      }
    ],
    series: active.map(metric => ({
      name: metric.label,
      type: 'line',
      yAxisIndex: metric.axis,
      // 只有体重的历史记录会在成分曲线上留下空洞，连过去比断成几截可读
      connectNulls: true,
      data: records.value.map(r => (Number.isFinite(r[metric.key]) ? r[metric.key] : null)),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: metric.color, width: 2, shadowColor: `${metric.color}80`, shadowBlur: 10 },
      itemStyle: { color: metric.color, borderColor: '#0b1121', borderWidth: 2 },
      ...(solo ? {
        areaStyle: {
          color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${metric.color}40` },
            { offset: 1, color: `${metric.color}05` }
          ])
        },
        markLine: {
          silent: true,
          lineStyle: { color: 'rgba(16,185,129,0.4)', type: 'dashed' },
          data: [{ type: 'average', name: '平均' }],
          label: { color: '#64748b', fontSize: 11 }
        }
      } : {})
    }))
  }

  chartInstance.setOption(option)

  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  resizeHandler = () => chartInstance?.resize()
  window.addEventListener('resize', resizeHandler)
}

const reload = () => loadWeightHistory()

onMounted(() => loadWeightHistory())

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  chartInstance?.dispose()
})

defineExpose({ reload })
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

.time-range-selector { flex-shrink: 0; }

.metric-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.metric-hint {
  font-size: 12px;
  color: var(--accent-warning, #f59e0b);
}

.weight-chart-container {
  width: 100%;
  height: 400px;
}

.chart-empty {
  padding: 60px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.chart-card { margin-top: 24px; }

@media (max-width: 720px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
