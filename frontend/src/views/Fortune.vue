<template>
    <div class="fortune-wrapper">
        <!-- Background decorations -->
        <div class="background-patterns">
            <div class="pattern pattern-1"></div>
            <div class="pattern pattern-2"></div>
        </div>

        <el-card class="fortune-card">
            <template #header>
                <div class="fortune-header">
                    <div class="header-icon">🎋</div>
                    <div>
                        <h2 class="fortune-title">靈籤占卜</h2>
                        <p class="fortune-subtitle">誠心祈願，靜待天機</p>
                    </div>
                </div>
            </template>

            <div class="fortune-content">
                <!-- 签筒和签子 SVG -->
                <div class="fortune-scene" :class="{ shaking: isShaking }">
                    <svg viewBox="0 0 400 500" class="fortune-svg">
                        <!-- 签筒 -->
                        <defs>
                            <linearGradient id="tubeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:#8B4513;stop-opacity:1" />
                                <stop offset="50%" style="stop-color:#A0522D;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#654321;stop-opacity:1" />
                            </linearGradient>
                            <linearGradient id="stickGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style="stop-color:#D2691E;stop-opacity:1" />
                                <stop offset="50%" style="stop-color:#F4A460;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#D2691E;stop-opacity:1" />
                            </linearGradient>
                            <radialGradient id="glowGradient">
                                <stop offset="0%" style="stop-color:#FFD700;stop-opacity:0.6" />
                                <stop offset="100%" style="stop-color:#FFD700;stop-opacity:0" />
                            </radialGradient>
                        </defs>

                        <!-- 底座光晕 -->
                        <ellipse cx="200" cy="420" rx="80" ry="15" fill="url(#glowGradient)" opacity="0.5" />

                        <!-- 签筒主体 -->
                        <g class="tube-container">
                            <!-- 筒身 -->
                            <rect x="120" y="200" width="160" height="200" rx="10" fill="url(#tubeGradient)" />
                            <rect x="125" y="205" width="150" height="190" rx="8" fill="#654321" opacity="0.3" />

                            <!-- 筒口 -->
                            <ellipse cx="200" cy="200" rx="80" ry="20" fill="#A0522D" />
                            <ellipse cx="200" cy="200" rx="70" ry="15" fill="#654321" />

                            <!-- 筒底 -->
                            <ellipse cx="200" cy="400" rx="80" ry="20" fill="#654321" />

                            <!-- 装饰纹路 -->
                            <line x1="140" y1="220" x2="140" y2="380" stroke="#FFD700" stroke-width="1" opacity="0.4" />
                            <line x1="260" y1="220" x2="260" y2="380" stroke="#FFD700" stroke-width="1" opacity="0.4" />
                            <text x="200" y="310" text-anchor="middle" fill="#FFD700" font-size="24"
                                font-family="KaiTi, serif" opacity="0.6">籤</text>
                        </g>

                        <!-- 签子们（在筒内） -->
                        <g class="sticks-container">
                            <rect v-for="i in 8" :key="i" :x="170 + (i % 4) * 15" :y="210 + Math.floor(i / 4) * 10"
                                width="8" height="120" rx="2" fill="url(#stickGradient)" opacity="0.8"
                                :class="{ 'stick-falling': isFalling && i === fallingStickIndex }" />
                        </g>

                        <!-- 掉落的签子 -->
                        <g v-if="isFalling" class="falling-stick">
                            <rect :x="fallingStickX" :y="fallingStickY" width="10" height="140" rx="3"
                                fill="url(#stickGradient)"
                                :transform="`rotate(${fallingStickRotation} ${fallingStickX + 5} ${fallingStickY + 70})`" />
                            <text :x="fallingStickX + 5" :y="fallingStickY + 75" text-anchor="middle" fill="#8B0000"
                                font-size="12" font-family="KaiTi, serif" font-weight="bold"
                                :transform="`rotate(${fallingStickRotation} ${fallingStickX + 5} ${fallingStickY + 70})`">{{
                                    fortuneNumber }}</text>
                        </g>
                    </svg>
                </div>

                <!-- 控制按钮 -->
                <div class="fortune-actions" v-if="!showResult">
                    <el-button type="primary" size="large" :loading="isShaking || isGenerating"
                        :disabled="alreadyDrawn" @click="startFortune" class="draw-button">
                        <span v-if="alreadyDrawn">🚫 今日已求籤</span>
                        <span v-else-if="!isShaking && !isGenerating">🙏 誠心求籤</span>
                        <span v-else-if="isShaking">🎋 搖籤中...</span>
                        <span v-else>📜 解籤中...</span>
                    </el-button>
                </div>

                <!-- 签文展示 -->
                <transition name="fortune-reveal">
                    <div v-if="showResult" class="fortune-result">
                        <div class="result-card">
                            <div class="result-header">
                                <div class="result-number">第 {{ fortuneNumber }} 籤</div>
                                <div class="result-type" :class="fortuneData.type">{{ fortuneData.typeText }}</div>
                            </div>

                            <div class="result-content">
                                <div class="result-poem">
                                    <div class="poem-title">【籤詩】</div>
                                    <div class="poem-text" v-html="formatPoem(fortuneData.poem)"></div>
                                </div>

                                <div class="result-interpretation">
                                    <div class="interpretation-title">【解籤】</div>
                                    <div class="interpretation-text">{{ fortuneData.interpretation }}</div>
                                </div>

                                <div class="result-advice">
                                    <div class="advice-title">【指引】</div>
                                    <div class="advice-items">
                                        <div v-for="(item, index) in fortuneData.advice" :key="index"
                                            class="advice-item">
                                            <span class="advice-label">{{ item.label }}：</span>
                                            <span class="advice-value">{{ item.value }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <el-button v-if="!alreadyDrawn" type="primary" plain @click="reset" class="reset-button">
                                🔄 重新求籤
                            </el-button>
                        </div>
                    </div>
                </transition>
            </div>
        </el-card>

        <!-- 历史记录 -->
        <el-card v-if="historyRecords.length > 0" class="fortune-card history-card">
            <template #header>
                <div class="fortune-header">
                    <div class="header-icon">📜</div>
                    <div>
                        <h2 class="fortune-title">求籤記錄</h2>
                        <p class="fortune-subtitle">最近十次靈籤記錄</p>
                    </div>
                </div>
            </template>

            <div class="history-list">
                <div v-for="record in historyRecords" :key="record.id" class="history-item"
                    :class="{ expanded: expandedId === record.id }" @click="toggleExpand(record.id)">
                    <div class="history-summary">
                        <span class="history-date">{{ formatDate(record.created_at) }}</span>
                        <span class="history-number">第 {{ record.fortuneNumber }} 籤</span>
                        <span class="result-type history-badge" :class="record.type">{{ record.typeText }}</span>
                        <span class="history-poem-preview">{{ record.poem.slice(0, 20) }}…</span>
                        <span class="history-arrow">{{ expandedId === record.id ? '▲' : '▼' }}</span>
                    </div>
                    <transition name="expand">
                        <div v-if="expandedId === record.id" class="history-detail">
                            <div class="result-poem">
                                <div class="poem-title">【籤詩】</div>
                                <div class="poem-text" v-html="formatPoem(record.poem)"></div>
                            </div>
                            <div class="result-interpretation">
                                <div class="interpretation-title">【解籤】</div>
                                <div class="interpretation-text">{{ record.interpretation }}</div>
                            </div>
                            <div class="result-advice">
                                <div class="advice-title">【指引】</div>
                                <div class="advice-items">
                                    <div v-for="(item, idx) in record.advice" :key="idx" class="advice-item">
                                        <span class="advice-label">{{ item.label }}：</span>
                                        <span class="advice-value">{{ item.value }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>
        </el-card>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const isShaking = ref(false)
const isFalling = ref(false)
const isGenerating = ref(false)
const showResult = ref(false)
const alreadyDrawn = ref(false)
const fortuneNumber = ref(1)
const fallingStickIndex = ref(3)
const fallingStickX = ref(195)
const fallingStickY = ref(220)
const fallingStickRotation = ref(0)
const expandedId = ref(null)
const historyRecords = ref([])

const fortuneData = ref({
    type: 'great',
    typeText: '上上籤',
    poem: '',
    interpretation: '',
    advice: []
})

// 格式化诗文（添加换行）
const formatPoem = (poem) => {
    return poem.replace(/，/g, '，<br>').replace(/。/g, '。<br>')
}

const formatDate = (dateStr) => {
    return dateStr.slice(0, 10)
}

const toggleExpand = (id) => {
    expandedId.value = expandedId.value === id ? null : id
}

// 加载今日签文和历史
const loadData = async () => {
    try {
        const [todayRes, historyRes] = await Promise.all([
            api.getTodayFortune(),
            api.getFortuneHistory()
        ])

        if (todayRes.data.drawn) {
            alreadyDrawn.value = true
            fortuneData.value = todayRes.data.data
            fortuneNumber.value = todayRes.data.data.fortuneNumber
            showResult.value = true
        }

        historyRecords.value = historyRes.data.records || []
    } catch (e) {
        // silent — page still usable
    }
}

onMounted(loadData)

// 生成签文 - 调用后端 AI API
const generateFortune = async (number) => {
    isGenerating.value = true

    try {
        const response = await api.generateFortune(number)

        if (response.data.success) {
            fortuneData.value = response.data.data
            alreadyDrawn.value = true
            // Refresh history
            const historyRes = await api.getFortuneHistory()
            historyRecords.value = historyRes.data.records || []
        } else {
            throw new Error(response.data.error || '生成签文失败')
        }

    } catch (error) {
        if (error.response?.status === 429) {
            // Already drawn today
            alreadyDrawn.value = true
            const data = error.response.data?.data
            if (data) {
                fortuneData.value = data
                fortuneNumber.value = data.fortuneNumber
                showResult.value = true
            }
            ElMessage.warning('今日已求過籤，每日僅可求籤一次')
            return
        }

        ElMessage.error('求籤失敗，請重試')

        // 如果 API 失败，使用备用数据
        fortuneData.value = {
            type: 'medium',
            typeText: '中籤',
            poem: '雲開見月明，守得花開時，耐心待時機，好運必相隨。',
            interpretation: '此籤暗示需要等待時機，不宜急進。當前雖有困頓，但守得雲開見月明，耐心等待必有收穫。',
            advice: [
                { label: '事業', value: '穩中求進，切勿冒進' },
                { label: '財運', value: '量入為出，理財有道' },
                { label: '感情', value: '耐心等待，緣分自來' },
                { label: '健康', value: '規律作息，身心安康' }
            ]
        }
    } finally {
        isGenerating.value = false
    }
}

// 开始抽签
const startFortune = async () => {
    if (alreadyDrawn.value) return

    // 生成随机签号
    fortuneNumber.value = Math.floor(Math.random() * 100) + 1
    fallingStickIndex.value = Math.floor(Math.random() * 8)

    // 开始摇晃
    isShaking.value = true

    // 摇晃 2 秒后掉落
    setTimeout(() => {
        isShaking.value = false
        isFalling.value = true
        animateFalling()
    }, 2000)

    // 同时生成签文
    await generateFortune(fortuneNumber.value)
}

// 签子掉落动画
const animateFalling = () => {
    let progress = 0
    const duration = 1500
    const startTime = Date.now()

    const animate = () => {
        const elapsed = Date.now() - startTime
        progress = Math.min(elapsed / duration, 1)

        // 抛物线运动
        fallingStickY.value = 220 + progress * 200
        fallingStickX.value = 195 + Math.sin(progress * Math.PI) * 30
        fallingStickRotation.value = progress * 360

        if (progress < 1) {
            requestAnimationFrame(animate)
        } else {
            // 掉落完成，显示结果
            setTimeout(() => {
                showResult.value = true
                isFalling.value = false
            }, 500)
        }
    }

    animate()
}

// 重置
const reset = () => {
    showResult.value = false
    isFalling.value = false
    isShaking.value = false
    isGenerating.value = false
    fallingStickX.value = 195
    fallingStickY.value = 220
    fallingStickRotation.value = 0
}
</script>

<style scoped>
.fortune-wrapper {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
    position: relative;
}

.background-patterns {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
}

.pattern {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.3;
}

.pattern-1 {
    top: 10%;
    left: 20%;
    width: 300px;
    height: 300px;
    background: linear-gradient(135deg, #FFD700, #FF6B6B);
    animation: float 8s ease-in-out infinite;
}

.pattern-2 {
    bottom: 10%;
    right: 20%;
    width: 400px;
    height: 400px;
    background: linear-gradient(135deg, #8B4513, #D2691E);
    animation: float 10s ease-in-out infinite reverse;
}

@keyframes float {

    0%,
    100% {
        transform: translate(0, 0) rotate(0deg);
    }

    50% {
        transform: translate(30px, -30px) rotate(5deg);
    }
}

.fortune-card {
    background: var(--bg-glass) !important;
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border) !important;
    border-radius: 24px;
    box-shadow: var(--shadow-lg) !important;
}

.fortune-header {
    display: flex;
    align-items: center;
    gap: 16px;
}

.header-icon {
    font-size: 48px;
    filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5));
}

.fortune-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-family: 'KaiTi', serif;
}

.fortune-subtitle {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 4px 0 0 0;
    font-family: 'KaiTi', serif;
}

.fortune-content {
    padding: 20px 0;
}

.fortune-scene {
    max-width: 400px;
    margin: 0 auto 40px;
    transition: transform 0.1s ease;
}

.fortune-scene.shaking {
    animation: shake 0.15s infinite;
}

@keyframes shake {

    0%,
    100% {
        transform: translateX(0) rotate(0deg);
    }

    25% {
        transform: translateX(-5px) rotate(-2deg);
    }

    75% {
        transform: translateX(5px) rotate(2deg);
    }
}

.fortune-svg {
    width: 100%;
    height: auto;
    filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.3));
}

.stick-falling {
    opacity: 0 !important;
}

.fortune-actions {
    text-align: center;
    margin: 40px 0;
}

.draw-button {
    font-size: 18px;
    padding: 16px 48px;
    height: auto;
    border-radius: 12px;
    background: linear-gradient(135deg, #FFD700, #FFA500) !important;
    border: none !important;
    color: #8B4513 !important;
    font-weight: 700;
    font-family: 'KaiTi', serif;
    box-shadow: 0 8px 20px rgba(255, 215, 0, 0.4);
    transition: all 0.3s ease;
}

.draw-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(255, 215, 0, 0.6);
}

.draw-button:active {
    transform: translateY(0);
}

/* 签文展示 */
.fortune-reveal-enter-active {
    animation: revealFortune 0.8s ease-out;
}

@keyframes revealFortune {
    0% {
        opacity: 0;
        transform: scale(0.8) translateY(30px);
    }

    100% {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.fortune-result {
    margin-top: 40px;
}

.result-card {
    background: linear-gradient(135deg, rgba(139, 69, 19, 0.1), rgba(210, 105, 30, 0.05));
    border: 2px solid rgba(255, 215, 0, 0.3);
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 8px 32px rgba(255, 215, 0, 0.2);
}

.result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 2px solid rgba(255, 215, 0, 0.2);
}

.result-number {
    font-size: 24px;
    font-weight: 700;
    color: #FFD700;
    font-family: 'KaiTi', serif;
}

.result-type {
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 16px;
    font-weight: 700;
    font-family: 'KaiTi', serif;
}

.result-type.great {
    background: linear-gradient(135deg, #FFD700, #FFA500);
    color: #8B4513;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
}

.result-type.good {
    background: linear-gradient(135deg, #90EE90, #32CD32);
    color: #006400;
    box-shadow: 0 4px 15px rgba(144, 238, 144, 0.4);
}

.result-type.medium {
    background: linear-gradient(135deg, #87CEEB, #4682B4);
    color: #00008B;
    box-shadow: 0 4px 15px rgba(135, 206, 235, 0.4);
}

.result-type.fair {
    background: linear-gradient(135deg, #FFB6C1, #FF69B4);
    color: #8B008B;
    box-shadow: 0 4px 15px rgba(255, 182, 193, 0.4);
}

.result-type.poor {
    background: linear-gradient(135deg, #D3D3D3, #A9A9A9);
    color: #2F4F4F;
    box-shadow: 0 4px 15px rgba(211, 211, 211, 0.4);
}

.result-content {
    display: flex;
    flex-direction: column;
    gap: 28px;
}

.result-poem,
.result-interpretation,
.result-advice {
    background: rgba(255, 255, 255, 0.03);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid rgba(255, 215, 0, 0.1);
}

.poem-title,
.interpretation-title,
.advice-title {
    font-size: 18px;
    font-weight: 700;
    color: #FFD700;
    margin-bottom: 16px;
    font-family: 'KaiTi', serif;
}

.poem-text {
    font-size: 20px;
    line-height: 2;
    color: var(--text-primary);
    font-family: 'KaiTi', serif;
    text-align: center;
    padding: 16px;
    background: rgba(139, 69, 19, 0.1);
    border-radius: 8px;
    border-left: 4px solid #FFD700;
}

.interpretation-text {
    font-size: 16px;
    line-height: 1.8;
    color: var(--text-secondary);
    font-family: 'KaiTi', serif;
    text-indent: 2em;
}

.advice-items {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

.advice-item {
    padding: 12px;
    background: rgba(255, 215, 0, 0.05);
    border-radius: 8px;
    border-left: 3px solid #FFD700;
}

.advice-label {
    font-weight: 700;
    color: #FFD700;
    font-family: 'KaiTi', serif;
}

.advice-value {
    color: var(--text-secondary);
    font-family: 'KaiTi', serif;
}

.reset-button {
    width: 100%;
    margin-top: 32px;
    height: 48px;
    font-size: 16px;
    font-family: 'KaiTi', serif;
    border-radius: 12px;
    background: transparent !important;
    border: 2px solid #FFD700 !important;
    color: #FFD700 !important;
}

.reset-button:hover {
    background: rgba(255, 215, 0, 0.1) !important;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255, 215, 0, 0.3);
}

@media (max-width: 768px) {
    .fortune-wrapper {
        padding: 20px 16px;
    }

    .result-card {
        padding: 20px;
    }

    .poem-text {
        font-size: 18px;
    }

    .advice-items {
        grid-template-columns: 1fr;
    }

    .history-summary {
        flex-wrap: wrap;
        gap: 8px;
    }
}

/* History card */
.history-card {
    margin-top: 24px;
}

.history-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.history-item {
    background: linear-gradient(135deg, rgba(139, 69, 19, 0.08), rgba(210, 105, 30, 0.04));
    border: 1px solid rgba(255, 215, 0, 0.2);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.history-item:hover {
    border-color: rgba(255, 215, 0, 0.4);
    box-shadow: 0 4px 16px rgba(255, 215, 0, 0.15);
}

.history-item.expanded {
    border-color: rgba(255, 215, 0, 0.5);
}

.history-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'KaiTi', serif;
}

.history-date {
    color: var(--text-secondary);
    font-size: 14px;
    min-width: 90px;
}

.history-number {
    color: #FFD700;
    font-weight: 700;
    font-size: 15px;
    min-width: 70px;
}

.history-badge {
    font-size: 12px;
    padding: 4px 12px;
}

.history-poem-preview {
    color: var(--text-secondary);
    font-size: 14px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.history-arrow {
    color: rgba(255, 215, 0, 0.6);
    font-size: 12px;
    margin-left: auto;
}

.history-detail {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 215, 0, 0.15);
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.expand-enter-active,
.expand-leave-active {
    transition: all 0.3s ease;
    overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
    opacity: 0;
    max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
    opacity: 1;
    max-height: 800px;
}
</style>
