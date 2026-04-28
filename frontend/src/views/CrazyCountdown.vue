<template>
  <div class="countdown-page">
    <div class="page-header">
      <h2 class="page-title"><el-icon class="title-icon"><AlarmClock /></el-icon> 疯狂倒计时</h2>
      <el-button type="primary" @click="openCreate">新建倒计时</el-button>
    </div>

    <div v-if="loading" class="skeleton-grid">
      <div v-for="i in 3" :key="i" class="skeleton skeleton-card"></div>
    </div>

    <div v-else-if="activeCountdowns.length === 0 && expiredCountdowns.length === 0" class="page-empty">
      <el-empty description="还没有倒计时">
        <el-button type="primary" @click="openCreate">创建第一个倒计时</el-button>
      </el-empty>
    </div>

    <template v-else>
      <div v-if="activeCountdowns.length" class="countdown-section">
        <div class="countdown-grid">
          <div
            v-for="item in activeCountdowns"
            :key="item.id"
            class="countdown-card"
            :class="[
              `level-${item.remind_level}`,
              { approaching: isApproaching(item) }
            ]"
          >
            <div class="card-header">
              <span class="level-badge" :class="item.remind_level">
                {{ levelLabel(item.remind_level) }}
              </span>
              <span class="card-status active">进行中</span>
            </div>
            <div class="card-title">{{ item.title }}</div>
            <div class="card-time" :class="{ urgent: isApproaching(item) }">
              {{ remaining[item.id] || '计算中...' }}
            </div>
            <div class="card-target">
              <span class="target-label">目标时间</span>
              {{ item.target_time }}
            </div>
            <div class="card-meta">
              提前 {{ item.remind_before }} 分钟提醒
            </div>
            <div class="card-actions">
              <el-button size="small" text @click="openEdit(item)">编辑</el-button>
              <el-popconfirm title="确定删除？" @confirm="handleDelete(item.id)">
                <template #reference>
                  <el-button size="small" text type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </div>
      </div>

      <div v-if="expiredCountdowns.length" class="countdown-section expired-section">
        <div class="section-header" @click="showExpired = !showExpired">
          <span class="section-label">已过期 ({{ expiredCountdowns.length }})</span>
          <span class="section-arrow" :class="{ open: showExpired }">▾</span>
        </div>
        <div v-if="showExpired" class="countdown-grid">
          <div
            v-for="item in expiredCountdowns"
            :key="item.id"
            class="countdown-card expired"
          >
            <div class="card-header">
              <span class="level-badge" :class="item.remind_level">
                {{ levelLabel(item.remind_level) }}
              </span>
              <span class="card-status expired">{{ statusLabel(item.status) }}</span>
            </div>
            <div class="card-title">{{ item.title }}</div>
            <div class="card-time">已到期</div>
            <div class="card-target">
              <span class="target-label">目标时间</span>
              {{ item.target_time }}
            </div>
            <div class="card-actions">
              <el-button size="small" text @click="openEdit(item)">编辑</el-button>
              <el-popconfirm title="确定删除？" @confirm="handleDelete(item.id)">
                <template #reference>
                  <el-button size="small" text type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 新建/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑倒计时' : '新建倒计时'"
      width="480px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form :model="form" :rules="formRules" ref="formRef" label-position="top">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" placeholder="倒计时名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="目标时间" prop="target_time">
          <el-date-picker
            v-model="form.target_time"
            type="datetime"
            placeholder="选择目标时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="提前提醒（分钟）">
          <el-input-number v-model="form.remind_before" :min="1" :max="1440" />
        </el-form-item>
        <el-form-item label="提醒级别">
          <el-radio-group v-model="form.remind_level">
            <el-radio value="normal">😊 普通</el-radio>
            <el-radio value="urgent">⚠️ 紧急</el-radio>
            <el-radio value="crazy">🔥 疯狂</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEditing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { AlarmClock } from '@element-plus/icons-vue'
import api from '@/api'

const countdowns = ref([])
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const remaining = reactive({})
const formRef = ref(null)
const showExpired = ref(false)
const now = ref(Date.now())

const activeCountdowns = computed(() => {
  void now.value
  return countdowns.value.filter(c => !isExpired(c))
})
const expiredCountdowns = computed(() => {
  void now.value
  return countdowns.value.filter(c => isExpired(c))
})

const formRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur', whitespace: true }],
  target_time: [{ required: true, message: '请选择目标时间', trigger: 'change' }]
}

const form = reactive({
  title: '',
  target_time: '',
  remind_before: 5,
  remind_level: 'urgent'
})

let tickTimer = null

function levelLabel(level) {
  return { normal: '普通', urgent: '紧急', crazy: '疯狂' }[level] || level
}

function statusLabel(status) {
  return { active: '进行中', expired: '已过期', dismissed: '已关闭' }[status] || status
}

function isExpired(item) {
  return new Date(item.target_time).getTime() < Date.now() || item.status !== 'active'
}

function isApproaching(item) {
  if (item.status !== 'active') return false
  const diff = new Date(item.target_time).getTime() - Date.now()
  return diff > 0 && diff <= item.remind_before * 60000
}

function updateRemaining() {
  now.value = Date.now()
  for (const item of countdowns.value) {
    const diff = new Date(item.target_time).getTime() - now.value
    if (diff <= 0) {
      remaining[item.id] = '已到期！'
      continue
    }
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    if (d > 0) remaining[item.id] = `${d}天 ${h}时${m}分${s}秒`
    else if (h > 0) remaining[item.id] = `${h}时${m}分${s}秒`
    else if (m > 0) remaining[item.id] = `${m}分${s}秒`
    else remaining[item.id] = `${s}秒`
  }
}

async function loadCountdowns() {
  loading.value = true
  try {
    const { data } = await api.getCountdowns()
    countdowns.value = data
    updateRemaining()
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function openCreate() {
  isEditing.value = false
  editingId.value = null
  dialogVisible.value = true
}

function openEdit(item) {
  isEditing.value = true
  editingId.value = item.id
  form.title = item.title
  form.target_time = item.target_time
  form.remind_before = item.remind_before
  form.remind_level = item.remind_level
  dialogVisible.value = true
}

function resetForm() {
  form.title = ''
  form.target_time = ''
  form.remind_before = 5
  form.remind_level = 'urgent'
  editingId.value = null
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEditing.value) {
      await api.updateCountdown(editingId.value, { ...form })
      ElMessage.success('已更新')
    } else {
      await api.createCountdown({ ...form })
      ElMessage.success('已创建')
    }
    dialogVisible.value = false
    await loadCountdowns()
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id) {
  try {
    await api.deleteCountdown(id)
    ElMessage.success('已删除')
    await loadCountdowns()
  } catch {
    // handled by interceptor
  }
}

onMounted(() => {
  loadCountdowns()
  tickTimer = setInterval(updateRemaining, 1000)
})

onBeforeUnmount(() => {
  clearInterval(tickTimer)
})
</script>

<style scoped>
.countdown-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: var(--accent-danger);
  font-size: 24px;
}

.page-loading {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--glass-border);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.page-empty {
  padding: 60px 0;
}

.countdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.countdown-card {
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  padding: 18px;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.countdown-card:hover {
  border-color: rgba(6, 182, 212, 0.4);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.countdown-card.approaching {
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
}

.countdown-card.approaching.level-crazy {
  border-color: rgba(220, 38, 38, 0.6);
  box-shadow: 0 0 20px rgba(220, 38, 38, 0.15);
  animation: cardPulse 2s ease-in-out infinite;
}

@keyframes cardPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.15); }
  50% { box-shadow: 0 0 30px rgba(220, 38, 38, 0.35); }
}

.countdown-card.expired {
  opacity: 0.5;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.level-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
}

.level-badge.normal {
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
}

.level-badge.urgent {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.level-badge.crazy {
  background: rgba(220, 38, 38, 0.15);
  color: #ef4444;
}

.card-status {
  font-size: 12px;
  color: var(--text-secondary);
}

.card-status.active {
  color: #22c55e;
}

.card-status.expired {
  color: #ef4444;
}

.card-status.dismissed {
  color: #64748b;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-time {
  font-size: 26px;
  font-weight: 800;
  color: #06b6d4;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
}

.card-time.urgent {
  color: #f59e0b;
}

.card-target {
  font-size: 13px;
  color: var(--text-secondary);
}

.target-label {
  margin-right: 6px;
  opacity: 0.6;
}

.card-meta {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.card-actions {
  display: flex;
  gap: 4px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--glass-border);
}

.countdown-section {
  margin-bottom: 24px;
}

.expired-section {
  margin-top: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 12px;
  transition: background 0.2s;
}

.section-header:hover {
  background: rgba(15, 23, 42, 0.6);
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.section-arrow {
  font-size: 14px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.section-arrow.open {
  transform: rotate(180deg);
}
</style>
