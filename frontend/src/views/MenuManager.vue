<template>
  <div class="admin-wrapper">
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
    </div>

    <el-card class="admin-card" shadow="hover" :body-style="{ padding: '32px' }">
      <template #header>
        <div class="admin-header">
          <div class="header-icon">
            <el-icon><Dish /></el-icon>
          </div>
          <div>
            <div class="admin-title">菜单管理</div>
            <div class="admin-subtitle">上传每周菜单图片，AI 自动识别并结构化存储</div>
          </div>
        </div>
      </template>

      <!-- 上传区域 -->
      <div class="section-title">
        <el-icon class="section-icon"><Upload /></el-icon>
        <span>上传菜单</span>
      </div>
      <div class="upload-area">
        <input ref="fileInputRef" type="file" accept="image/png,image/jpeg,image/webp" class="upload-hidden" @change="handleFileChange" />
        <div class="upload-drop" @click="fileInputRef?.click()">
          <div class="upload-drop-icon">{{ selectedMenuFile ? '📋' : '🖼️' }}</div>
          <div class="upload-drop-text">{{ selectedFileName || '点击选择菜单图片（jpg/png/webp，≤10MB）' }}</div>
        </div>
        <el-button type="primary" :loading="uploading" :disabled="!selectedMenuFile" class="upload-btn" @click="submitUpload">
          {{ uploading ? 'AI 识别中...' : '上传并解析' }}
        </el-button>
      </div>

      <div class="section-divider"></div>

      <!-- 历史菜单列表 -->
      <div class="section-title">
        <el-icon class="section-icon"><Calendar /></el-icon>
        <span>历史菜单</span>
        <span class="user-count" v-if="menuList.length">{{ menuList.length }} 周</span>
      </div>

      <div v-if="listLoading" class="list-loading">加载中...</div>
      <div v-else-if="!menuList.length" class="list-loading">暂无菜单记录</div>
      <div v-else class="menu-history">
        <div
          v-for="menu in menuList"
          :key="menu.week_start"
          class="menu-week-card"
          :class="{ active: expandedWeek === menu.week_start }"
          @click="toggleWeek(menu)"
        >
          <div class="week-card-header">
            <div class="week-card-left">
              <span class="week-badge" :class="{ current: isCurrentWeek(menu.week_start) }">
                {{ isCurrentWeek(menu.week_start) ? '本周' : formatWeekLabel(menu.week_start) }}
              </span>
              <span class="week-date">{{ menu.week_start }} 起</span>
            </div>
            <div class="week-card-right">
              <span class="week-time">{{ formatTime(menu.updated_at) }}</span>
              <span class="week-arrow" :class="{ open: expandedWeek === menu.week_start }">▾</span>
            </div>
          </div>

          <Transition name="expand">
            <div v-if="expandedWeek === menu.week_start" class="week-detail" @click.stop>
              <!-- 工具栏：识别有误时的人工订正入口 -->
              <div class="detail-toolbar">
                <template v-if="editingId !== menu.id">
                  <span class="toolbar-hint">AI 识别可能有误，可手动订正</span>
                  <el-button size="small" text class="toolbar-btn" @click="startEdit(menu)">✎ 编辑</el-button>
                </template>
                <template v-else>
                  <span class="toolbar-hint">改完点保存，留空的条目会被自动丢弃</span>
                  <div class="toolbar-actions">
                    <el-button size="small" text :disabled="saving" @click="cancelEdit">取消</el-button>
                    <el-button size="small" type="primary" :loading="saving" @click="saveEdit(menu)">保存</el-button>
                  </div>
                </template>
              </div>

              <!-- 编辑态 -->
              <template v-if="editingId === menu.id">
                <div v-for="dayName in weekdays" :key="dayName" class="day-section">
                  <div class="day-title">
                    {{ dayName }}
                    <span v-if="isDraftDayEmpty(dayName)" class="day-empty-tag">暂无安排</span>
                  </div>
                  <template v-if="!isDraftDayEmpty(dayName) || openedEmptyDays.includes(dayName)">
                    <div v-for="group in draftGroups(dayName)" :key="group.key" class="edit-group">
                      <div class="edit-group-title">{{ group.title }}</div>
                      <div v-for="row in group.rows" :key="row.label" class="edit-row">
                        <span class="edit-cat">{{ row.label }}</span>
                        <div class="edit-items">
                          <span v-for="(item, i) in row.items" :key="i" class="edit-chip" :class="{ fruit: group.key === '水果' }">
                            <input
                              v-model="row.items[i]"
                              class="chip-input"
                              :style="{ width: chipWidth(item) }"
                              placeholder="菜名"
                            />
                            <button class="chip-del" type="button" @click="row.items.splice(i, 1)">✕</button>
                          </span>
                          <button class="chip-add" type="button" @click="row.items.push('')">+ 添加</button>
                        </div>
                      </div>
                    </div>
                  </template>
                  <button v-else class="chip-add" type="button" @click="openedEmptyDays.push(dayName)">+ 添加安排</button>
                </div>
              </template>

              <!-- 只读态 -->
              <template v-else>
              <div v-for="dayName in weekdays" :key="dayName" class="day-section">
                <div class="day-title">{{ dayName }}</div>
                <div class="day-meals">
                  <div v-if="getDayMeal(menu, '午餐', dayName)" class="meal-block">
                    <span class="meal-label">☀️ 午餐</span>
                    <div class="meal-items">
                      <template v-for="cat in mealCategories" :key="cat">
                        <span v-for="item in getDayMealCategory(menu, '午餐', dayName, cat)" :key="item" class="meal-chip">{{ item }}</span>
                      </template>
                    </div>
                  </div>
                  <div v-if="getDayFruit(menu, dayName).length" class="meal-block">
                    <span class="meal-label">🍎 水果</span>
                    <div class="meal-items">
                      <span v-for="item in getDayFruit(menu, dayName)" :key="item" class="meal-chip fruit">{{ item }}</span>
                    </div>
                  </div>
                  <div v-if="getDayMeal(menu, '晚餐', dayName)" class="meal-block">
                    <span class="meal-label">🌙 晚餐</span>
                    <div class="meal-items">
                      <template v-for="cat in mealCategories" :key="cat">
                        <span v-for="item in getDayMealCategory(menu, '晚餐', dayName, cat)" :key="item" class="meal-chip">{{ item }}</span>
                      </template>
                    </div>
                  </div>
                  <div v-if="!getDayMeal(menu, '午餐', dayName) && !getDayFruit(menu, dayName).length && !getDayMeal(menu, '晚餐', dayName)" class="no-menu">
                    暂无安排
                  </div>
                </div>
              </div>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Dish, Upload, Calendar } from '@element-plus/icons-vue'
import api from '@/api'

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const mealCategories = ['主荤', '半荤', '素菜', '杂粮', '主食', '汤粥']

const fileInputRef = ref(null)
const selectedMenuFile = ref(null)
const selectedFileName = ref('')
const uploading = ref(false)
const menuList = ref([])
const listLoading = ref(false)
const expandedWeek = ref(null)

// 人工订正状态：editDraft 是完整 7 天骨架的深拷贝，
// 这样任何一天/任何分类都能直接加条目，空白的部分保存时由后端裁掉
const editingId = ref(null)
const editDraft = ref(null)
const openedEmptyDays = ref([])
const saving = ref(false)

function handleFileChange(e) {
  const file = e.target.files?.[0]
  selectedMenuFile.value = file || null
  selectedFileName.value = file?.name || ''
}

async function submitUpload() {
  if (!selectedMenuFile.value) return
  uploading.value = true
  try {
    await api.uploadWeeklyMenu(selectedMenuFile.value)
    ElMessage.success('菜单上传成功')
    selectedMenuFile.value = null
    selectedFileName.value = ''
    if (fileInputRef.value) fileInputRef.value.value = ''
    await loadMenuList()
  } catch (error) {
    const msg = error.response?.data?.error || '上传失败'
    ElMessage.error(msg)
  } finally {
    uploading.value = false
  }
}

async function loadMenuList() {
  listLoading.value = true
  try {
    const res = await api.getMenuList()
    menuList.value = res.data.items || []
    // 默认展开本周
    if (menuList.value.length) {
      const current = menuList.value.find(m => isCurrentWeek(m.week_start))
      expandedWeek.value = current ? current.week_start : menuList.value[0].week_start
    }
  } catch (e) {
    console.error('加载菜单列表失败:', e)
  } finally {
    listLoading.value = false
  }
}

function toggleWeek(menu) {
  // 编辑中不允许折叠，否则未保存的修改会被静默丢弃
  if (editingId.value === menu.id) return
  expandedWeek.value = expandedWeek.value === menu.week_start ? null : menu.week_start
}

function startEdit(menu) {
  const src = menu.menu || {}
  const draft = { '午餐': {}, '水果': {}, '晚餐': {} }
  for (const day of weekdays) {
    for (const meal of ['午餐', '晚餐']) {
      draft[meal][day] = {}
      for (const cat of mealCategories) {
        draft[meal][day][cat] = [...(src[meal]?.[day]?.[cat] || [])]
      }
    }
    draft['水果'][day] = [...(src['水果']?.[day] || [])]
  }
  editDraft.value = draft
  openedEmptyDays.value = []
  editingId.value = menu.id
}

function cancelEdit() {
  editingId.value = null
  editDraft.value = null
  openedEmptyDays.value = []
}

async function saveEdit(menu) {
  saving.value = true
  try {
    await api.updateWeeklyMenu(menu.id, editDraft.value)
    ElMessage.success('菜单已更新')
    cancelEdit()
    await loadMenuList()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

// 把嵌套 draft 摊平成模板好渲染的分组；rows[].items 是 draft 里数组的引用，
// 因此 v-model 直接写回 draft，无需再同步
function draftGroups(dayName) {
  const d = editDraft.value
  if (!d) return []
  return [
    { key: '午餐', title: '☀️ 午餐', rows: mealCategories.map(cat => ({ label: cat, items: d['午餐'][dayName][cat] })) },
    { key: '水果', title: '🍎 水果', rows: [{ label: '水果', items: d['水果'][dayName] }] },
    { key: '晚餐', title: '🌙 晚餐', rows: mealCategories.map(cat => ({ label: cat, items: d['晚餐'][dayName][cat] })) },
  ]
}

function isDraftDayEmpty(dayName) {
  return draftGroups(dayName).every(g => g.rows.every(r => r.items.every(i => !String(i).trim())))
}

function chipWidth(item) {
  return `${Math.max(3.5, (item?.length || 0) + 1.5)}em`
}

function isCurrentWeek(weekStart) {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))
  const fmt = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  return weekStart === fmt
}

function formatWeekLabel(weekStart) {
  const d = new Date(weekStart + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatTime(dt) {
  if (!dt) return ''
  return dt.replace(/^\d{4}-/, '').replace(' ', ' ')
}

function getDayMeal(menu, mealType, dayName) {
  return menu.menu?.[mealType]?.[dayName] || null
}

function getDayMealCategory(menu, mealType, dayName, category) {
  return menu.menu?.[mealType]?.[dayName]?.[category] || []
}

function getDayFruit(menu, dayName) {
  return menu.menu?.['水果']?.[dayName] || []
}

onMounted(loadMenuList)
</script>

<style scoped>
.admin-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 60px;
  position: relative;
}

.background-shapes .shape {
  position: fixed;
  filter: blur(100px);
  z-index: 0;
  opacity: 0.35;
  pointer-events: none;
}

.shape-1 {
  top: 20%;
  left: 8%;
  width: 360px;
  height: 360px;
  background: var(--primary-color);
  animation: float 8s ease-in-out infinite;
}

.shape-2 {
  bottom: 18%;
  right: 10%;
  width: 280px;
  height: 280px;
  background: var(--secondary-color);
  animation: float 10s ease-in-out infinite reverse;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, -20px); }
}

.admin-card {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  border-radius: 24px;
  border: 1px solid var(--glass-border);
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.admin-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-highlight), transparent);
}

.admin-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.15));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 24px;
  border: 1px solid var(--glass-border);
}

.admin-title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(to right, #fff, var(--text-secondary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.admin-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.section-icon { font-size: 18px; }

.user-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 10px;
  border-radius: 10px;
  margin-left: 4px;
}

.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--glass-border), transparent);
  margin: 24px 0;
}

.list-loading {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
}

/* 上传区域 */
.upload-area {
  display: flex;
  gap: 12px;
  align-items: center;
}

.upload-hidden { display: none; }

.upload-drop {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border: 1px dashed var(--glass-border);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.4);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-drop:hover {
  border-color: var(--primary-color);
  background: rgba(6, 182, 212, 0.05);
}

.upload-drop-icon { font-size: 24px; flex-shrink: 0; }

.upload-drop-text {
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-btn {
  height: 48px;
  border-radius: 12px;
  padding: 0 24px;
  flex-shrink: 0;
}

/* 历史菜单 */
.menu-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.menu-week-card {
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.4);
  overflow: hidden;
  transition: all 0.2s;
  cursor: pointer;
}

.menu-week-card:hover {
  border-color: rgba(6, 182, 212, 0.3);
}

.menu-week-card.active {
  border-color: var(--primary-color);
  background: rgba(6, 182, 212, 0.04);
}

.week-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
}

.week-card-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.week-badge {
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
}

.week-badge.current {
  background: rgba(6, 182, 212, 0.15);
  color: var(--primary-color);
}

.week-date {
  font-size: 13px;
  color: var(--text-primary);
}

.week-card-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.week-time {
  font-size: 12px;
  color: var(--text-muted);
}

.week-arrow {
  font-size: 14px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.week-arrow.open {
  transform: rotate(180deg);
}

/* 展开详情 */
.week-detail {
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-section {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.day-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.day-meals {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meal-block {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.meal-label {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
  padding-top: 3px;
}

.meal-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meal-chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.2);
  font-size: 12px;
  color: var(--text-primary);
}

.meal-chip.fruit {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.2);
}

.no-menu {
  font-size: 12px;
  color: var(--text-muted);
}

/* 编辑态 */
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0 2px;
}

.toolbar-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.toolbar-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.toolbar-btn { flex-shrink: 0; }

.day-empty-tag {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted);
  margin-left: 8px;
}

.edit-group { margin-top: 8px; }

.edit-group-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.edit-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 0;
}

.edit-cat {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  width: 36px;
  padding-top: 5px;
}

.edit-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.edit-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 2px 8px;
  border-radius: 999px;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.25);
}

.edit-chip.fruit {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.25);
}

.chip-input {
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--text-primary);
  padding: 2px 0;
  min-width: 3.5em;
  font-family: inherit;
}

.chip-input::placeholder { color: var(--text-muted); }

.chip-del {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 3px;
  border-radius: 50%;
  transition: all 0.15s;
}

.chip-del:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
}

.chip-add {
  padding: 3px 10px;
  border-radius: 999px;
  background: transparent;
  border: 1px dashed var(--glass-border);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.chip-add:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

/* 展开动画 */
.expand-enter-active { transition: all 0.25s ease; }
.expand-leave-active { transition: all 0.15s ease; }
.expand-enter-from,
.expand-leave-to { opacity: 0; max-height: 0; overflow: hidden; }
.expand-enter-to,
.expand-leave-from { opacity: 1; max-height: 2000px; }

@media (max-width: 720px) {
  .admin-wrapper { padding: 24px 16px 40px; }
  .upload-area { flex-direction: column; }
  .upload-btn { width: 100%; }
}
</style>
