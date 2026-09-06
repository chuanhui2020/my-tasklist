// 身体成分指标计算
//
// 体脂率 + 骨骼肌让体重变化能被拆解成「掉的是脂肪还是肌肉」——
// 同样是掉 2kg，掉脂肪和掉肌肉是完全相反的两件事，这是 BMI 单独给不出的信息。
//
// 存储口径：体脂率为百分比数值(如 18.5)，骨骼肌为质量 kg。
// 部分体脂秤只显示骨骼肌率(%)，换算在录入时完成，见 muscleDisplayToKg。
// 所有派生指标都在前端算，不入库。

const round1 = (n) => Math.round(n * 10) / 10

// 记录里的成分字段可能是 null（历史数据 / 只有普通体重秤）
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export function fatMass(weight, bodyFat) {
  if (!isNum(weight) || !isNum(bodyFat) || weight <= 0 || bodyFat <= 0) return null
  return round1(weight * bodyFat / 100)
}

export function leanMass(weight, bodyFat) {
  const fat = fatMass(weight, bodyFat)
  if (fat === null) return null
  return round1(weight - fat)
}

export function musclePercent(weight, muscleKg) {
  if (!isNum(weight) || !isNum(muscleKg) || weight <= 0 || muscleKg <= 0) return null
  return round1(muscleKg / weight * 100)
}

// FFMI：去脂体重指数，可以理解为「去掉脂肪后的 BMI」。
// BMI 26 可能是胖子也可能是壮汉，FFMI 一眼分辨。
export function ffmi(weight, bodyFat, heightCm) {
  const lean = leanMass(weight, bodyFat)
  if (lean === null || !isNum(heightCm) || heightCm <= 0) return null
  const h = heightCm / 100
  return round1(lean / (h * h))
}

// 基础代谢率：Katch-McArdle 公式，基于去脂体重。
// 比常用的 Mifflin-St Jeor(身高/体重/年龄) 更准，前提正是有了体脂数据。
export function bmr(weight, bodyFat) {
  const lean = leanMass(weight, bodyFat)
  if (lean === null) return null
  return Math.round(370 + 21.6 * lean)
}

// 给记录补上派生字段，供图表和分解卡直接消费
export function deriveRecord(record) {
  return {
    ...record,
    fat_mass: fatMass(record.weight, record.body_fat),
    lean_mass: leanMass(record.weight, record.body_fat),
    muscle_pct: musclePercent(record.weight, record.skeletal_muscle),
  }
}

// ---------------------------------------------------------------------------
// 分级参考
//
// ⚠️ 不同品牌体脂秤的生物电阻抗算法差异很大，同一个人在两台秤上体脂率能差 3-5 个
// 百分点。这里的分级只用于给一个大致方位，真正有意义的是自身趋势。
// ---------------------------------------------------------------------------

// 体脂率分级：ACE 标准简化为四档，与 BMI 的四档 UI 对齐
const BODY_FAT_LEVELS = {
  male: [
    { key: 'under', label: '偏低', max: 10, rangeText: '< 10%' },
    { key: 'normal', label: '理想', max: 20, rangeText: '10 - 20%' },
    { key: 'over', label: '偏高', max: 25, rangeText: '20 - 25%' },
    { key: 'obese', label: '超标', max: Infinity, rangeText: '>= 25%' },
  ],
  female: [
    { key: 'under', label: '偏低', max: 18, rangeText: '< 18%' },
    { key: 'normal', label: '理想', max: 28, rangeText: '18 - 28%' },
    { key: 'over', label: '偏高', max: 32, rangeText: '28 - 32%' },
    { key: 'obese', label: '超标', max: Infinity, rangeText: '>= 32%' },
  ],
}

const PENDING_LEVEL = { key: 'pending', label: '待录入', rangeText: '' }

const pickLevel = (table, value, gender) => {
  if (!isNum(value) || value <= 0) return PENDING_LEVEL
  const levels = table[gender === 'female' ? 'female' : 'male']
  return levels.find(item => value < item.max) || levels[levels.length - 1]
}

export function getBodyFatLevel(bodyFat, gender) {
  return pickLevel(BODY_FAT_LEVELS, bodyFat, gender)
}

// 体脂率刻度条的量程与分档位置（按性别）
export function getBodyFatScale(gender) {
  const isMale = gender !== 'female'
  return {
    min: isMale ? 5 : 12,
    max: isMale ? 40 : 45,
    stops: isMale ? [10, 20, 25] : [18, 28, 32],
  }
}

const FFMI_LEVELS = {
  male: [
    { key: 'under', label: '偏低', max: 18 },
    { key: 'normal', label: '正常', max: 20 },
    { key: 'good', label: '良好', max: 22 },
    { key: 'great', label: '优秀', max: Infinity },
  ],
  female: [
    { key: 'under', label: '偏低', max: 14 },
    { key: 'normal', label: '正常', max: 16 },
    { key: 'good', label: '良好', max: 18 },
    { key: 'great', label: '优秀', max: Infinity },
  ],
}

export function getFfmiLevel(value, gender) {
  return pickLevel(FFMI_LEVELS, value, gender)
}

const MUSCLE_PCT_LEVELS = {
  male: [
    { key: 'under', label: '偏低', max: 33 },
    { key: 'normal', label: '正常', max: 39 },
    { key: 'great', label: '优秀', max: Infinity },
  ],
  female: [
    { key: 'under', label: '偏低', max: 25 },
    { key: 'normal', label: '正常', max: 31 },
    { key: 'great', label: '优秀', max: Infinity },
  ],
}

export function getMusclePctLevel(value, gender) {
  return pickLevel(MUSCLE_PCT_LEVELS, value, gender)
}

// ---------------------------------------------------------------------------
// 骨骼肌单位换算
//
// 库里统一存 kg。换算只发生在写入时——之后订正体重不会改写已存的 kg，
// 因为肌肉量不该因为体重记录的订正而变化，变的是展示出来的百分比。
// ---------------------------------------------------------------------------

export const MUSCLE_INPUT_RANGE = {
  kg: { min: 10, max: 80, step: 0.5 },
  pct: { min: 15, max: 60, step: 0.5 },
}

export function muscleKgToDisplay(kg, weight, unit) {
  if (!isNum(kg)) return null
  if (unit !== 'pct') return kg
  if (!isNum(weight) || weight <= 0) return null
  return round1(kg / weight * 100)
}

export function muscleDisplayToKg(value, weight, unit) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  if (unit !== 'pct') return round1(num)
  if (!isNum(weight) || weight <= 0) return null
  return round1(weight * num / 100)
}

// ---------------------------------------------------------------------------
// 成分变化分解
// ---------------------------------------------------------------------------

// 变化判定阈值：脂肪 0.5kg / 去脂体重 0.3kg 以内视为「没动」，
// 体脂秤本身的测量噪声就在这个量级。
const FAT_THRESHOLD = 0.5
const LEAN_THRESHOLD = 0.3

// 覆盖 {脂肪↓/持平/↑} × {去脂↓/持平/↑} 全部 9 种组合
function judgeChange(dFat, dLean) {
  const fatDown = dFat <= -FAT_THRESHOLD
  const fatUp = dFat >= FAT_THRESHOLD
  const leanDown = dLean <= -LEAN_THRESHOLD
  const leanUp = dLean >= LEAN_THRESHOLD

  if (fatDown && leanUp) {
    return { key: 'recomp', label: '减脂增肌', tone: 'best', desc: '脂肪下降的同时去脂体重还在涨，是最理想的变化。' }
  }
  if (fatDown && !leanDown) {
    return { key: 'cut', label: '优质减脂', tone: 'good', desc: '减掉的主要是脂肪，去脂体重基本保住了。' }
  }
  if (fatDown && leanDown) {
    return { key: 'cutLoss', label: '减脂但掉肌肉', tone: 'warn', desc: '脂肪在降，但去脂体重也跟着掉，注意蛋白质摄入和力量训练。' }
  }
  if (!fatUp && !fatDown && leanUp) {
    return { key: 'bulk', label: '增肌', tone: 'good', desc: '去脂体重上升而脂肪基本持平。' }
  }
  if (!fatUp && !fatDown && leanDown) {
    return { key: 'muscleLoss', label: '掉肌肉，需警惕', tone: 'warn', desc: '脂肪没怎么变，掉的是去脂体重，这不是理想的减重方式。' }
  }
  if (fatUp && leanUp) {
    return { key: 'gain', label: '脂肪与肌肉同增', tone: 'neutral', desc: '两者一起涨，增重期常见，可关注脂肪增幅是否偏大。' }
  }
  if (fatUp && leanDown) {
    return { key: 'worst', label: '长脂掉肌', tone: 'bad', desc: '脂肪上升且去脂体重下降，最需要调整的一种变化。' }
  }
  if (fatUp) {
    return { key: 'fatGain', label: '单纯增脂', tone: 'bad', desc: '增加的几乎全是脂肪，去脂体重没有变化。' }
  }
  return { key: 'flat', label: '变化不明显', tone: 'flat', desc: '这段时间体成分没有明显变化。' }
}

/**
 * 体重变化的成分拆解：Δ体重 = Δ体脂量 + Δ去脂体重。
 * 需要区间首末各有一条带体脂率的记录，否则返回 null。
 *
 * @param {Array} records 按日期升序的记录数组
 */
export function assessRecomposition(records) {
  if (!Array.isArray(records)) return null
  const usable = records.filter(r => fatMass(r.weight, r.body_fat) !== null)
  if (usable.length < 2) return null

  const first = usable[0]
  const last = usable[usable.length - 1]

  const start = {
    date: first.date,
    weight: first.weight,
    fat: fatMass(first.weight, first.body_fat),
    lean: leanMass(first.weight, first.body_fat),
    bodyFat: first.body_fat,
  }
  const end = {
    date: last.date,
    weight: last.weight,
    fat: fatMass(last.weight, last.body_fat),
    lean: leanMass(last.weight, last.body_fat),
    bodyFat: last.body_fat,
  }

  const dFat = round1(end.fat - start.fat)
  const dLean = round1(end.lean - start.lean)

  return {
    start,
    end,
    count: usable.length,
    spanDays: Math.max(0, Math.round((new Date(end.date) - new Date(start.date)) / 86400000)),
    dWeight: round1(end.weight - start.weight),
    dFat,
    dLean,
    dBodyFat: round1(end.bodyFat - start.bodyFat),
    verdict: judgeChange(dFat, dLean),
  }
}
