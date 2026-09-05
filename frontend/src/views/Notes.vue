<template>
  <div class="notes-page">
    <header class="page-header">
      <div class="page-heading">
        <h2 class="page-title">笔记本</h2>
        <p class="page-subtitle">把重要的事和文件放在一处，随时找得到</p>
      </div>
      <div v-if="!loading && total" class="page-stats">
        <span class="stat">
          <el-icon><Notebook /></el-icon>{{ hasFilter ? `匹配 ${total} 条` : `共 ${total} 条笔记` }}
        </span>
        <span v-if="notes.length < total" class="stat">已加载 {{ notes.length }}</span>
      </div>
    </header>

    <div class="toolbar">
      <el-input
        v-model="search"
        class="search-input"
        placeholder="搜索标题、正文或标签…"
        clearable
        :prefix-icon="Search"
        aria-label="搜索笔记"
      />
      <el-button type="primary" class="create-btn" @click="openCreate">
        <el-icon class="btn-icon"><Plus /></el-icon>新建笔记
      </el-button>
    </div>

    <nav v-if="allTags.length" class="tag-bar" aria-label="按标签筛选">
      <button
        type="button"
        class="tag-pill"
        :class="{ 'is-active': !activeTag }"
        :aria-pressed="!activeTag"
        @click="setTag('')"
      >
        全部
      </button>
      <button
        v-for="tag in allTags"
        :key="tag.name"
        type="button"
        class="tag-pill"
        :class="{ 'is-active': activeTag === tag.name }"
        :aria-pressed="activeTag === tag.name"
        @click="setTag(tag.name)"
      >
        #{{ tag.name }}<span class="tag-count">{{ tag.count }}</span>
      </button>
    </nav>

    <div v-if="loading" class="notes-grid" aria-busy="true">
      <div v-for="i in 6" :key="i" class="skeleton skeleton-note"></div>
    </div>

    <template v-else-if="notes.length">
      <section v-if="pinnedNotes.length" class="notes-section">
        <h3 class="section-title">
          <el-icon class="section-icon is-pinned"><StarFilled /></el-icon>置顶
          <span class="section-count">{{ pinnedNotes.length }}</span>
        </h3>
        <div class="notes-grid">
          <NoteCard
            v-for="(note, index) in pinnedNotes"
            :key="note.id"
            :note="note"
            class="note-enter"
            :style="{ '--i': Math.min(index, 8) }"
            @open="openViewer"
            @edit="openEdit"
            @delete="handleDelete"
            @toggle-pin="togglePin"
          />
        </div>
      </section>

      <section v-if="normalNotes.length" class="notes-section">
        <h3 v-if="pinnedNotes.length" class="section-title">
          <el-icon class="section-icon"><Notebook /></el-icon>其他笔记
          <span class="section-count">{{ normalNotes.length }}</span>
        </h3>
        <div class="notes-grid">
          <NoteCard
            v-for="(note, index) in normalNotes"
            :key="note.id"
            :note="note"
            class="note-enter"
            :style="{ '--i': Math.min(index, 8) }"
            @open="openViewer"
            @edit="openEdit"
            @delete="handleDelete"
            @toggle-pin="togglePin"
          />
        </div>
      </section>
      <div v-if="notes.length < total" class="load-more">
        <el-button :loading="loadingMore" @click="loadMore">
          加载更多（还有 {{ total - notes.length }} 条）
        </el-button>
      </div>
    </template>

    <!-- 空态分两种：库里本来就没有 vs 筛选没筛出来，给的下一步动作不一样 -->
    <div v-else-if="hasFilter" class="empty-state">
      <el-icon class="empty-icon"><Search /></el-icon>
      <p class="empty-title">没有找到匹配的笔记</p>
      <p class="empty-hint">
        试试换个关键词{{ activeTag ? `，或者取消「#${activeTag}」标签筛选` : '' }}。
      </p>
      <el-button @click="clearFilters">清除筛选条件</el-button>
    </div>

    <div v-else class="empty-state">
      <el-icon class="empty-icon"><Notebook /></el-icon>
      <p class="empty-title">还没有任何笔记</p>
      <p class="empty-hint">记录一段文字，或者把重要的证件、合同、报销单传上来存着。</p>
      <el-button type="primary" @click="openCreate">
        <el-icon class="btn-icon"><Plus /></el-icon>写第一条笔记
      </el-button>
    </div>

    <NoteViewerDialog
      :visible="viewerVisible"
      :note="activeNote"
      @close="viewerVisible = false"
      @edit="editFromViewer"
    />

    <NoteEditorDialog
      :visible="editorVisible"
      :note="editingNote"
      :existing-tags="tagNames"
      @close="editorVisible = false"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Plus, Notebook, StarFilled } from '@element-plus/icons-vue'
import NoteCard from '@/components/notes/NoteCard.vue'
import NoteViewerDialog from '@/components/notes/NoteViewerDialog.vue'
import NoteEditorDialog from '@/components/notes/NoteEditorDialog.vue'
import api from '@/api'
// 弹窗的暗色主题：EP 默认浅色，不覆盖的话弹窗是白底、里面的浅色文字全看不见
import '@/assets/note-dialog.css'

// 与后端 DEFAULT_PAGE_SIZE 保持一致
const PAGE_SIZE = 24

const route = useRoute()
const router = useRouter()

const notes = ref([])
const allTags = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)
// 直接用 URL 上的筛选条件初始化：放到 onMounted 里赋值会触发 search 的 watcher，
// 多打一次防抖请求
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const activeTag = ref(typeof route.query.tag === 'string' ? route.query.tag : '')

const viewerVisible = ref(false)
const editorVisible = ref(false)
const activeNote = ref(null)
const editingNote = ref(null)

const hasFilter = computed(() => !!search.value.trim() || !!activeTag.value)
const pinnedNotes = computed(() => notes.value.filter(n => n.pinned))
const normalNotes = computed(() => notes.value.filter(n => !n.pinned))
const tagNames = computed(() => allTags.value.map(t => t.name))

// 搜索防抖期间旧请求可能后返回，用 controller 身份比对丢弃过期结果
let activeController = null

// silent：增删改之后的刷新走这条路，不亮骨架屏，否则每次保存整页都会闪一下
// append：加载更多，结果接在后面并推进页码；非 append 一律回到第一页。
// 页码只在请求成功后才推进，失败重试不会跳页、也就不会漏掉中间一段。
const fetchNotes = async ({ silent = false, append = false } = {}) => {
  activeController?.abort()
  const controller = new AbortController()
  activeController = controller
  const targetPage = append ? page.value + 1 : 1
  if (append) loadingMore.value = true
  else if (!silent) loading.value = true
  try {
    const { data } = await api.getNotes({
      q: search.value.trim() || undefined,
      tag: activeTag.value || undefined,
      page: targetPage,
      page_size: PAGE_SIZE,
    }, { signal: controller.signal })
    if (activeController !== controller) return
    notes.value = append ? [...notes.value, ...data.items] : data.items
    page.value = targetPage
    allTags.value = data.all_tags
    total.value = data.total
  } catch (error) {
    if (!controller.signal.aborted) console.error('加载笔记失败:', error)
  } finally {
    if (activeController === controller) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

const loadMore = () => fetchNotes({ append: true })

// 筛选条件写进 URL，刷新和分享都能还原当前视图
const syncQuery = () => {
  const query = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (activeTag.value) query.tag = activeTag.value
  router.replace({ query })
}

// 所有筛选变化都汇到这一个定时器上：输入框防抖 280ms，点标签/清空立即触发。
// 走同一条路径才不会出现「手动 fetch 一次 + watcher 再补一次」的重复请求。
let searchTimer = null
const scheduleFetch = (delay) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    syncQuery()
    fetchNotes()
  }, delay)
}

watch(search, () => scheduleFetch(280))

const setTag = (tag) => {
  if (activeTag.value === tag) return
  activeTag.value = tag
  scheduleFetch(0)
}

const clearFilters = () => {
  search.value = ''
  activeTag.value = ''
  scheduleFetch(0)
}

const openCreate = () => {
  editingNote.value = null
  editorVisible.value = true
}

const openEdit = (note) => {
  editingNote.value = note
  editorVisible.value = true
}

const openViewer = (note) => {
  activeNote.value = note
  viewerVisible.value = true
}

const editFromViewer = (note) => {
  viewerVisible.value = false
  openEdit(note)
}

const handleSaved = (saved) => {
  const index = notes.value.findIndex(n => n.id === saved.id)
  if (index !== -1) {
    // 先就地替换，界面立刻反映改动；重取只是为了同步排序和标签计数
    notes.value[index] = saved
    if (activeNote.value?.id === saved.id) activeNote.value = saved
  }
  fetchNotes({ silent: true })
}

const togglePin = async (note) => {
  const next = !note.pinned
  note.pinned = next
  try {
    await api.pinNote(note.id, next)
  } catch {
    note.pinned = !next
  }
}

const handleDelete = async (note) => {
  try {
    await api.deleteNote(note.id)
    notes.value = notes.value.filter(n => n.id !== note.id)
    if (activeNote.value?.id === note.id) viewerVisible.value = false
    ElMessage.success('笔记已删除')
    fetchNotes({ silent: true })
  } catch (error) {
    console.error('删除笔记失败:', error)
  }
}

onMounted(fetchNotes)

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  activeController?.abort()
})
</script>

<style scoped>
.notes-page {
  max-width: 1180px;
  margin: 0 auto;
}

/* === Header === */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  background: linear-gradient(to right, #fff, var(--text-secondary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.page-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
}

.page-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--glass-border);
  font-variant-numeric: tabular-nums;
}

/* === Toolbar === */
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.search-input {
  flex: 1;
  max-width: 420px;
}

.search-input :deep(.el-input__wrapper) {
  height: 40px;
  border-radius: 10px;
}

.create-btn {
  height: 40px;
  border-radius: 10px;
  padding: 0 18px;
  flex-shrink: 0;
}

.btn-icon {
  margin-right: 5px;
}

/* === Tag filter === */
.tag-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 22px;
  padding-bottom: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tag-bar::-webkit-scrollbar {
  display: none;
}

.tag-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  flex-shrink: 0;
  border-radius: 15px;
  border: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.03);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

/* 视觉 30px，点击区补到 44px 高，指头点得中 */
.tag-pill::after {
  content: '';
  position: absolute;
  inset: -7px 0;
}

.tag-pill:hover {
  color: var(--text-primary);
  border-color: rgba(6, 182, 212, 0.3);
}

.tag-pill:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.tag-pill.is-active {
  color: #fff;
  background: rgba(6, 182, 212, 0.9);
  border-color: transparent;
  box-shadow: 0 0 16px rgba(6, 182, 212, 0.28);
}

.tag-count {
  font-size: 11px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

/* === Sections & grid === */
.notes-section + .notes-section {
  margin-top: 28px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.section-icon {
  font-size: 14px;
  color: var(--text-muted);
}

.section-icon.is-pinned {
  color: #f59e0b;
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.06);
  font-variant-numeric: tabular-nums;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr));
  gap: 16px;
  align-items: stretch;
}

.skeleton-note {
  height: 186px;
}

/* 卡片依次入场，靠 --i 错开；超过 8 个不再累加，避免长列表等太久 */
@media (prefers-reduced-motion: no-preference) {
  .note-enter {
    animation: note-in 0.34s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }
}

@keyframes note-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.load-more :deep(.el-button) {
  height: 38px;
  padding: 0 22px;
  border-radius: 19px;
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--glass-border);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.load-more :deep(.el-button:hover) {
  background: rgba(6, 182, 212, 0.1);
  border-color: rgba(6, 182, 212, 0.35);
  color: var(--text-primary);
}

/* === Empty states === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 64px 24px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.35);
  border: 1px dashed rgba(148, 163, 184, 0.18);
  text-align: center;
}

.empty-icon {
  font-size: 34px;
  color: var(--text-muted);
  opacity: 0.6;
  margin-bottom: 6px;
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.7;
  max-width: 420px;
  color: var(--text-muted);
}

/* === Mobile === */
@media (max-width: 768px) {
  .page-header {
    align-items: flex-start;
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .search-input {
    max-width: none;
    flex-basis: 100%;
  }

  .create-btn {
    width: 100%;
  }

  .notes-grid {
    gap: 12px;
  }
}
</style>
