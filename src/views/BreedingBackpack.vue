<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getPlanById, getTasksByPlanId, getGroupsByPlanId, getIndividualsByPlanId,
  getIndividualById, getGroupById, getAllEggRecordsByPlanId, getHatchingEggsByPlanId,
  getParentPoolByPlanId, addIndividual, startHatch, hatchEgg, addEggRecord,
  applyReplacement, getReplacementRecordsByPlanId, switchIndividualLocation,
  getIndividualDisplayName, evolveIndividual, updateParentPool,
} from '../services/breedingService'
import { getAllFormsWithFamily, getFormName, getFamilyOfForm, getInitialFormId, getFamilyById } from '../services/pokemonService'
import { generateReplacementSuggestions } from '../utils/replacementAdvisor'
import { exportIndividuals, importIndividuals } from '../utils/excelIO'
import type { Individual, BreedingGroup, EggRecord } from '../types'
import PageHeader from '../components/PageHeader.vue'
import PokemonAvatar from '../components/PokemonAvatar.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import IndividualDetailDialog from '../components/IndividualDetailDialog.vue'

const route = useRoute()
const router = useRouter()

const planId = Number(route.params.id)
const plan = computed(() => getPlanById(planId))
const tasks = getTasksByPlanId(planId)
const individuals = getIndividualsByPlanId(planId)
const allGroups = ref<BreedingGroup[]>(getGroupsByPlanId(planId))
const parentPool = computed(() => getParentPoolByPlanId(planId))
const formOptions = getAllFormsWithFamily()

const activeTab = ref('individuals')
const tabOptions = [
  { value: 'individuals', label: `精灵（${individuals.length}）` },
  { value: 'eggs', label: `蛋` },
  { value: 'replacements', label: '替换推荐' },
]

function refreshGroups() { allGroups.value = getGroupsByPlanId(planId) }
function formNameOf(i?: Individual) { return i ? getFormName(i.currentFormId) : '' }

// ── 导入导出 ──
const fileInputRef = ref<HTMLInputElement | null>(null)

function onExport() {
  exportIndividuals(planId)
  ElMessage.success('导出成功')
}

function onImportClick() {
  fileInputRef.value?.click()
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = '' // 清空，允许重复选同一文件
  try {
    const result = await importIndividuals(file, planId)
    if (result.success > 0) {
      ElMessage.success(`成功导入 ${result.success} 只精灵`)
    }
    if (result.errors.length > 0) {
      console.warn('[import] errors:', result.errors)
      ElMessage.warning(`${result.errors.length} 行导入失败，详见控制台`)
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '导入失败')
  }
}

// ── 个体详情 ──
const detailId = ref<number | null>(null)

// ── 切换位置 ──
function onSwitchLocation(id: number) {
  const r = switchIndividualLocation(id)
  if (r) ElMessage.success(r.location === 'home' ? '已放入家园' : '已收回背包')
}

// ── 蛋列表 ──
const backpackEggs = computed(() =>
  getAllEggRecordsByPlanId(planId).slice().sort((a, b) => (b.acquiredAt || '').localeCompare(a.acquiredAt || ''))
    .map(e => ({ ...e, taskName: tasks.find(t => t.id === e.taskId)?.name ?? '?', groupNo: getGroupById(e.sourceGroupId)?.groupNo ?? '?' }))
)
function getEggName(egg: EggRecord) {
  const g = getGroupById(egg.sourceGroupId)
  const p = getIndividualById(g?.motherId ?? -1) ?? getIndividualById(g?.fatherId ?? -1)
  return p ? getFormName(p.currentFormId) : ''
}
function statusClass(s: string) {
  if (s === '已孵化') return 'badge-success'
  if (s === '孵蛋中') return 'badge-warning'
  if (s === '淘汰') return 'badge-danger'
  return 'badge-neutral'
}

// ── 替换建议 ──
const suggestions = computed(() =>
  parentPool.value ? generateReplacementSuggestions(individuals, allGroups.value, parentPool.value) : []
)
const replacementRecords = computed(() =>
  getReplacementRecordsByPlanId(planId).map(r => ({
    ...r, taskName: r.taskId ? tasks.find(t => t.id === r.taskId)?.name ?? '?' : '?',
    oldName: getIndividualDisplayName(r.oldIndividualId), newName: getIndividualDisplayName(r.newIndividualId),
  }))
)
function onApplySuggestion(s: ReturnType<typeof generateReplacementSuggestions>[number]) {
  let target = s.groupId ? allGroups.value.find(g => g.id === s.groupId) : undefined
  if (!target) target = allGroups.value.find(g => s.role === 'father' ? g.fatherId != null : g.motherId != null)
  if (!target) target = allGroups.value[0]
  if (!target) return
  applyReplacement(target.id, s.role, s.newIndividual.id)
  if (parentPool.value) {
    const malePool = s.role === 'father' ? (s.evictedId ? parentPool.value.maleParents.map(id => id === s.evictedId ? s.newIndividual.id : id) : [...parentPool.value.maleParents, s.newIndividual.id].slice(0, 5)) : parentPool.value.maleParents
    const femalePool = s.role === 'mother' ? (s.evictedId ? parentPool.value.femaleParents.map(id => id === s.evictedId ? s.newIndividual.id : id) : [...parentPool.value.femaleParents, s.newIndividual.id].slice(0, 5)) : parentPool.value.femaleParents
    updateParentPool(planId, malePool, femalePool)
  }
  refreshGroups(); ElMessage.success('替换成功')
}

// ── 孵蛋箱 ──
const hatchSlots = computed(() => getHatchingEggsByPlanId(planId))
const now = ref(Date.now())
let timer: number | undefined
onMounted(() => { timer = window.setInterval(() => { now.value = Date.now() }, 30000) })
onBeforeUnmount(() => { if (timer) window.clearInterval(timer) })
function elapsedText(iso?: string) {
  if (!iso) return '—'
  const diff = Math.max(0, Math.floor((now.value - new Date(iso).getTime()) / 1000))
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60)
  return h > 0 ? `${h}小时${m}分钟` : m > 0 ? `${m}分钟` : '刚刚'
}

// ── 孵化弹窗 ──
const hatchDialogVisible = ref(false)
const hatchForm = reactive({
  eggId: undefined as number | undefined, familyId: undefined as number | undefined,
  currentFormId: undefined as number | undefined, gender: 'male', height: 0, weight: 0,
  sizeMedal: '', voiceMedal: '', personality: '', specialty: '',
  evolveAfterHatch: false, evolveWeight: 0, evolveHeight: 0, evolveLevel: 0,
})
function openHatch(egg: EggRecord) {
  hatchForm.eggId = egg.id; hatchForm.gender = 'male'; hatchForm.height = egg.height; hatchForm.weight = egg.weight
  hatchForm.sizeMedal = ''; hatchForm.voiceMedal = ''; hatchForm.personality = ''; hatchForm.specialty = ''
  hatchForm.evolveAfterHatch = false; hatchForm.evolveWeight = egg.weight
  const g = getGroupById(egg.sourceGroupId)
  const p = getIndividualById(g?.motherId ?? -1) ?? getIndividualById(g?.fatherId ?? -1)
  hatchForm.familyId = p?.familyId
  hatchForm.currentFormId = p?.familyId !== undefined ? getInitialFormId(p.familyId) : undefined
  hatchDialogVisible.value = true
}
const canHatch = computed(() => hatchForm.eggId !== undefined && hatchForm.currentFormId !== undefined && hatchForm.height > 0 && hatchForm.weight > 0 && hatchForm.sizeMedal && hatchForm.voiceMedal)
function onHatchConfirm() {
  if (!canHatch.value || !hatchForm.eggId || !hatchForm.currentFormId || !hatchForm.familyId) return
  const r = hatchEgg(hatchForm.eggId, {
    familyId: hatchForm.familyId, currentFormId: hatchForm.currentFormId, gender: hatchForm.gender,
    height: hatchForm.height, weight: hatchForm.weight, sizeMedal: hatchForm.sizeMedal,
    voiceMedal: hatchForm.voiceMedal, personality: hatchForm.personality, specialty: hatchForm.specialty,
  })
  if (!r) { ElMessage.warning('孵化失败'); return }
  if (hatchForm.evolveAfterHatch && hatchForm.evolveWeight > 0) evolveIndividual(r.individual.id, { weight: hatchForm.evolveWeight })
  ElMessage.success('孵化成功！'); hatchDialogVisible.value = false
}

// ── 放入孵蛋箱 ──
function onStartHatch(eggId: number) {
  const r = startHatch(eggId)
  if (!r) { ElMessage.warning('放入失败'); return }
  ElMessage.success('已放入孵蛋箱')
}
</script>

<template>
  <div>
    <PageHeader title="背包" :back="true" />

    <div class="px-4 py-3">
      <SegmentedControl v-model="activeTab" :options="tabOptions" />
    </div>

    <!-- 精灵 Tab -->
    <div v-if="activeTab === 'individuals'" class="px-4 space-y-3 pb-4">
      <div class="flex items-center justify-between">
        <span class="text-xs text-pink-400">共 {{ individuals.length }} 只</span>
        <div class="flex gap-2">
          <button @click="onExport" class="text-xs text-emerald-400 px-2 py-1 rounded-lg active:bg-emerald-500/10">导出</button>
          <button @click="onImportClick" class="text-xs text-pink-500 px-2 py-1 rounded-lg active:bg-violet-500/10">导入</button>
        </div>
      </div>
      <input ref="fileInputRef" type="file" accept=".xlsx,.xls" class="hidden" @change="onImportFile" />
      <div
        v-for="ind in individuals"
        :key="ind.id"
        class="card"
        @click="detailId = ind.id"
      >
        <div class="flex items-center gap-3">
          <PokemonAvatar :name="formNameOf(ind)" :gender="ind.gender" :size="44" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-medium text-sm text-pink-900">{{ formNameOf(ind) }}</span>
              <span class="text-xs text-pink-400">#{{ ind.id }}</span>
              <span class="text-xs">{{ ind.gender === 'male' ? '♂' : '♀' }}</span>
            </div>
            <div class="text-xs text-pink-400">{{ ind.height }}m · {{ ind.weight }}kg</div>
            <div class="flex gap-1.5 mt-1">
              <span v-if="ind.sizeMedal" class="badge badge-info text-[10px]">{{ ind.sizeMedal }}</span>
              <span v-if="ind.voiceMedal" class="badge badge-neutral text-[10px]">{{ ind.voiceMedal }}</span>
              <span class="badge text-[10px]" :class="(ind.location ?? 'bag') === 'home' ? 'badge-success' : 'badge-neutral'">
                {{ (ind.location ?? 'bag') === 'home' ? '家园' : '背包' }}
              </span>
            </div>
          </div>
          <button @click.stop="onSwitchLocation(ind.id)" class="text-xs text-pink-400 px-2 py-1 rounded-lg active:bg-pink-100">
            {{ (ind.location ?? 'bag') === 'home' ? '收回' : '家园' }}
          </button>
        </div>
      </div>
      <div v-if="individuals.length === 0" class="text-center py-12">
        <p class="text-pink-400">还没有精灵</p>
      </div>
    </div>

    <!-- 蛋 Tab -->
    <div v-if="activeTab === 'eggs'" class="px-4 space-y-3 pb-4">
      <div v-for="egg in backpackEggs" :key="egg.id" class="card">
        <div class="flex items-center gap-3">
          <PokemonAvatar :name="getEggName(egg)" :egg="true" :size="44" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="font-medium text-sm text-pink-900">{{ getEggName(egg) || '未知精灵' }}</span>
              <span class="text-xs text-pink-400">蛋#{{ egg.id }}</span>
              <span class="badge text-[10px]" :class="statusClass(egg.status)">{{ egg.status }}</span>
            </div>
            <div class="text-xs text-pink-400">{{ egg.taskName }} · 第{{ egg.groupNo }}组 · {{ egg.height }}m/{{ egg.weight }}kg</div>
          </div>
          <button
            v-if="egg.status === '未处理'"
            @click="onStartHatch(egg.id)"
            class="text-xs text-amber-400 px-2 py-1 rounded-lg active:bg-amber-500/10"
          >
            孵蛋
          </button>
          <button
            v-else-if="egg.status === '孵蛋中'"
            @click="openHatch(egg)"
            class="text-xs text-pink-500 px-2 py-1 rounded-lg active:bg-violet-500/10"
          >
            孵化
          </button>
        </div>
      </div>
      <div v-if="backpackEggs.length === 0" class="text-center py-12">
        <p class="text-pink-400">还没有蛋</p>
      </div>
    </div>

    <!-- 替换推荐 Tab -->
    <div v-if="activeTab === 'replacements'" class="px-4 space-y-3 pb-4">
      <!-- 建议列表 -->
      <div v-if="suggestions.length > 0" class="space-y-3">
        <div v-for="(s, i) in suggestions" :key="i" class="card">
          <div class="text-xs text-pink-400 mb-2">
            第{{ s.groupNo ?? '?' }}组{{ s.role === 'father' ? '父本' : '母本' }}
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 text-center">
              <div class="text-xs text-pink-400 mb-1">旧</div>
              <PokemonAvatar v-if="s.oldIndividual" :name="formNameOf(s.oldIndividual)" :gender="s.oldIndividual.gender" :size="36" />
              <div class="text-xs text-pink-400 mt-1">{{ s.oldWeight }}kg</div>
            </div>
            <span class="text-pink-500 text-lg">→</span>
            <div class="flex-1 text-center">
              <div class="text-xs text-pink-400 mb-1">新</div>
              <PokemonAvatar :name="formNameOf(s.newIndividual)" :gender="s.newIndividual.gender" :size="36" />
              <div class="text-xs text-emerald-400 mt-1">{{ s.newWeight }}kg</div>
            </div>
            <button @click="onApplySuggestion(s)" class="btn btn-primary w-auto px-3 py-2 text-xs">替换</button>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-8">
        <p class="text-pink-400 text-sm">当前无需替换</p>
      </div>

      <!-- 替换记录 -->
      <div v-if="replacementRecords.length > 0">
        <h3 class="section-title">替换记录</h3>
        <div class="space-y-2">
          <div v-for="r in replacementRecords" :key="r.id" class="card py-3">
            <div class="flex items-center justify-between text-xs">
              <span class="text-pink-400">{{ r.taskName }} · 第{{ r.groupNo }}组{{ r.role === 'father' ? '父本' : '母本' }}</span>
              <span class="text-pink-400">{{ r.replacedAt?.slice(0, 10) }}</span>
            </div>
            <div class="flex items-center gap-2 mt-1 text-sm">
              <span class="text-pink-400">{{ r.oldName }}</span>
              <span class="text-pink-500">→</span>
              <span class="text-emerald-400">{{ r.newName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 孵化弹窗 -->
    <el-dialog v-model="hatchDialogVisible" title="孵化完成" width="90%" :close-on-click-modal="false">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-pink-400 mb-1.5 block">性别</label>
            <div class="flex gap-2">
              <button @click="hatchForm.gender = 'male'" :class="hatchForm.gender === 'male' ? 'bg-pink-400 text-white' : 'bg-pink-100 text-pink-700'" class="flex-1 py-2 rounded-lg text-sm">♂</button>
              <button @click="hatchForm.gender = 'female'" :class="hatchForm.gender === 'female' ? 'bg-pink-400 text-white' : 'bg-pink-100 text-pink-700'" class="flex-1 py-2 rounded-lg text-sm">♀</button>
            </div>
          </div>
          <div>
            <label class="text-sm text-pink-400 mb-1.5 block">体型奖牌</label>
            <select v-model="hatchForm.sizeMedal" class="input-field">
              <option value="" disabled>选择</option>
              <option value="大块头">大块头</option>
              <option value="小不点">小不点</option>
              <option value="普通">普通</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm text-pink-400 mb-1.5 block">身高 (m)</label><input v-model.number="hatchForm.height" type="number" step="0.01" class="input-field" /></div>
          <div><label class="text-sm text-pink-400 mb-1.5 block">体重 (kg)</label><input v-model.number="hatchForm.weight" type="number" step="0.1" class="input-field" /></div>
        </div>
        <div>
          <label class="text-sm text-pink-400 mb-1.5 block">声音奖牌</label>
          <select v-model="hatchForm.voiceMedal" class="input-field">
            <option value="" disabled>选择</option>
            <option value="婉转声">婉转声</option>
            <option value="粗嗓门">粗嗓门</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-sm text-pink-400 mb-1.5 block">性格</label><input v-model="hatchForm.personality" class="input-field" placeholder="可选" /></div>
          <div><label class="text-sm text-pink-400 mb-1.5 block">特长</label><input v-model="hatchForm.specialty" class="input-field" placeholder="可选" /></div>
        </div>
        <label class="flex items-center gap-2 text-sm text-pink-700">
          <input type="checkbox" v-model="hatchForm.evolveAfterHatch" class="rounded" />
          孵化后立即进化
        </label>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="hatchDialogVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onHatchConfirm" :disabled="!canHatch">确认孵化</button>
        </div>
      </template>
    </el-dialog>

    <IndividualDetailDialog :individual-id="detailId" @close="detailId = null" />
  </div>
</template>
