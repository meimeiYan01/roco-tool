<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getPlanById, getTasksByPlanId, getGroupsByPlanId, getIndividualsByPlanId,
  getIndividualById, getGroupById, getUnhatchedEggsByPlanId, getHatchingEggsByPlanId,
  getParentPoolByPlanId, updatePlan, addGroup, updateGroup, removeGroup,
  addIndividual, startHatch, hatchEgg, addEggRecord, evolveIndividual, addGrowthRecord,
} from '../services/breedingService'
import { getAllFormsWithFamily, getFormName, getFamilyOfForm, getInitialFormId, getFamilyById } from '../services/pokemonService'
import { generateLayoutRecommendation } from '../utils/layoutAdvisor'
import type { Individual, BreedingGroup, EggRecord, LayoutRecommendation } from '../types'
import PageHeader from '../components/PageHeader.vue'
import PokemonAvatar from '../components/PokemonAvatar.vue'
import IndividualDetailDialog from '../components/IndividualDetailDialog.vue'

const route = useRoute()
const router = useRouter()

const planId = Number(route.params.id)
const plan = getPlanById(planId)
const tasks = getTasksByPlanId(planId)
const individuals = getIndividualsByPlanId(planId)
const allGroups = ref<BreedingGroup[]>(getGroupsByPlanId(planId))
const parentPool = computed(() => getParentPoolByPlanId(planId))

function refreshGroups() { allGroups.value = getGroupsByPlanId(planId) }
function formNameOf(i?: Individual) { return i ? getFormName(i.currentFormId) : '' }

// ── 个体详情 ──
const detailId = ref<number | null>(null)

// ── 添加精灵 ──
const addIndividualVisible = ref(false)
const addIndividualForm = reactive({
  formId: undefined as number | undefined,
  gender: 'male' as string,
  height: 0,
  weight: 0,
  sizeMedal: '' as string,
  voiceMedal: '' as string,
  personality: '',
  specialty: '',
})
const addFormOptions = getAllFormsWithFamily()
const addSearchKeyword = ref('')
const filteredFormOptions = computed(() => {
  const kw = addSearchKeyword.value.trim().toLowerCase()
  if (!kw) return addFormOptions
  return addFormOptions.filter(f =>
    f.form.name.toLowerCase().includes(kw) ||
    f.family.familyName.toLowerCase().includes(kw) ||
    f.family.types.some(t => t.toLowerCase().includes(kw))
  )
})
function selectAddForm(formId: number) {
  addIndividualForm.formId = formId
}
function openAddIndividual() {
  addIndividualForm.formId = undefined
  addIndividualForm.gender = 'male'
  addIndividualForm.height = 0
  addIndividualForm.weight = 0
  addIndividualForm.sizeMedal = ''
  addIndividualForm.voiceMedal = ''
  addIndividualForm.personality = ''
  addIndividualForm.specialty = ''
  addSearchKeyword.value = ''
  addIndividualVisible.value = true
}
function onAddIndividual() {
  const f = addIndividualForm
  if (!f.formId || f.height <= 0 || f.weight <= 0 || !f.sizeMedal || !f.voiceMedal) return
  const family = getFamilyOfForm(f.formId)
  if (!family) return
  addIndividual({
    planId,
    familyId: family.familyId,
    currentFormId: f.formId,
    gender: f.gender,
    height: f.height,
    weight: f.weight,
    sizeMedal: f.sizeMedal,
    voiceMedal: f.voiceMedal,
    personality: f.personality,
    specialty: f.specialty,
  })
  ElMessage.success('精灵已添加')
  addIndividualVisible.value = false
}

// ── 小组编辑 ──
const groupDialogVisible = ref(false)
const editingGroupId = ref<number | null>(null)
const groupForm = reactive({ taskId: null as number | null, fatherId: null as number | null, motherId: null as number | null })
const maleIndividuals = computed(() => getIndividualsByPlanId(planId).filter(i => i.gender === 'male'))
const femaleIndividuals = computed(() => getIndividualsByPlanId(planId).filter(i => i.gender === 'female'))

function openGroupCreate() {
  editingGroupId.value = null
  groupForm.taskId = null; groupForm.fatherId = null; groupForm.motherId = null
  groupDialogVisible.value = true
}
function openGroupEdit(g: BreedingGroup) {
  editingGroupId.value = g.id
  groupForm.taskId = g.taskId; groupForm.fatherId = g.fatherId; groupForm.motherId = g.motherId
  groupDialogVisible.value = true
}
function onGroupSave() {
  if (editingGroupId.value !== null) {
    updateGroup(editingGroupId.value, { taskId: groupForm.taskId, fatherId: groupForm.fatherId, motherId: groupForm.motherId })
  } else {
    const g = addGroup(planId, groupForm.taskId)
    if (g) updateGroup(g.id, { fatherId: groupForm.fatherId, motherId: groupForm.motherId })
  }
  refreshGroups(); groupDialogVisible.value = false; ElMessage.success('已保存')
}
function onGroupRemove(id: number, no: number) {
  if (confirm(`删除第${no}组？`)) { removeGroup(id); refreshGroups(); ElMessage.success('已删除') }
}

// ── 布局推荐 ──
const layoutDialogVisible = ref(false)
const layoutRec = ref<LayoutRecommendation | null>(null)
function openLayout() {
  if (!parentPool.value) { ElMessage.warning('暂无亲本池'); return }
  layoutRec.value = generateLayoutRecommendation(allGroups.value, parentPool.value, individuals)
  if (layoutRec.value.pairs.length === 0) { ElMessage.info('无可推荐方案'); return }
  layoutDialogVisible.value = true
}
function applyLayout() {
  if (!layoutRec.value) return
  for (const p of layoutRec.value.pairs) updateGroup(p.groupId, { fatherId: p.fatherId, motherId: p.motherId })
  refreshGroups(); layoutDialogVisible.value = false; ElMessage.success('布局已应用')
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
  if (h > 0) return `${h}小时${m}分钟`
  if (m > 0) return `${m}分钟`
  return '刚刚'
}
function getEggName(egg: EggRecord) {
  const g = getGroupById(egg.sourceGroupId)
  const p = getIndividualById(g?.motherId ?? -1) ?? getIndividualById(g?.fatherId ?? -1)
  return p ? getFormName(p.currentFormId) : ''
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
  hatchForm.evolveAfterHatch = false; hatchForm.evolveWeight = egg.weight; hatchForm.evolveHeight = egg.height; hatchForm.evolveLevel = 0
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
  addGrowthRecord(r.individual.id, { formId: r.individual.currentFormId, weight: r.individual.weight })
  if (hatchForm.evolveAfterHatch && hatchForm.evolveWeight > 0) {
    evolveIndividual(r.individual.id, { weight: hatchForm.evolveWeight, height: hatchForm.evolveHeight > 0 ? hatchForm.evolveHeight : undefined, level: hatchForm.evolveLevel > 0 ? hatchForm.evolveLevel : undefined })
  }
  ElMessage.success('孵化成功！'); hatchDialogVisible.value = false
}

// ── 新增蛋 ──
const addEggVisible = ref(false)
const addEggForm = reactive({ sourceGroupId: undefined as number | undefined, height: 0, weight: 0 })
function onAddEgg() {
  if (!addEggForm.sourceGroupId || addEggForm.height <= 0 || addEggForm.weight <= 0) return
  const g = allGroups.value.find(g => g.id === addEggForm.sourceGroupId)
  if (!g?.taskId) { ElMessage.warning('该组未分配方向'); return }
  addEggRecord({ taskId: g.taskId, sourceGroupId: g.id, height: addEggForm.height, weight: addEggForm.weight })
  ElMessage.success('蛋已记录'); addEggVisible.value = false
}

// ── 开始孵蛋 ──
const startVisible = ref(false)
const startEggId = ref<number | undefined>()
const incubatorCandidates = computed(() => getUnhatchedEggsByPlanId(planId))
const incubatorFull = computed(() => hatchSlots.value.every(s => s.egg !== undefined))
function onStartHatch() {
  if (!startEggId.value) return
  const r = startHatch(startEggId.value)
  if (!r) { ElMessage.warning('放入失败'); return }
  ElMessage.success('已放入孵蛋箱'); startVisible.value = false
}
</script>

<template>
  <div>
    <PageHeader :title="plan?.name ?? '培育详情'" :back="true">
      <template #actions>
        <button @click="openAddIndividual" class="text-xs text-amber-400 font-medium">添加精灵</button>
        <button @click="router.push(`/breeding/${planId}/backpack`)" class="text-xs text-violet-400 font-medium">背包</button>
        <button @click="router.push(`/breeding/${planId}/stats`)" class="text-xs text-emerald-400 font-medium">统计</button>
      </template>
    </PageHeader>

    <div v-if="plan" class="px-4 py-4 space-y-6">
      <!-- 小窝总览 -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">小窝（{{ allGroups.length }}组）</h2>
          <div class="flex gap-2">
            <button @click="openGroupCreate" class="text-xs text-violet-400">＋ 新组</button>
            <button @click="openLayout" class="text-xs text-emerald-400">布局推荐</button>
          </div>
        </div>
        <div class="space-y-3">
          <div v-for="g in allGroups" :key="g.id" class="card">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-slate-200">第{{ g.groupNo }}组</span>
                <span v-if="g.taskId" class="badge badge-success text-[10px]">{{ tasks.find(t => t.id === g.taskId)?.name }}</span>
                <span v-else class="badge badge-neutral text-[10px]">未分配</span>
              </div>
              <div class="flex gap-2">
                <button @click="openGroupEdit(g)" class="text-xs text-slate-400">编辑</button>
                <button @click="onGroupRemove(g.id, g.groupNo)" class="text-xs text-red-400">删除</button>
              </div>
            </div>
            <div class="flex items-center justify-around">
              <div class="flex flex-col items-center" @click="g.fatherId && (detailId = g.fatherId)">
                <PokemonAvatar :name="formNameOf(getIndividualById(g.fatherId ?? -1))" :gender="'male'" :size="48" :placeholder="!g.fatherId" />
                <span class="text-xs text-slate-300 mt-1">{{ formNameOf(getIndividualById(g.fatherId ?? -1)) || '未设置' }}</span>
                <span class="text-[10px] text-slate-500">{{ getIndividualById(g.fatherId ?? -1)?.weight ?? '—' }}kg</span>
              </div>
              <span class="text-slate-500">×</span>
              <div class="flex flex-col items-center" @click="g.motherId && (detailId = g.motherId)">
                <PokemonAvatar :name="formNameOf(getIndividualById(g.motherId ?? -1))" :gender="'female'" :size="48" :placeholder="!g.motherId" />
                <span class="text-xs text-slate-300 mt-1">{{ formNameOf(getIndividualById(g.motherId ?? -1)) || '未设置' }}</span>
                <span class="text-[10px] text-slate-500">{{ getIndividualById(g.motherId ?? -1)?.weight ?? '—' }}kg</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 孵蛋箱 -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title mb-0">孵蛋箱（{{ hatchSlots.filter(s => s.egg).length }}/3）</h2>
          <div class="flex gap-2">
            <button @click="addEggVisible = true" class="text-xs text-violet-400">＋ 新增蛋</button>
            <button @click="startVisible = true" :disabled="incubatorFull || incubatorCandidates.length === 0" class="text-xs text-amber-400 disabled:text-slate-600">开始孵蛋</button>
          </div>
        </div>
        <div class="space-y-3">
          <div v-for="slot in hatchSlots" :key="slot.slotNo">
            <div v-if="slot.egg" class="card">
              <div class="flex items-center gap-3">
                <PokemonAvatar :name="getEggName(slot.egg)" :egg="true" :size="48" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-medium text-sm text-slate-100">{{ getEggName(slot.egg) || '未知精灵' }}</span>
                    <span class="badge badge-warning text-[10px]">孵蛋中</span>
                  </div>
                  <div class="text-xs text-slate-400">蛋#{{ slot.egg.id }} · {{ slot.egg.height }}m / {{ slot.egg.weight }}kg</div>
                  <div class="text-xs text-amber-400 mt-1">已孵 {{ elapsedText(slot.egg.hatchStartTime) }}</div>
                </div>
                <button @click="openHatch(slot.egg!)" class="btn btn-primary w-auto px-4 py-2 text-sm">孵化</button>
              </div>
            </div>
            <div v-else class="border-2 border-dashed border-slate-700 rounded-2xl p-4 text-center">
              <span class="text-xs text-slate-500">空槽位 {{ slot.slotNo }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="flex items-center justify-center h-64">
      <p class="text-slate-400">未找到该计划</p>
    </div>

    <!-- 编辑小组弹窗 -->
    <el-dialog v-model="groupDialogVisible" :title="editingGroupId ? '编辑小组' : '新建小组'" width="90%" :close-on-click-modal="false">
      <div class="space-y-4">
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">培育方向</label>
          <select v-model="groupForm.taskId" class="input-field">
            <option :value="null">未分配</option>
            <option v-for="t in tasks" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">父本 ♂</label>
          <select v-model="groupForm.fatherId" class="input-field">
            <option :value="null">选择雄性个体</option>
            <option v-for="i in maleIndividuals" :key="i.id" :value="i.id">#{{ i.id }} {{ getFormName(i.currentFormId) }} {{ i.weight }}kg</option>
          </select>
        </div>
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">母本 ♀</label>
          <select v-model="groupForm.motherId" class="input-field">
            <option :value="null">选择雌性个体</option>
            <option v-for="i in femaleIndividuals" :key="i.id" :value="i.id">#{{ i.id }} {{ getFormName(i.currentFormId) }} {{ i.weight }}kg</option>
          </select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="groupDialogVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onGroupSave">保存</button>
        </div>
      </template>
    </el-dialog>

    <!-- 布局推荐弹窗 -->
    <el-dialog v-model="layoutDialogVisible" title="布局推荐" width="90%">
      <div v-if="layoutRec" class="space-y-3">
        <div v-if="layoutRec.skippedGroups.length" class="text-xs text-amber-400">
          跳过手动调整：{{ layoutRec.skippedGroups.map(n => `第${n}组`).join('、') }}
        </div>
        <div v-for="p in layoutRec.pairs" :key="p.groupId" class="card">
          <div class="text-xs text-slate-400 mb-2">第{{ p.groupNo }}组</div>
          <div class="flex items-center justify-around">
            <div class="text-center">
              <div class="text-sm text-slate-200">{{ getFormName(getIndividualById(p.fatherId)?.currentFormId ?? -1) }}</div>
              <div class="text-xs text-slate-500">#{{ p.fatherId }} · {{ p.fatherWeight }}kg</div>
            </div>
            <span class="text-slate-500">×</span>
            <div class="text-center">
              <div class="text-sm text-slate-200">{{ getFormName(getIndividualById(p.motherId)?.currentFormId ?? -1) }}</div>
              <div class="text-xs text-slate-500">#{{ p.motherId }} · {{ p.motherWeight }}kg</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="layoutDialogVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="applyLayout">应用方案</button>
        </div>
      </template>
    </el-dialog>

    <!-- 新增蛋弹窗 -->
    <el-dialog v-model="addEggVisible" title="新增蛋" width="90%" :close-on-click-modal="false">
      <div class="space-y-4">
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">来源组</label>
          <select v-model="addEggForm.sourceGroupId" class="input-field">
            <option :value="undefined" disabled>选择来源组</option>
            <option v-for="g in allGroups" :key="g.id" :value="g.id" :disabled="!g.taskId">
              第{{ g.groupNo }}组 · {{ tasks.find(t => t.id === g.taskId)?.name ?? '未分配' }}
            </option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">身高 (m)</label>
            <input v-model.number="addEggForm.height" type="number" step="0.01" min="0" class="input-field" />
          </div>
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">体重 (kg)</label>
            <input v-model.number="addEggForm.weight" type="number" step="0.1" min="0" class="input-field" />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="addEggVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onAddEgg" :disabled="!addEggForm.sourceGroupId || addEggForm.height <= 0 || addEggForm.weight <= 0">保存</button>
        </div>
      </template>
    </el-dialog>

    <!-- 开始孵蛋弹窗 -->
    <el-dialog v-model="startVisible" title="开始孵蛋" width="90%">
      <div class="space-y-4">
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">选择蛋</label>
          <select v-model="startEggId" class="input-field">
            <option :value="undefined" disabled>选择要孵的蛋</option>
            <option v-for="e in incubatorCandidates" :key="e.id" :value="e.id">
              蛋#{{ e.id }} · {{ e.height }}m / {{ e.weight }}kg
            </option>
          </select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="startVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onStartHatch" :disabled="!startEggId">放入孵蛋箱</button>
        </div>
      </template>
    </el-dialog>

    <!-- 孵化弹窗 -->
    <el-dialog v-model="hatchDialogVisible" title="孵化完成" width="90%" :close-on-click-modal="false">
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">性别</label>
            <div class="flex gap-2">
              <button @click="hatchForm.gender = 'male'" :class="hatchForm.gender === 'male' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'" class="flex-1 py-2 rounded-lg text-sm">♂ 雄性</button>
              <button @click="hatchForm.gender = 'female'" :class="hatchForm.gender === 'female' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'" class="flex-1 py-2 rounded-lg text-sm">♀ 雌性</button>
            </div>
          </div>
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">体型奖牌</label>
            <select v-model="hatchForm.sizeMedal" class="input-field">
              <option value="" disabled>选择</option>
              <option value="大块头">大块头</option>
              <option value="小不点">小不点</option>
              <option value="普通">普通</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">身高 (m)</label>
            <input v-model.number="hatchForm.height" type="number" step="0.01" class="input-field" />
          </div>
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">体重 (kg)</label>
            <input v-model.number="hatchForm.weight" type="number" step="0.1" class="input-field" />
          </div>
        </div>
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">声音奖牌</label>
          <select v-model="hatchForm.voiceMedal" class="input-field">
            <option value="" disabled>选择</option>
            <option value="婉转声">婉转声</option>
            <option value="粗嗓门">粗嗓门</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">性格</label>
            <input v-model="hatchForm.personality" class="input-field" placeholder="可选" />
          </div>
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">特长</label>
            <input v-model="hatchForm.specialty" class="input-field" placeholder="可选" />
          </div>
        </div>
        <div class="border-t border-slate-700 pt-3">
          <label class="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" v-model="hatchForm.evolveAfterHatch" class="rounded" />
            孵化后立即进化
          </label>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="hatchDialogVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onHatchConfirm" :disabled="!canHatch">确认孵化</button>
        </div>
      </template>
    </el-dialog>

    <!-- 添加精灵弹窗 -->
    <el-dialog v-model="addIndividualVisible" title="添加精灵" width="90%" :close-on-click-modal="false">
      <div class="space-y-4">
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">选择精灵</label>
          <div v-if="addIndividualForm.formId" class="flex items-center gap-2 mb-2 p-2 bg-slate-700/50 rounded-lg">
            <span class="text-sm text-slate-200">{{ getFormName(addIndividualForm.formId) }}</span>
            <button @click="addIndividualForm.formId = undefined" class="text-xs text-slate-400 ml-auto">更换</button>
          </div>
          <template v-else>
            <input v-model="addSearchKeyword" type="text" class="input-field mb-2" placeholder="搜索精灵名称、系别..." />
            <div class="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-700">
              <div v-for="f in filteredFormOptions" :key="f.form.formId"
                @click="selectAddForm(f.form.formId)"
                class="flex items-center justify-between px-3 py-2 text-sm cursor-pointer active:bg-slate-700 transition-colors"
                :class="addIndividualForm.formId === f.form.formId ? 'bg-violet-600/20 text-violet-300' : 'text-slate-300 hover:bg-slate-700/50'"
              >
                <span>{{ f.form.name }}</span>
                <span class="text-xs text-slate-500">{{ f.family.familyName }}·阶段{{ f.form.stage }}</span>
              </div>
              <div v-if="filteredFormOptions.length === 0" class="px-3 py-4 text-center text-xs text-slate-500">
                未找到匹配精灵
              </div>
            </div>
          </template>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">性别</label>
            <div class="flex gap-2">
              <button @click="addIndividualForm.gender = 'male'" :class="addIndividualForm.gender === 'male' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'" class="flex-1 py-2 rounded-lg text-sm">♂ 雄性</button>
              <button @click="addIndividualForm.gender = 'female'" :class="addIndividualForm.gender === 'female' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'" class="flex-1 py-2 rounded-lg text-sm">♀ 雌性</button>
            </div>
          </div>
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">体型奖牌</label>
            <select v-model="addIndividualForm.sizeMedal" class="input-field">
              <option value="" disabled>选择</option>
              <option value="大块头">大块头</option>
              <option value="小不点">小不点</option>
              <option value="普通">普通</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">身高 (m)</label>
            <input v-model.number="addIndividualForm.height" type="number" step="0.01" min="0" class="input-field" />
          </div>
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">体重 (kg)</label>
            <input v-model.number="addIndividualForm.weight" type="number" step="0.1" min="0" class="input-field" />
          </div>
        </div>
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">声音奖牌</label>
          <select v-model="addIndividualForm.voiceMedal" class="input-field">
            <option value="" disabled>选择</option>
            <option value="婉转声">婉转声</option>
            <option value="粗嗓门">粗嗓门</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">性格</label>
            <input v-model="addIndividualForm.personality" class="input-field" placeholder="可选" />
          </div>
          <div>
            <label class="text-sm text-slate-400 mb-1.5 block">特长</label>
            <input v-model="addIndividualForm.specialty" class="input-field" placeholder="可选" />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="addIndividualVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onAddIndividual" :disabled="!addIndividualForm.formId || addIndividualForm.height <= 0 || addIndividualForm.weight <= 0 || !addIndividualForm.sizeMedal || !addIndividualForm.voiceMedal">添加</button>
        </div>
      </template>
    </el-dialog>

    <IndividualDetailDialog :individual-id="detailId" @close="detailId = null" />
  </div>
</template>
