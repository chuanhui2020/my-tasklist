import { ref } from 'vue'
import api from '@/api'

const alerts = ref([])
const dismissed = new Set()
const notified = new Set()
let pollTimer = null
let started = false

const levelText = { normal: '普通提醒', urgent: '紧急提醒', crazy: '疯狂提醒' }

function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function sendNotification(item) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (notified.has(item.id)) return
  notified.add(item.id)

  const n = new Notification(`⏰ ${levelText[item.remind_level] || '提醒'}`, {
    body: item.title,
    icon: '/favicon.ico',
    tag: `countdown-${item.id}`,
    requireInteraction: item.remind_level === 'crazy'
  })
  n.onclick = () => {
    window.focus()
    n.close()
  }
}

export function useCountdownAlert() {
  async function poll() {
    try {
      const { data } = await api.getUpcomingCountdowns()
      const now = Date.now()
      const filtered = data.filter(a => {
        if (dismissed.has(a.id)) return false
        const target = new Date(a.target_time.replace(' ', 'T')).getTime()
        const remindStart = target - a.remind_before * 60 * 1000
        return now >= remindStart
      })
      for (const item of filtered) {
        sendNotification(item)
      }
      alerts.value = filtered
    } catch {
      // silent
    }
  }

  async function dismiss(id) {
    dismissed.add(id)
    alerts.value = alerts.value.filter(a => a.id !== id)
    try {
      await api.dismissCountdown(id)
    } catch {
      // silent
    }
  }

  function start() {
    if (started) return
    started = true
    requestPermission()
    poll()
    pollTimer = setInterval(poll, 30000)
  }

  function stop() {
    started = false
    clearInterval(pollTimer)
    pollTimer = null
  }

  return { alerts, dismiss, start, stop }
}
