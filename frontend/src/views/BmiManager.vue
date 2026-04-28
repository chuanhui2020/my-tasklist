<template>
  <div class="bmi-wrapper">
    <div class="background-patterns">
      <div class="pattern pattern-1"></div>
      <div class="pattern pattern-2"></div>
      <div class="pattern pattern-3"></div>
    </div>

    <div class="bmi-header">
      <div class="title-block">
        <div class="title-icon"><el-icon><DataLine /></el-icon></div>
        <div>
          <h2 class="bmi-title">BMI管理</h2>
          <p class="bmi-subtitle">输入基础信息，实时测算体重指数与健康区间</p>
        </div>
      </div>
      <div class="bmi-status" :class="bmiLevel.key">
        <span class="status-label">{{ bmiLevel.label }}</span>
        <span class="status-value">{{ isReady ? bmiValue : '--' }}</span>
      </div>
    </div>

    <div class="bmi-grid">
      <el-card class="bmi-card input-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <div>
              <div class="card-title">基础数据</div>
              <div class="card-subtitle">支持公制输入，自动更新计算结果</div>
            </div>
            <div class="unit-chip">cm / kg</div>
          </div>
        </template>

        <el-form label-position="top" class="bmi-form">
          <el-form-item label="性别" class="form-item-full">
            <el-radio-group v-model="form.gender" size="small">
              <el-radio-button value="male">男</el-radio-button>
              <el-radio-button value="female">女</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="年龄">
            <div class="input-with-unit">
              <el-input-number v-model="form.age" :min="12" :max="99" controls-position="right" />
              <span class="unit-label">岁</span>
            </div>
          </el-form-item>

          <el-form-item label="身高">
            <div class="input-with-unit">
              <el-input-number v-model="form.height" :min="120" :max="220" controls-position="right" />
              <span class="unit-label">cm</span>
            </div>
          </el-form-item>

          <el-form-item label="体重" class="form-item-full">
            <div class="input-with-unit">
              <el-input-number v-model="form.weight" :min="30" :max="200" :precision="1" :step="0.5"
                controls-position="right" />
              <span class="unit-label">kg</span>
            </div>
          </el-form-item>
        </el-form>

        <div class="form-actions">
          <div class="form-actions-left">
            <el-button type="primary" :disabled="todayWeightRecorded" @click="showWeightDialog">
              {{ todayWeightRecorded ? '今日已记录' : '📝 今日体重' }}
            </el-button>
            <el-button @click="showBackfillDialog">📅 补录体重</el-button>
          </div>
          <span class="form-note">BMI = 体重(kg) ÷ 身高(m)²</span>
        </div>
      </el-card>

      <el-card class="bmi-card result-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <div>
              <div class="card-title">测算结果</div>
              <div class="card-subtitle">结合体重范围与健康建议</div>
            </div>
            <div class="status-chip" :class="bmiLevel.key">{{ bmiLevel.label }}</div>
          </div>
        </template>

        <div class="result-content">
          <div class="score-section">
            <div class="score-value">{{ isReady ? bmiValue : '--' }}</div>
            <div class="score-label">当前 BMI</div>
            <div class="score-range">健康范围 {{ normalMin }} - {{ normalMax }}</div>
          </div>

          <div class="scale-section">
            <div class="scale-bar">
              <div class="scale-pointer" :style="{ left: pointerLeft }">
                <span class="pointer-dot"></span>
              </div>
            </div>
            <div class="scale-labels">
              <span>偏瘦</span>
              <span>正常</span>
              <span>超重</span>
              <span>肥胖</span>
            </div>
            <div class="scale-marks">
              <span v-for="mark in scaleMarks" :key="mark.value" class="scale-mark"
                :style="{ left: mark.left }">{{ mark.label }}</span>
            </div>
          </div>

          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">健康体重区间</span>
              <span class="metric-value">{{ isReady ? normalRangeText : '--' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">体重调整建议</span>
              <span class="metric-value">{{ isReady ? weightDeltaText : '--' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">当前体重</span>
              <span class="metric-value">{{ isReady ? `${form.weight} kg` : '--' }}</span>
            </div>
          </div>

          <div class="advice-section">
            <div class="advice-title">
              <span>健康建议</span>
              <span v-if="isGeneratingAdvice" class="advice-loading">AI 生成中...</span>
              <span v-else-if="adviceError" class="advice-error">生成失败，已使用本地建议</span>
            </div>
            <div class="advice-tags">
              <span v-for="(item, index) in adviceList" :key="index" class="advice-chip">{{ item }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <el-card class="bmi-card guide-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">BMI 分级参考</div>
            <div class="card-subtitle">成人 BMI 参考区间（18~65 岁）</div>
          </div>
        </div>
      </template>

      <div class="guide-grid">
        <div v-for="level in bmiLevels" :key="level.key" class="guide-item" :class="level.key">
          <div class="guide-left">
            <span class="level-dot"></span>
            <div>
              <div class="level-name">{{ level.label }}</div>
              <div class="level-range">{{ level.rangeText }}</div>
            </div>
          </div>
          <div class="level-desc">{{ level.desc }}</div>
        </div>
      </div>
    </el-card>

    <WeightChart ref="weightChartRef" @record="showWeightDialog" />

    <WeightAnalysis :history="analysisHistory" :bmi-level="bmiLevel" />

    <el-dialog v-model="weightDialogVisible" title="记录今日体重" width="420px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px">
        每日体重仅可记录一次，记录后无法修改，请确认数据准确。
      </el-alert>
      <div class="weight-confirm-value">
        当前体重: <strong>{{ form.weight }} kg</strong>
      </div>
      <template #footer>
        <el-button @click="weightDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="recordingWeight" @click="confirmRecordWeight">
          确认记录
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="backfillDialogVisible" title="补录体重" width="420px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px">
        每日体重仅可记录一次，记录后无法修改，请确认数据准确。
      </el-alert>
      <el-form label-position="top">
        <el-form-item label="日期">
          <el-date-picker
            v-model="backfillDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :disabled-date="disableBackfillDate"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="体重 (kg)">
          <el-input-number v-model="backfillWeight" :min="30" :max="200" :precision="1" :step="0.5" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="backfillDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="recordingBackfill" @click="confirmBackfillWeight">
          确认补录
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { DataLine } from '@element-plus/icons-vue'
import api from '@/api'
import WeightChart from '@/components/bmi/WeightChart.vue'
import WeightAnalysis from '@/components/bmi/WeightAnalysis.vue'

const weightChartRef = ref(null)

const FORM_DEFAULTS = {
  gender: 'male',
  age: 28,
  height: 170,
  weight: 65
}

const form = reactive({ ...FORM_DEFAULTS })
let profileLoaded = false
let saveTimer = null

const loadProfile = async () => {
  try {
    const res = await api.getBmiProfile()
    const data = res?.data?.data
    if (data) {
      Object.assign(form, {
        gender: data.gender || FORM_DEFAULTS.gender,
        age: data.age || FORM_DEFAULTS.age,
        height: data.height || FORM_DEFAULTS.height,
        weight: data.weight || FORM_DEFAULTS.weight
      })
    }
  } catch (e) {
    console.error('加载 BMI 档案失败:', e)
  } finally {
    profileLoaded = true
  }
}

const saveProfile = () => {
  if (!profileLoaded) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await api.saveBmiProfile({
        gender: form.gender,
        age: form.age,
        height: form.height,
        weight: form.weight
      })
    } catch (e) {
      console.error('保存 BMI 档案失败:', e)
    }
  }, 400)
}

onMounted(async () => {
  await loadProfile()
  checkTodayWeight()
  loadAnalysisHistory()
})

const normalMin = 18.5
const normalMax = 23.9
const overMax = 27.9
const scaleMin = 14
const scaleMax = 36

const bmiLevels = [
  {
    key: 'under',
    label: '偏瘦',
    rangeText: `< ${normalMin}`,
    desc: '体重偏低，建议逐步提升营养密度与力量训练。'
  },
  {
    key: 'normal',
    label: '正常',
    rangeText: `${normalMin} - ${normalMax}`,
    desc: '保持良好体重区间，继续维持规律运动与饮食。'
  },
  {
    key: 'over',
    label: '超重',
    rangeText: `24 - ${overMax}`,
    desc: '适度控制能量摄入，加强有氧活动与日常步行。'
  },
  {
    key: 'obese',
    label: '肥胖',
    rangeText: `>= 28`,
    desc: '建议建立长期管理计划，循序渐进调整饮食与运动。'
  }
]

const adviceMap = {
  under: ['提高优质蛋白摄入', '每周 2-3 次力量训练', '规律作息保持恢复'],
  normal: ['保持均衡饮食', '每周 150 分钟运动', '定期记录体重变化'],
  over: ['减少高糖高油食物', '增加日常步行', '每周 2-3 次有氧'],
  obese: ['控制总热量摄入', '循序渐进提高活动量', '必要时咨询专业意见']
}

const adviceList = ref([])
const isGeneratingAdvice = ref(false)
const adviceError = ref(false)
let adviceTimer = null
let lastPayloadKey = ''
let activeRequestId = 0

const isReady = computed(() => form.height > 0 && form.weight > 0)

const bmiValue = computed(() => {
  if (!isReady.value) return 0
  const heightMeter = form.height / 100
  if (!heightMeter) return 0
  const bmi = form.weight / (heightMeter * heightMeter)
  return Number.isFinite(bmi) ? Number(bmi.toFixed(1)) : 0
})

const pendingLevel = {
  key: 'pending',
  label: '待测算',
  desc: '补全数据后自动计算'
}

const bmiLevel = computed(() => {
  if (!isReady.value) return pendingLevel
  const bmi = bmiValue.value
  if (bmi < normalMin) return bmiLevels[0]
  if (bmi <= normalMax) return bmiLevels[1]
  if (bmi <= overMax) return bmiLevels[2]
  return bmiLevels[3]
})

const normalRange = computed(() => {
  if (!isReady.value) return { min: 0, max: 0 }
  const heightMeter = form.height / 100
  const min = normalMin * heightMeter * heightMeter
  const max = normalMax * heightMeter * heightMeter
  return {
    min: Number(min.toFixed(1)),
    max: Number(max.toFixed(1))
  }
})

const normalRangeText = computed(() => `${normalRange.value.min} - ${normalRange.value.max} kg`)

const weightDelta = computed(() => {
  if (!isReady.value) return 0
  if (form.weight < normalRange.value.min) {
    return Number((normalRange.value.min - form.weight).toFixed(1))
  }
  if (form.weight > normalRange.value.max) {
    return Number((form.weight - normalRange.value.max).toFixed(1))
  }
  return 0
})

const weightDeltaText = computed(() => {
  if (!isReady.value) return '--'
  if (weightDelta.value === 0) return '处于健康区间'
  if (form.weight < normalRange.value.min) return `建议增加 ${weightDelta.value} kg`
  return `建议减少 ${weightDelta.value} kg`
})

const pointerLeft = computed(() => {
  if (!isReady.value) return '0%'
  const clamped = Math.min(scaleMax, Math.max(scaleMin, bmiValue.value))
  const percent = ((clamped - scaleMin) / (scaleMax - scaleMin)) * 100
  return `${percent}%`
})

const scaleMarks = computed(() => {
  const marks = [18.5, 24, 28]
  return marks.map((value) => {
    const clamped = Math.min(scaleMax, Math.max(scaleMin, value))
    const percent = ((clamped - scaleMin) / (scaleMax - scaleMin)) * 100
    return {
      value,
      label: value,
      left: `${percent}%`
    }
  })
})

const fallbackAdviceList = computed(() => adviceMap[bmiLevel.value.key] || [])

const bmiPayload = computed(() => ({
  age: form.age,
  height: form.height,
  weight: form.weight,
  bmi: bmiValue.value
}))

const scheduleAdviceRequest = () => {
  if (!isReady.value) {
    adviceList.value = []
    return
  }

  const payloadKey = `${bmiPayload.value.age}-${bmiPayload.value.height}-${bmiPayload.value.weight}-${bmiPayload.value.bmi}`
  if (payloadKey === lastPayloadKey) return

  lastPayloadKey = payloadKey
  adviceList.value = fallbackAdviceList.value
  adviceError.value = false

  if (adviceTimer) {
    clearTimeout(adviceTimer)
  }

  adviceTimer = setTimeout(() => {
    requestAdvice()
  }, 600)
}

const requestAdvice = async () => {
  const requestId = ++activeRequestId
  isGeneratingAdvice.value = true
  adviceError.value = false

  try {
    const response = await api.generateBmiAdvice(bmiPayload.value)
    if (requestId !== activeRequestId) return

    const advice = response?.data?.data?.advice
    if (Array.isArray(advice) && advice.length) {
      adviceList.value = advice.slice(0, 3)
    }
  } catch (error) {
    if (requestId !== activeRequestId) return
    adviceError.value = true
    console.error('获取 BMI 建议失败:', error)
  } finally {
    if (requestId === activeRequestId) {
      isGeneratingAdvice.value = false
    }
  }
}

watch(bmiPayload, scheduleAdviceRequest, { immediate: true, deep: true })

watch(() => ({ gender: form.gender, age: form.age, height: form.height, weight: form.weight }), saveProfile, { deep: true })

// Weight tracking state
const todayWeightRecorded = ref(false)
const weightDialogVisible = ref(false)
const recordingWeight = ref(false)
const backfillDialogVisible = ref(false)
const backfillDate = ref('')
const backfillWeight = ref(65)
const recordingBackfill = ref(false)
const analysisHistory = ref([])

const checkTodayWeight = async () => {
  try {
    const res = await api.getTodayWeight()
    todayWeightRecorded.value = res?.data?.recorded === true
  } catch (e) {
    console.error('检查今日体重失败:', e)
  }
}

const showWeightDialog = () => {
  weightDialogVisible.value = true
}

const confirmRecordWeight = async () => {
  recordingWeight.value = true
  try {
    await api.recordWeight({ weight: form.weight })
    todayWeightRecorded.value = true
    weightDialogVisible.value = false
    ElMessage.success('今日体重已记录')
    weightChartRef.value?.reload()
    loadAnalysisHistory()
  } catch (e) {
    if (e.response?.status === 409) {
      todayWeightRecorded.value = true
      weightDialogVisible.value = false
    }
  } finally {
    recordingWeight.value = false
  }
}

const showBackfillDialog = () => {
  backfillDate.value = ''
  backfillWeight.value = form.weight
  backfillDialogVisible.value = true
}

const disableBackfillDate = (d) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const earliest = new Date(today)
  earliest.setDate(earliest.getDate() - 90)
  return d > today || d < earliest
}

const confirmBackfillWeight = async () => {
  if (!backfillDate.value) {
    ElMessage.warning('请选择日期')
    return
  }
  recordingBackfill.value = true
  try {
    await api.recordWeight({ weight: backfillWeight.value, date: backfillDate.value })
    backfillDialogVisible.value = false
    ElMessage.success(`${backfillDate.value} 体重已补录`)
    weightChartRef.value?.reload()
    loadAnalysisHistory()
  } catch (e) {
    // 409 already handled by global interceptor
  } finally {
    recordingBackfill.value = false
  }
}

const loadAnalysisHistory = async () => {
  try {
    const res = await api.getWeightHistory(90)
    analysisHistory.value = res?.data?.data || []
  } catch (e) {
    console.error('加载分析体重历史失败:', e)
  }
}
</script>

<style scoped>
.bmi-wrapper {
  max-width: 1280px;
  margin: 0 auto;
  padding: 36px 24px 60px;
  position: relative;
}

.background-patterns {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.pattern {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.25;
  animation: float 10s ease-in-out infinite;
}

.pattern-1 {
  top: 15%;
  left: 10%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(6, 182, 212, 0.6), transparent 70%);
}

.pattern-2 {
  bottom: 10%;
  right: 12%;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.6), transparent 70%);
  animation-delay: 1.2s;
}

.pattern-3 {
  top: 55%;
  right: 35%;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.5), transparent 70%);
  animation-delay: 2s;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(20px, -20px);
  }
}

.bmi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 24px;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title-icon {
  font-size: 42px;
  color: var(--primary-color);
  filter: drop-shadow(0 0 10px rgba(6, 182, 212, 0.4));
}

.bmi-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.bmi-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.bmi-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  padding: 12px 18px;
  border-radius: 16px;
  border: 1px solid var(--glass-border);
  background: rgba(15, 23, 42, 0.6);
}

.status-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.status-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
}

.bmi-status.normal,
.status-chip.normal {
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
}

.bmi-status.under,
.status-chip.under {
  border-color: rgba(96, 165, 250, 0.4);
  box-shadow: 0 0 20px rgba(96, 165, 250, 0.15);
}

.bmi-status.over,
.status-chip.over {
  border-color: rgba(245, 158, 11, 0.4);
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
}

.bmi-status.obese,
.status-chip.obese {
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
}

.bmi-status.pending,
.status-chip.pending {
  border-color: rgba(148, 163, 184, 0.3);
}

.bmi-grid {
  display: grid;
  grid-template-columns: minmax(320px, 360px) minmax(0, 1fr);
  gap: 24px;
}

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
  top: 0;
  left: 0;
  right: 0;
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

.unit-chip {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(6, 182, 212, 0.12);
  color: var(--text-primary);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.bmi-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.form-item-full {
  grid-column: span 1;
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 10px;
}

.unit-label {
  font-size: 12px;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.form-actions-left {
  display: flex;
  gap: 8px;
}

.form-note {
  font-size: 12px;
  color: var(--text-muted);
}

.status-chip {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-primary);
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.score-section {
  padding: 18px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid var(--glass-border);
  text-align: center;
}

.score-value {
  font-size: 42px;
  font-weight: 700;
  color: var(--text-primary);
}

.score-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.score-range {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.scale-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scale-bar {
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg,
      rgba(96, 165, 250, 0.9) 0%,
      rgba(96, 165, 250, 0.9) 20%,
      rgba(16, 185, 129, 0.9) 20%,
      rgba(16, 185, 129, 0.9) 45%,
      rgba(245, 158, 11, 0.9) 45%,
      rgba(245, 158, 11, 0.9) 63%,
      rgba(239, 68, 68, 0.9) 63%,
      rgba(239, 68, 68, 0.9) 100%);
  box-shadow: var(--shadow-sm);
}

.scale-pointer {
  position: absolute;
  top: -6px;
  transform: translateX(-50%);
}

.pointer-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
  border: 3px solid var(--primary-color);
  display: block;
}

.scale-labels {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  font-size: 12px;
  color: var(--text-secondary);
}

.scale-marks {
  position: relative;
  height: 16px;
}

.scale-mark {
  position: absolute;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--text-muted);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-item {
  padding: 14px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-label {
  font-size: 12px;
  color: var(--text-muted);
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.advice-section {
  padding: 16px;
  border-radius: 16px;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.advice-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.advice-loading {
  font-size: 12px;
  color: var(--text-muted);
}

.advice-error {
  font-size: 12px;
  color: var(--accent-warning);
}

.advice-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.advice-chip {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-primary);
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.guide-card {
  margin-top: 24px;
}

.weight-confirm-value {
  text-align: center;
  font-size: 18px;
  padding: 20px 0;
  color: var(--text-primary);
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.guide-item {
  padding: 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.guide-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.level-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-secondary);
}

.guide-item.under .level-dot {
  background: #60a5fa;
}

.guide-item.normal .level-dot {
  background: #10b981;
}

.guide-item.over .level-dot {
  background: #f59e0b;
}

.guide-item.obese .level-dot {
  background: #ef4444;
}

.level-name {
  font-size: 14px;
  font-weight: 600;
}

.level-range {
  font-size: 12px;
  color: var(--text-muted);
}

.level-desc {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 300px;
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .bmi-grid {
    grid-template-columns: 1fr;
  }

  .bmi-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .bmi-status {
    align-items: flex-start;
    width: 100%;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .bmi-form {
    grid-template-columns: 1fr;
  }

  .form-item-full {
    grid-column: span 1;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .guide-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .guide-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .level-desc {
    text-align: left;
    max-width: 100%;
  }
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
