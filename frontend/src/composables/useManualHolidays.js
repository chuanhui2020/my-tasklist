import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const formatDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatForLabel = (date) => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(date)
}

const formatDayNumber = (dateString) => Number(dateString.split('-')[2])

export function useManualHolidays(initialDate = new Date()) {
  const calendarDate = ref(new Date(initialDate))
  const manualHolidayCache = reactive({})

  const selectedDateString = computed(() => formatDateString(calendarDate.value))
  const selectedDateLabel = computed(() => formatForLabel(calendarDate.value))

  const manualHolidayList = computed(() => {
    const year = calendarDate.value.getFullYear()
    const set = manualHolidayCache[year]
    return set ? Array.from(set).sort() : []
  })

  const isManualHoliday = (dateString) => {
    const year = Number(dateString.slice(0, 4))
    const set = manualHolidayCache[year]
    return set ? set.has(dateString) : false
  }

  const manualHolidayActive = computed(() => isManualHoliday(selectedDateString.value))

  const ensureManualHolidays = async (year) => {
    if (manualHolidayCache[year]) {
      return
    }
    try {
      const response = await api.getManualHolidays({ year })
      manualHolidayCache[year] = new Set(response.data.map(item => item.date))
    } catch (error) {
      console.error('加载自定义公共假日失败:', error)
      delete manualHolidayCache[year]
    }
  }

  const updateManualHolidaySet = (year, updater) => {
    const current = manualHolidayCache[year] ? new Set(manualHolidayCache[year]) : new Set()
    updater(current)
    manualHolidayCache[year] = current
  }

  const handleManualHolidayToggle = async () => {
    const year = calendarDate.value.getFullYear()
    await ensureManualHolidays(year)
    try {
      if (manualHolidayActive.value) {
        await api.removeManualHoliday(selectedDateString.value)
        updateManualHolidaySet(year, (set) => set.delete(selectedDateString.value))
        ElMessage.success('已取消该日期的公共假日标记')
      } else {
        await api.addManualHoliday(selectedDateString.value)
        updateManualHolidaySet(year, (set) => set.add(selectedDateString.value))
        ElMessage.success('已标记为公共假日')
      }
    } catch (error) {
      console.error('更新自定义公共假日失败:', error)
      ElMessage.error('操作失败，请稍后重试')
    }
  }

  const handleDateSelect = (dayString) => {
    calendarDate.value = new Date(dayString)
  }

  const handlePanelChange = (date) => {
    if (date instanceof Date) {
      ensureManualHolidays(date.getFullYear())
    }
  }

  const initManualHolidays = async () => {
    await ensureManualHolidays(calendarDate.value.getFullYear())
  }

  watch(calendarDate, (newDate) => {
    ensureManualHolidays(newDate.getFullYear())
  })

  return {
    calendarDate,
    selectedDateLabel,
    manualHolidayList,
    manualHolidayActive,
    formatDayNumber,
    isManualHoliday,
    handleManualHolidayToggle,
    handleDateSelect,
    handlePanelChange,
    initManualHolidays
  }
}
