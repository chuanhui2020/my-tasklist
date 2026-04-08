<template>
  <el-card class="tech-card life-progress-card" shadow="hover">
    <div class="lp-header">
      <div class="lp-header-left">
        <div class="lp-title">
          <el-icon class="icon-pulse"><Odometer /></el-icon>
          <span>人生进度</span>
        </div>
        <div class="lp-subtitle">系统监测中...请勿关闭人生</div>
      </div>
      <div class="lp-settings-btn" @click="showSettings = !showSettings" title="设置">
        <el-icon><Setting /></el-icon>
      </div>
      <button class="sidebar-switch-btn" @click="emit('switch-mode')" title="切换到体素花园">
        <el-icon><MagicStick /></el-icon>
        <span>体素花园</span>
      </button>
    </div>

    <Transition name="settings-slide">
      <div v-if="showSettings" class="lp-settings">
        <div class="setting-row">
          <span class="setting-label">退休日期</span>
          <input type="month" v-model="retireDate" class="setting-input setting-input-date" @change="saveSettings" />
        </div>
      </div>
    </Transition>

    <div class="progress-list">
      <div
        v-for="bar in bars"
        :key="bar.id"
        class="progress-item"
        :class="{ 'is-alert': bar.alert, 'is-clickable': bar.clickable }"
        @click="handleBarClick(bar)"
      >
        <div class="progress-meta">
          <div class="progress-info">
            <span class="progress-label">{{ bar.title }}</span>
            <span class="progress-desc">{{ bar.subtitle }}</span>
          </div>
          <span class="progress-value" :class="bar.valueClass">{{ bar.display }}</span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="bar.colorClass"
            :style="{ width: bar.percent + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="menu-pop">
        <div v-if="menuDialogVisible" class="menu-overlay" @click="menuDialogVisible = false">
          <div class="menu-popup" @click.stop>
            <div class="menu-popup-header">
              <div class="menu-popup-icon">{{ menuDialogIcon }}</div>
              <div class="menu-popup-titles">
                <div class="menu-popup-title">{{ menuDialogTitle }}</div>
                <div class="menu-popup-quip">{{ menuDialogQuip }}</div>
              </div>
              <button class="menu-popup-close" @click="menuDialogVisible = false">&times;</button>
            </div>
            <div class="menu-popup-body">
              <div v-for="meal in menuDialogMeals" :key="meal.title" class="menu-meal-section">
                <div class="menu-meal-title">{{ meal.title }}</div>
                <div v-if="meal.fruits" class="menu-popup-fruit">
                  <span v-for="item in meal.fruits" :key="item" class="menu-chip-v2">{{ item }}</span>
                </div>
                <div v-else class="menu-popup-grid">
                  <div v-for="group in meal.groups" :key="group.label" class="menu-group-v2">
                    <span class="menu-group-icon">{{ categoryIcon(group.label) }}</span>
                    <span class="menu-group-label">{{ group.label }}</span>
                    <div class="menu-group-items">
                      <span v-for="item in group.items" :key="item" class="menu-chip-v2">{{ item }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="!menuDialogMeals.length" class="menu-empty-v2">今日暂无菜单安排</div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 喝水/拉屎提醒弹窗 -->
    <Teleport to="body">
      <Transition name="alert-fade">
        <div v-if="alertVisible" class="timer-alert-overlay" @click="dismissAlert">
          <div class="timer-alert-box" @click.stop>
            <div class="alert-icon">{{ alertData.icon }}</div>
            <div class="alert-title">{{ alertData.title }}</div>
            <div class="alert-desc">{{ alertData.desc }}</div>
            <button class="alert-btn" @click="dismissAlert">{{ alertData.btn }}</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Odometer, Setting, MagicStick } from '@element-plus/icons-vue'
import api from '@/api'

const emit = defineEmits(['switch-mode'])

// --- 常量 ---
const WORK_START = 9
const WORK_END = 20.5  // 上海时间 20:30
const PAYDAY = 5
const WATER_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] // 每2小时喝水
const POOP_HOURS = [9, 13, 19] // 每日三次拉屎时刻

// 中国法定节假日（数据来源：国务院办公厅）
const HOLIDAYS = [
  { name: '元旦', start: '2025-01-01', end: '2025-01-01' },
  { name: '春节', start: '2025-01-28', end: '2025-02-04' },
  { name: '清明节', start: '2025-04-04', end: '2025-04-06' },
  { name: '劳动节', start: '2025-05-01', end: '2025-05-05' },
  { name: '端午节', start: '2025-06-27', end: '2025-06-29' },
  { name: '中秋节+国庆节', start: '2025-10-01', end: '2025-10-08' },
  { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
  { name: '春节', start: '2026-02-15', end: '2026-02-23' },
  { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
]

// --- 响应式状态 ---
const now = ref(new Date())
const defaultRetireDate = '2065-01'
const retireDate = ref(localStorage.getItem('life_progress_retire_date') || defaultRetireDate)
const showSettings = ref(false)
const todayMenu = ref({
  week_start: '',
  weekday: '',
  lunch: null,
  fruit: [],
  dinner: null,
  available: false
})
const menuDialogVisible = ref(false)
const activeMenuType = ref('lunch')
const menuDialogMeals = ref([])

// 提醒弹窗
const alertVisible = ref(false)
const alertData = ref({ icon: '', title: '', desc: '', btn: '' })

// 记录已弹过的时刻，避免同一时刻重复弹窗（用sessionStorage防止组件重挂载时重置）
const alertedWaterHour = ref(parseInt(sessionStorage.getItem('lp_alerted_water') || '-1'))
const alertedPoopHour = ref(parseInt(sessionStorage.getItem('lp_alerted_poop') || '-1'))

function saveSettings() {
  localStorage.setItem('life_progress_retire_date', retireDate.value)
}

// 根据进度自动分配颜色：正常(蓝) → 即将到来(橙) → 已到达(绿)
function getBarStyle(percent, done, alert) {
  if (alert) return { colorClass: 'fill-alert-pulse', valueClass: 'value-alert' }
  if (done) return { colorClass: 'fill-success', valueClass: 'value-success' }
  if (percent >= 80) return { colorClass: 'fill-warning', valueClass: 'value-warning' }
  return { colorClass: 'fill-cyber', valueClass: '' }
}

function flattenMealItems(menu) {
  if (!menu || typeof menu !== 'object') return []
  const items = []
  for (const key of ['主荤', '半荤', '素菜', '杂粮', '主食', '汤粥']) {
    const bucket = Array.isArray(menu[key]) ? menu[key] : []
    for (const item of bucket) {
      const text = String(item || '').trim()
      if (text) items.push(text)
    }
  }
  return items
}

function buildMenuPreview(items, emptyText) {
  if (!items.length) return emptyText
  if (items.length <= 2) return items.join(' · ')
  return `${items.slice(0, 2).join(' · ')} 等 ${items.length} 项`
}

async function loadTodayMenu() {
  try {
    const res = await api.getTodayMenu()
    todayMenu.value = {
      week_start: res?.data?.week_start || '',
      weekday: res?.data?.weekday || '',
      lunch: res?.data?.lunch || null,
      fruit: Array.isArray(res?.data?.fruit) ? res.data.fruit : [],
      dinner: res?.data?.dinner || null,
      available: res?.data?.available === true
    }
  } catch (error) {
    console.error('加载今日菜单失败:', error)
  }
}

function handleBarClick(bar) {
  if (!bar.clickable || !bar.menuType) return
  activeMenuType.value = 'all-meals'
  // 构建所有三餐数据
  const meals = []
  const lunchSource = todayMenu.value.lunch
  const lunchGroups = ['主荤', '半荤', '素菜', '杂粮', '主食', '汤粥']
    .map(label => ({ label, items: Array.isArray(lunchSource?.[label]) ? [...lunchSource[label]] : [] }))
    .filter(g => g.items.length > 0)
  if (lunchGroups.length) meals.push({ title: '☀️ 午餐', groups: lunchGroups })

  const fruits = Array.isArray(todayMenu.value.fruit) ? [...todayMenu.value.fruit] : []
  if (fruits.length) meals.push({ title: '🍎 水果', fruits })

  const dinnerSource = todayMenu.value.dinner
  const dinnerGroups = ['主荤', '半荤', '素菜', '杂粮', '主食', '汤粥']
    .map(label => ({ label, items: Array.isArray(dinnerSource?.[label]) ? [...dinnerSource[label]] : [] }))
    .filter(g => g.items.length > 0)
  if (dinnerGroups.length) meals.push({ title: '🌙 晚餐', groups: dinnerGroups })

  menuDialogMeals.value = meals
  menuDialogVisible.value = true
}

const menuDialogTitle = computed(() => '今日餐饮')

const menuDialogIcon = computed(() => '🍽️')

const menuDialogQuip = computed(() => {
  const quips = ['干饭人，干饭魂！', '吃饱了才有力气减肥', '人是铁饭是钢', '民以食为天，我以吃为先']
  return quips[Math.floor(Math.random() * quips.length)]
})

function categoryIcon(label) {
  const icons = { '主荤': '🥩', '半荤': '🍗', '素菜': '🥬', '杂粮': '🌾', '主食': '🍚', '汤粥': '🍲' }
  return icons[label] || '🍽️'
}

// --- 计算进度 ---
const bars = computed(() => {
  const n = now.value
  const list = []

  // 1. 本月进度
  const daysInMonth = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()
  const monthPct = ((n.getDate() - 1 + n.getHours() / 24) / daysInMonth) * 100
  list.push({
    id: 'month',
    title: '本月进度',
    subtitle: '本月余额不足，请及时充值',
    percent: Math.min(monthPct, 100).toFixed(1),
    display: `已消耗 ${monthPct.toFixed(1)}%`,
    ...getBarStyle(monthPct, false, false),
  })

  // 2. 本年进度
  const startOfYear = new Date(n.getFullYear(), 0, 1)
  const endOfYear = new Date(n.getFullYear() + 1, 0, 1)
  const yearPct = ((n - startOfYear) / (endOfYear - startOfYear)) * 100
  list.push({
    id: 'year',
    title: '本年进度',
    subtitle: '今年的flag还记得吗？',
    percent: Math.min(yearPct, 100).toFixed(1),
    display: `${n.getFullYear()} 已过 ${yearPct.toFixed(1)}%`,
    ...getBarStyle(yearPct, false, false),
  })

  // 判断今天是否在假期中
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  let currentHoliday = null
  for (const h of HOLIDAYS) {
    const start = new Date(h.start + 'T00:00:00')
    const end = new Date(h.end + 'T00:00:00')
    if (today >= start && today <= end) {
      currentHoliday = h
      break
    }
  }

  const holidayWorkQuips = [
    '放假中，老板找不到你的~',
    '今天不营业，请明天再来剥削',
    '工位想你了，但你不想它',
    '带薪躺平中，合法摸鱼!',
    '今日已与工作断绝关系',
  ]
  const holidayWeekendQuips = [
    '天天都是周末，爽歪歪!',
    '周末？我现在每天都是周末!',
    '假期面前，周末不值一提',
    '什么周末不周末的，放假就完事了!',
    '周一到周日都是我的，哈哈哈!',
  ]

  // 3. 距离下班
  const curHour = n.getHours() + n.getMinutes() / 60 + n.getSeconds() / 3600
  let workPct, workDisplay, workOff
  if (currentHoliday) {
    workPct = 100
    workOff = true
    workDisplay = holidayWorkQuips[n.getDate() % holidayWorkQuips.length]
  } else {
    workOff = curHour < WORK_START || curHour >= WORK_END
    if (workOff) {
      workPct = 100
      workDisplay = '已下班，恭喜摸鱼成功!'
    } else {
      workPct = ((curHour - WORK_START) / (WORK_END - WORK_START)) * 100
      const remainSec = (WORK_END - curHour) * 3600
      const rh = Math.floor(remainSec / 3600)
      const rm = Math.floor((remainSec % 3600) / 60)
      workDisplay = `还剩 ${rh}h ${rm}min`
    }
  }
  list.push({
    id: 'work',
    title: '距离下班',
    subtitle: currentHoliday ? `${currentHoliday.name}快乐，班味已清除` : '打工人打工魂，摸鱼才是人上人',
    percent: Math.min(workPct, 100).toFixed(1),
    display: workDisplay,
    ...getBarStyle(workPct, workOff, false),
  })

  // 4. 距离周末
  const dayOfWeek = n.getDay() // 0=周日, 6=周六
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  let weekendDisplay, weekendPct, weekendDone
  if (currentHoliday) {
    weekendPct = 100
    weekendDone = true
    weekendDisplay = holidayWeekendQuips[n.getDate() % holidayWeekendQuips.length]
  } else if (isWeekend) {
    weekendPct = 100
    weekendDone = true
    weekendDisplay = '周末快乐！但周一在逼近...'
  } else {
    weekendDone = false
    // 周一=1 到 周五=5，距离周六还有 (6 - dayOfWeek) 天
    const daysLeft = 6 - dayOfWeek
    weekendPct = ((5 - daysLeft) / 5) * 100
    if (daysLeft === 1) {
      weekendDisplay = '明天就周末了，再撑撑!'
    } else {
      weekendDisplay = `还有 ${daysLeft} 天，熬住!`
    }
  }
  list.push({
    id: 'weekend',
    title: '距离周末',
    subtitle: currentHoliday ? `${currentHoliday.name}期间，周末算什么` : '每周最大的盼头，没有之一',
    percent: weekendPct.toFixed(1),
    display: weekendDisplay,
    ...getBarStyle(weekendPct, weekendDone, false),
  })

  // 4.5 今日餐饮（合并午饭/水果/晚饭，按时间顺序展示当前最近的一个）
  const MEAL_SCHEDULE = [
    { id: 'lunch-menu', label: '午饭', icon: '☀️', menuType: 'lunch', start: 12, end: 14, anchor: 8,
      quips: ['干饭中，勿扰!', '饭搭子已就位，开冲!', '碳水快乐，谁懂?', '今天中午吃点好的'] },
    { id: 'fruit-menu', label: '水果', icon: '🍎', menuType: 'fruit', start: 14.5, end: 15, anchor: 14,
      quips: ['水果时间到，补充维生素!', '来点水果，下午更精神', '今天的水果已经就位'] },
    { id: 'dinner-menu', label: '晚饭', icon: '🌙', menuType: 'dinner', start: 18, end: 19, anchor: 15,
      quips: ['晚饭进行中，今天也辛苦了', '干饭！干饭！干饭！', '今晚吃点好的，犒劳自己'] },
  ]

  const mealItemsMap = {
    lunch: flattenMealItems(todayMenu.value.lunch),
    fruit: Array.isArray(todayMenu.value.fruit) ? todayMenu.value.fruit : [],
    dinner: flattenMealItems(todayMenu.value.dinner),
  }

  // 找到当前最相关的一餐：正在进行 > 下一个未开始 > 最后一个已结束
  let activeMeal = null
  for (const meal of MEAL_SCHEDULE) {
    if (curHour >= meal.start && curHour < meal.end) { activeMeal = meal; break }
  }
  if (!activeMeal) {
    activeMeal = MEAL_SCHEDULE.find(m => curHour < m.start) || MEAL_SCHEDULE[MEAL_SCHEDULE.length - 1]
  }

  const mealItems = mealItemsMap[activeMeal.menuType]
  const mealPreview = buildMenuPreview(mealItems, '今日暂无菜单')
  const hasMealMenu = mealPreview !== '今日暂无菜单'

  let mealTitle, mealDisplay, mealPct, mealDone
  if (curHour >= activeMeal.end) {
    mealTitle = `今日${activeMeal.label}`
    mealPct = 100; mealDone = true
    mealDisplay = activeMeal.quips[n.getMinutes() % activeMeal.quips.length]
  } else if (curHour >= activeMeal.start) {
    mealTitle = `${activeMeal.label}时间`
    mealPct = 100; mealDone = true
    mealDisplay = activeMeal.quips[n.getMinutes() % activeMeal.quips.length]
  } else {
    mealTitle = `距离${activeMeal.label}`
    mealDone = false
    const remainMin = Math.max(Math.floor((activeMeal.start - curHour) * 60), 0)
    const totalWindow = Math.max((activeMeal.start - activeMeal.anchor) * 60, 1)
    mealPct = Math.max((1 - remainMin / totalWindow) * 100, 0)
    if (remainMin <= 30) mealDisplay = `还有${remainMin}分钟，快到了`
    else if (remainMin <= 60) mealDisplay = `还有${remainMin}分钟，再等等`
    else { const rh = Math.floor(remainMin / 60); const rm = remainMin % 60; mealDisplay = `还有${rh}小时${rm}分钟` }
  }

  // 构建副标题：显示三餐时间线状态 + 下一餐随机菜品轮播
  const mealTimeline = MEAL_SCHEDULE.map(m => {
    const status = curHour >= m.end ? '✅' : curHour >= m.start ? '🔥' : '⏳'
    return `${status}${m.label}`
  }).join(' → ')

  // 找下一餐的菜品做轮播（每3秒切换）
  let rotatingItem = ''
  if (hasMealMenu && mealItems.length > 0) {
    if (mealItems.length === 1) {
      rotatingItem = mealItems[0]
    } else {
      const idx = Math.floor(n.getTime() / 3000) % mealItems.length
      rotatingItem = mealItems[idx]
    }
  }

  list.push({
    id: activeMeal.id,
    title: mealTitle,
    subtitle: rotatingItem ? `${mealTimeline} · ${rotatingItem}` : mealTimeline,
    percent: mealPct.toFixed(1),
    display: mealDisplay,
    clickable: hasMealMenu,
    menuType: activeMeal.menuType,
    ...getBarStyle(mealPct, mealDone, false),
  })

  // 5. 距离发薪
  let nextPayday
  if (n.getDate() < PAYDAY) {
    nextPayday = new Date(n.getFullYear(), n.getMonth(), PAYDAY)
  } else if (n.getDate() === PAYDAY) {
    nextPayday = null // 今天就是发薪日
  } else {
    nextPayday = new Date(n.getFullYear(), n.getMonth() + 1, PAYDAY)
  }
  let payDisplay, payPct
  if (!nextPayday) {
    payDisplay = '今天发薪！冲鸭!'
    payPct = 100
  } else {
    const daysUntil = Math.ceil((nextPayday - n) / 86400000)
    payPct = Math.max((1 - daysUntil / 30) * 100, 0)
    payDisplay = `还有 ${daysUntil} 天，坚持住!`
  }
  list.push({
    id: 'pay',
    title: '距离发薪',
    subtitle: '钱包空空如也，但梦想还在',
    percent: payPct.toFixed(1),
    display: payDisplay,
    ...getBarStyle(payPct, !nextPayday, false),
  })

  // 6. 距离下次放假
  let nextHoliday = null
  let inHoliday = !!currentHoliday
  if (inHoliday) {
    nextHoliday = currentHoliday
  } else {
    for (const h of HOLIDAYS) {
      const start = new Date(h.start + 'T00:00:00')
      if (start > today) {
        nextHoliday = h
        break
      }
    }
  }
  let holidayDisplay, holidayPct
  if (inHoliday) {
    holidayDisplay = `${nextHoliday.name} 放假中，快乐!`
    holidayPct = 100
  } else if (nextHoliday) {
    const daysUntil = Math.ceil((new Date(nextHoliday.start + 'T00:00:00') - today) / 86400000)
    holidayPct = Math.max((1 - daysUntil / 90) * 100, 0)
    holidayDisplay = `${nextHoliday.name} 还有 ${daysUntil} 天`
  } else {
    holidayDisplay = '暂无假期数据'
    holidayPct = 0
  }
  list.push({
    id: 'holiday',
    title: '距离下次放假',
    subtitle: '上班是不可能上班的，放假才是真理',
    percent: holidayPct.toFixed(1),
    display: holidayDisplay,
    ...getBarStyle(holidayPct, inHoliday, false),
  })

  // 7. 距离下次喝水（固定时刻表：每2小时）
  const waterNowMin = n.getHours() * 60 + n.getMinutes()
  let nextWaterHour = WATER_HOURS.find(h => h * 60 > waterNowMin)
  let prevWaterHour = null
  if (!nextWaterHour && nextWaterHour !== 0) {
    nextWaterHour = WATER_HOURS[0] // 明天0点
    prevWaterHour = WATER_HOURS[WATER_HOURS.length - 1]
  } else {
    const idx = WATER_HOURS.indexOf(nextWaterHour)
    prevWaterHour = idx > 0 ? WATER_HOURS[idx - 1] : WATER_HOURS[WATER_HOURS.length - 1]
  }
  const waterRemainMin = nextWaterHour * 60 > waterNowMin
    ? nextWaterHour * 60 - waterNowMin
    : (24 * 60 - waterNowMin + nextWaterHour * 60)
  const waterIntervalMin = 120 // 2小时
  const waterPct = Math.max((1 - waterRemainMin / waterIntervalMin) * 100, 0)
  const waterAlert = waterRemainMin <= 5
  let waterDisplay
  if (waterRemainMin <= 5) {
    const quips = ['该喝水了！再不喝要变木乃伊了', '喝水时间到！你的细胞在求救', '快去接水！你比沙漠还干']
    waterDisplay = quips[n.getMinutes() % quips.length]
  } else if (waterRemainMin <= 30) {
    waterDisplay = `还有${waterRemainMin}分钟，嘴巴已经开始抗议了`
  } else {
    const wh = Math.floor(waterRemainMin / 60)
    const wm = waterRemainMin % 60
    waterDisplay = wh > 0 ? `还有${wh}小时${wm}分钟` : `还有${wm}分钟`
  }
  list.push({
    id: 'water',
    title: '距离下次喝水',
    subtitle: '多喝热水，包治百病',
    percent: waterAlert ? 100 : waterPct.toFixed(1),
    display: waterDisplay,
    ...getBarStyle(waterPct, false, waterAlert),
    alert: waterAlert,
  })

  // 8. 距离下次拉屎（固定时刻表：9:00, 13:00, 19:00）
  const poopNowMin = waterNowMin
  let nextPoopHour = POOP_HOURS.find(h => h * 60 > poopNowMin)
  let prevPoopHour = null
  if (!nextPoopHour) {
    nextPoopHour = POOP_HOURS[0] // 明天9点
    prevPoopHour = POOP_HOURS[POOP_HOURS.length - 1]
  } else {
    const idx = POOP_HOURS.indexOf(nextPoopHour)
    prevPoopHour = idx > 0 ? POOP_HOURS[idx - 1] : POOP_HOURS[POOP_HOURS.length - 1]
  }
  const poopRemainMin = nextPoopHour * 60 > poopNowMin
    ? nextPoopHour * 60 - poopNowMin
    : (24 * 60 - poopNowMin + nextPoopHour * 60)
  // 计算当前间隔长度
  const poopIntervalMin = nextPoopHour * 60 > poopNowMin
    ? (nextPoopHour - (prevPoopHour || 0)) * 60
    : (24 * 60 - (prevPoopHour || 0) * 60 + nextPoopHour * 60)
  const poopPct = Math.max((1 - poopRemainMin / Math.max(poopIntervalMin, 1)) * 100, 0)
  const poopAlert = poopRemainMin <= 10
  let poopDisplay
  if (poopRemainMin <= 10) {
    const quips = ['肠道来电了，请接听！', '马桶已就绪，请就位！', '排毒时间到，冲鸭！']
    poopDisplay = quips[n.getMinutes() % quips.length]
  } else if (poopRemainMin <= 30) {
    poopDisplay = `还有${poopRemainMin}分钟，肚子开始有想法了`
  } else {
    const ph = Math.floor(poopRemainMin / 60)
    const pm = poopRemainMin % 60
    poopDisplay = ph > 0 ? `还有${ph}小时${pm}分钟，先忍忍` : `还有${pm}分钟，做好准备`
  }
  list.push({
    id: 'poop',
    title: '距离下次拉屎',
    subtitle: '人生大事，不可忽视',
    percent: poopAlert ? 100 : poopPct.toFixed(1),
    display: poopDisplay,
    ...getBarStyle(poopPct, false, poopAlert),
    alert: poopAlert,
  })

  // 9. 距离退休
  const [retireY, retireM] = retireDate.value.split('-').map(Number)
  const retireTarget = new Date(retireY, retireM - 1, 1)
  const msLeft = retireTarget - n
  let retireDisplay, retirePct
  if (msLeft <= 0) {
    retirePct = 100
    retireDisplay = '已退休！恭喜解放!'
  } else {
    // 以今年1月1日为起点，计算到退休日期的进度
    const yearStart = new Date(n.getFullYear(), 0, 1)
    const totalMs = retireTarget - yearStart
    const elapsedMs = n - yearStart
    retirePct = totalMs > 0 ? Math.min((elapsedMs / totalMs) * 100, 99.9) : 0
    const daysLeft = Math.ceil(msLeft / 86400000)
    const yrs = Math.floor(daysLeft / 365)
    const mos = Math.floor((daysLeft % 365) / 30)
    const ds = daysLeft - yrs * 365 - mos * 30
    if (yrs > 0) {
      retireDisplay = `还剩 ${yrs}年${mos}月${ds}天，再忍忍`
    } else if (mos > 0) {
      retireDisplay = `还剩 ${mos}月${ds}天，曙光在前!`
    } else {
      retireDisplay = `还剩 ${ds}天，冲刺阶段!`
    }
  }
  list.push({
    id: 'retire',
    title: '距离退休',
    subtitle: `目标: ${retireY}年${retireM}月 · 退休倒计时`,
    percent: retirePct.toFixed(1),
    display: retireDisplay,
    ...getBarStyle(retirePct, msLeft <= 0, false),
  })

  return list
})

function formatCountdown(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}分${s < 10 ? '0' : ''}${s}秒`
}

// --- 提醒逻辑 ---
const waterAlerts = [
  { icon: '💧', title: '喝水警报！', desc: '你的身体已经在沙漠边缘了，快去接杯水！', btn: '已喝，重置计时' },
  { icon: '🚰', title: '水分告急！', desc: '再不喝水，你就要变成人干了！', btn: '喝完了，谢谢提醒' },
  { icon: '🫗', title: '补水时间到！', desc: '你上次喝水是什么时候？想不起来就对了！', btn: '这就去喝' },
]
const poopAlerts = [
  { icon: '💩', title: '拉屎预警！', desc: '你的肠道已经发来三条未读消息！', btn: '已处理，重置计时' },
  { icon: '🚽', title: '厕所在召唤你！', desc: '忍住不是本事，拉出来才是能力！', btn: '搞定了' },
  { icon: '🧻', title: '排毒时间到！', desc: '该去和马桶进行一次深入的交流了！', btn: '交流完毕' },
]

let pendingAlertType = null
let lastMenuDateKey = now.value.toDateString()

function triggerAlert(type) {
  const pool = type === 'water' ? waterAlerts : poopAlerts
  const data = pool[Math.floor(Math.random() * pool.length)]
  alertData.value = data
  pendingAlertType = type
  alertVisible.value = true
}

function dismissAlert() {
  alertVisible.value = false
  // 记录已弹过的时刻，避免同一小时重复弹
  if (pendingAlertType === 'water') {
    alertedWaterHour.value = new Date().getHours()
    sessionStorage.setItem('lp_alerted_water', alertedWaterHour.value)
  } else if (pendingAlertType === 'poop') {
    alertedPoopHour.value = new Date().getHours()
    sessionStorage.setItem('lp_alerted_poop', alertedPoopHour.value)
  }
  pendingAlertType = null
}

// --- 定时器 ---
let timer = null
onMounted(() => {
  loadTodayMenu()
  timer = setInterval(() => {
    now.value = new Date()
    const curH = now.value.getHours()
    const curM = now.value.getMinutes()
    const currentDateKey = now.value.toDateString()

    if (currentDateKey !== lastMenuDateKey) {
      lastMenuDateKey = currentDateKey
      loadTodayMenu()
    }

    // 喝水提醒：整点时刻前后5分钟内触发
    if (WATER_HOURS.includes(curH) && curM < 5 && alertedWaterHour.value !== curH && !alertVisible.value) {
      triggerAlert('water')
    }
    // 拉屎提醒：整点时刻前后10分钟内触发
    if (POOP_HOURS.includes(curH) && curM < 10 && alertedPoopHour.value !== curH && !alertVisible.value) {
      triggerAlert('poop')
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.life-progress-card {
  border-radius: 24px !important;
  overflow: hidden;
}

.lp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 8px;
}

.lp-header-left {
  flex: 1;
  min-width: 0;
}

.lp-settings-btn {
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.3s;
  font-size: 18px;
  padding: 4px;
}
.lp-settings-btn:hover {
  color: var(--primary-color);
}

.sidebar-switch-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.sidebar-switch-btn:hover {
  background: rgba(6, 182, 212, 0.15);
  color: var(--primary-color);
  border-color: var(--primary-color);
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.2);
}

.lp-settings {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.setting-input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.3s;
}
.setting-input-date {
  width: 130px;
}
.setting-input:focus {
  border-color: var(--primary-color);
}

.settings-slide-enter-active { transition: all 0.3s ease; }
.settings-slide-leave-active { transition: all 0.2s ease; }
.settings-slide-enter-from,
.settings-slide-leave-to { opacity: 0; max-height: 0; margin-bottom: 0; overflow: hidden; }
.settings-slide-enter-to,
.settings-slide-leave-from { opacity: 1; max-height: 80px; }

.lp-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.lp-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}

.icon-pulse {
  color: var(--primary-color);
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}

/* 进度条列表 */
.progress-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-item {
  transition: all 0.3s ease;
}

.progress-item.is-clickable {
  cursor: pointer;
}

.progress-item.is-clickable:hover {
  transform: translateY(-1px);
}

.progress-item.is-alert {
  animation: item-glow 1s ease-in-out infinite alternate;
}

@keyframes item-glow {
  from { background: transparent; }
  to { background: rgba(239, 68, 68, 0.08); border-radius: 8px; }
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.progress-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.progress-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.progress-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.value-alert {
  color: var(--accent-danger);
  animation: blink 0.8s ease-in-out infinite;
}

.value-warning {
  color: #f59e0b;
  animation: blink 1.2s ease-in-out infinite;
}

.value-success {
  color: #10b981;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 进度条轨道 */
.progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.fill-cyber {
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  box-shadow: 0 0 8px var(--primary-glow);
}

.fill-success {
  background: linear-gradient(90deg, #10b981, #34d399);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
  position: relative;
  overflow: hidden;
}
.fill-success::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s ease-in-out infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

.fill-warning {
  background: linear-gradient(90deg, #f59e0b, #f97316);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
  animation: warning-pulse 1.5s ease-in-out infinite alternate;
}

@keyframes warning-pulse {
  from { box-shadow: 0 0 6px rgba(245, 158, 11, 0.3); }
  to { box-shadow: 0 0 16px rgba(245, 158, 11, 0.6); }
}

.fill-alert-pulse {
  background: linear-gradient(90deg, #ef4444, #f97316);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
  animation: bar-pulse 1s ease-in-out infinite alternate;
}

/* 菜单弹窗 v2 */
.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}

.menu-popup {
  width: 340px;
  max-width: 92vw;
  max-height: 80vh;
  background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
  border: 1px solid var(--glass-border);
  border-radius: 18px;
  box-shadow: 0 0 30px rgba(6, 182, 212, 0.12), 0 8px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.menu-popup-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--glass-border);
}

.menu-popup-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.menu-popup-titles {
  flex: 1;
  min-width: 0;
}

.menu-popup-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.menu-popup-quip {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.menu-popup-close {
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.menu-popup-close:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.menu-popup-body {
  padding: 14px 18px 18px;
  overflow-y: auto;
}

.menu-meal-section {
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.menu-meal-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.menu-meal-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.menu-popup-fruit {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.menu-popup-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.menu-group-v2 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.menu-group-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.menu-group-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-right: 4px;
}

.menu-group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.menu-chip-v2 {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.2);
  font-size: 12px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.menu-chip-v2:hover {
  background: rgba(6, 182, 212, 0.2);
  border-color: rgba(6, 182, 212, 0.4);
}

.menu-empty-v2 {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
}

/* 菜单弹窗动画 */
.menu-pop-enter-active { transition: opacity 0.25s ease; }
.menu-pop-leave-active { transition: opacity 0.15s ease; }
.menu-pop-enter-from,
.menu-pop-leave-to { opacity: 0; }
.menu-pop-enter-active .menu-popup {
  animation: menu-scale-in 0.25s cubic-bezier(0.34, 1.4, 0.64, 1);
}
@keyframes menu-scale-in {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes bar-pulse {
  from { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
  to { box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
}

/* 弹窗过渡 */
.alert-fade-enter-active { transition: opacity 0.3s ease; }
.alert-fade-leave-active { transition: opacity 0.2s ease; }
.alert-fade-enter-from,
.alert-fade-leave-to { opacity: 0; }
</style>

<style>
/* Teleport 到 body 的样式不能 scoped */

/* 提醒弹窗 */
.timer-alert-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
}

.timer-alert-box {
  text-align: center;
  padding: 40px 48px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  box-shadow: 0 0 40px var(--primary-glow), 0 0 80px rgba(139, 92, 246, 0.2);
  animation: alert-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 400px;
}

@keyframes alert-pop {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.alert-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

.alert-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  text-shadow: 0 0 20px var(--primary-glow);
}

.alert-desc {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.alert-btn {
  padding: 10px 32px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.alert-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 24px var(--primary-glow);
}

.alert-fade-enter-active { transition: opacity 0.3s ease; }
.alert-fade-leave-active { transition: opacity 0.2s ease; }
.alert-fade-enter-from,
.alert-fade-leave-to { opacity: 0; }
</style>
