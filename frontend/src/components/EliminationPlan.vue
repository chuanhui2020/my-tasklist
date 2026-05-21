<template>
  <el-dialog v-model="visible" title="消除策略模拟" width="700px" class="glass-dialog" destroy-on-close>
    <div class="elim-content">
      <div class="elim-inputs">
        <el-form label-position="top" :inline="true">
          <el-form-item label="每月额外可还（元）">
            <el-input-number v-model="form.extra_monthly" :min="100" :step="500" :controls="false" style="width: 160px" @change="debouncedFetch" />
          </el-form-item>
          <el-form-item label="策略">
            <el-radio-group v-model="form.strategy" @change="debouncedFetch">
              <el-radio value="avalanche">雪崩法（先高利率）</el-radio>
              <el-radio value="snowball">雪球法（先小余额）</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>

      <div v-if="loading" class="elim-loading">计算中...</div>

      <template v-if="result && !loading">
        <div class="elim-summary">
          <span class="summary-highlight">{{ result.total_months_to_free }}个月</span>后无债一身轻
          · 比原计划快 <span class="summary-saved">{{ result.baseline_months_to_free - result.total_months_to_free }}个月</span>
          · 节省利息 <span class="summary-saved">¥{{ formatMoney(result.total_interest_saved) }}</span>
        </div>

        <div class="elim-table">
          <table>
            <thead>
              <tr>
                <th>贷款名称</th>
                <th>原计划(月)</th>
                <th>加速后(月)</th>
                <th>节省(月)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="loan in result.loans" :key="loan.id">
                <td>{{ loan.name }}</td>
                <td>{{ loan.baseline_cleared_at_month }}</td>
                <td class="col-cyan">{{ loan.cleared_at_month }}</td>
                <td class="col-green">-{{ loan.baseline_cleared_at_month - loan.cleared_at_month }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="elim-timeline">
          <div class="timeline-title">时间线</div>
          <div class="timeline-chart">
            <div v-for="loan in result.loans" :key="loan.id" class="timeline-row">
              <div class="timeline-label">{{ loan.name }}</div>
              <div class="timeline-bar-wrap">
                <div class="timeline-bar" :class="getLoanType(loan.id)" :style="{ width: (loan.cleared_at_month / result.total_months_to_free * 100) + '%' }">
                  <span class="bar-text">{{ loan.cleared_at_month }}月</span>
                </div>
                <div class="timeline-bar baseline" :style="{ width: (loan.baseline_cleared_at_month / result.baseline_months_to_free * 100) + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="timeline-legend">
            <span class="legend-item"><span class="legend-dot cyan"></span>加速方案</span>
            <span class="legend-item"><span class="legend-dot gray"></span>原计划</span>
          </div>
        </div>
      </template>

      <div v-if="error" class="elim-error">{{ error }}</div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import api from '@/api'
import { formatMoney } from '@/utils/format'

const props = defineProps({
  modelValue: Boolean,
  loans: Array,
})
const emit = defineEmits(['update:modelValue'])

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const result = ref(null)
const form = ref({ extra_monthly: 2000, strategy: 'avalanche' })
let debounceTimer = null

onUnmounted(() => {
  clearTimeout(debounceTimer)
})

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    result.value = null
    error.value = ''
    debouncedFetch()
  }
})

watch(visible, (val) => {
  if (!val) emit('update:modelValue', false)
})

function debouncedFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchPlan, 500)
}

async function fetchPlan() {
  if (!form.value.extra_monthly || form.value.extra_monthly <= 0) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.getEliminationPlan(form.value)
    result.value = data
  } catch (e) {
    error.value = e?.response?.data?.error || '计算失败'
    result.value = null
  } finally {
    loading.value = false
  }
}

function getLoanType(id) {
  const loan = props.loans?.find(l => l.id === id)
  return loan?.loan_type === 'mortgage' ? 'mortgage' : 'bank_loan'
}
</script>

<style scoped>
.elim-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.elim-inputs :deep(.el-form--inline .el-form-item) {
  margin-right: 24px;
  margin-bottom: 0;
}

.elim-loading {
  text-align: center;
  color: var(--text-muted, #64748b);
  padding: 20px;
}

.elim-summary {
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.2);
  font-size: 14px;
  color: var(--text-secondary, #cbd5e1);
  text-align: center;
}

.summary-highlight {
  font-size: 20px;
  font-weight: 700;
  color: #06b6d4;
}

.summary-saved {
  font-weight: 600;
  color: #10b981;
}

.elim-table {
  overflow-x: auto;
}

.elim-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.elim-table th {
  text-align: left;
  padding: 8px 12px;
  color: var(--text-muted, #64748b);
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  font-weight: 500;
}

.elim-table td {
  padding: 8px 12px;
  color: var(--text-primary, #f1f5f9);
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.04));
}

.col-cyan { color: #06b6d4; font-weight: 600; }
.col-green { color: #10b981; font-weight: 600; }

.elim-timeline {
  padding: 12px 0;
}

.timeline-title {
  font-size: 13px;
  color: var(--text-muted, #64748b);
  margin-bottom: 12px;
}

.timeline-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timeline-label {
  width: 80px;
  font-size: 12px;
  color: var(--text-secondary, #cbd5e1);
  text-align: right;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-bar-wrap {
  flex: 1;
  position: relative;
  height: 28px;
}

.timeline-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 14px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  transition: width 0.6s ease;
}

.timeline-bar.mortgage {
  background: linear-gradient(90deg, rgba(6, 182, 212, 0.3), rgba(6, 182, 212, 0.7));
}

.timeline-bar.bank_loan {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.7));
}

.timeline-bar.baseline {
  top: 16px;
  height: 10px;
  background: rgba(100, 116, 139, 0.3);
  border-radius: 3px;
}

.bar-text {
  font-size: 10px;
  color: #fff;
  white-space: nowrap;
}

.timeline-legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted, #64748b);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-dot.cyan { background: rgba(6, 182, 212, 0.7); }
.legend-dot.gray { background: rgba(100, 116, 139, 0.3); }

.elim-error {
  text-align: center;
  color: #ef4444;
  font-size: 13px;
}
</style>
