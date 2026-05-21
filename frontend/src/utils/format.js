export function formatMoney(val) {
  if (val == null) return '0'
  if (Math.abs(val) >= 10000) return (val / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return val.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
