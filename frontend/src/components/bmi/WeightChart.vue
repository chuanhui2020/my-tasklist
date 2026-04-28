<template>
  <el-card class="bmi-card chart-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <div>
          <div class="card-title">体重趋势</div>
          <div class="card-subtitle">追踪体重变化，掌握健康走势</div>
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
    <div v-if="weightHistory.length" ref="chartRef" class="weight-chart-container"></div>
    <div v-else class="chart-empty">
      <el-empty description="暂无体重记录">
        <el-button type="primary" @click="$emit('record')">记录今日体重</el-button>
      </el-empty>
    </div>
  </el-card>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import api from '@/api'

const emit = defineEmits(['record'])

let echarts = null
const loadEcharts = async () => {
  if (!echarts) echarts = await import('echarts')
  return echarts
}

const chartRef = ref(null)
const chartRange = ref(90)
const weightHistory = ref([])
let chartInstance = null
let resizeHandler = null

const loadWeightHistory = async () => {
  try {
    const res = await api.getWeightHistory(chartRange.value)
    weightHistory.value = res?.data?.data || []
    await nextTick()
    renderChart()
  } catch (e) {
    console.error('加载体重历史失败:', e)
  }
}

const renderChart = async () => {
  if (!chartRef.value || !weightHistory.value.length) return
  if (chartInstance) chartInstance.dispose()

  const ec = await loadEcharts()
  chartInstance = ec.init(chartRef.value)

  const dates = weightHistory.value.map(r => r.date)
  const weights = weightHistory.value.map(r => r.weight)

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#f1f5f9', fontSize: 13 },
      formatter: params => {
        const p = params[0]
        return `<span style="color:#a8b8cc">${p.axisValue}</span><br/>体重: <strong style="color:#06b6d4">${p.value} kg</strong>`
      }
    },
    grid: { left: 55, right: 30, top: 30, bottom: 60 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: 'kg',
      nameTextStyle: { color: '#64748b' },
      axisLine: { show: false },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)' } },
      min: val => Math.floor(val.min - 2),
      max: val => Math.ceil(val.max + 2)
    },
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
    series: [{
      type: 'line', data: weights, smooth: true,
      symbol: 'circle', symbolSize: 6,
      lineStyle: { color: '#06b6d4', width: 2, shadowColor: 'rgba(6,182,212,0.5)', shadowBlur: 10 },
      itemStyle: { color: '#06b6d4', borderColor: '#0b1121', borderWidth: 2 },
      areaStyle: {
        color: new ec.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(6,182,212,0.25)' },
          { offset: 1, color: 'rgba(6,182,212,0.02)' }
        ])
      },
      markLine: {
        silent: true,
        lineStyle: { color: 'rgba(16,185,129,0.4)', type: 'dashed' },
        data: [{ type: 'average', name: '平均' }],
        label: { color: '#64748b', fontSize: 11 }
      }
    }]
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
