<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  getPlanById,
  getTasksByPlanId,
  getGroupsByPlanId,
  getAllIndividuals,
  getIndividualById,
  getGroupById,
  getUnhatchedEggsByPlanId,
  getHatchingEggsByPlanId,
  getParentPoolByPlanId,
  updatePlan,
  addGroup,
  updateGroup,
  removeGroup,
  addIndividual,
  startHatch,
  hatchEgg,
  addEggRecord,
  evolveIndividual,
  addGrowthRecord,
} from '../services/breedingService'
import { getAllFormsWithFamily, getFormName, getFamilyOfForm, getInitialFormId, getFamilyById } from '../services/pokemonService'
import { generateLayoutRecommendation } from '../utils/layoutAdvisor'
import type { Individual, BreedingGroup, EggRecord, LayoutRecommendation } from '../types'
import PokemonAvatar from '../components/PokemonAvatar.vue'
import IndividualDetailDialog from '../components/IndividualDetailDialog.vue'

const route = useRoute()
const router = useRouter()

const planId = Number(route.params.id)
const plan = getPlanById(planId)
const tasks = getTasksByPlanId(planId)
const individuals = getAllIndividuals()
const allGroups = ref<BreedingGroup[]>(getGroupsByPlanId(planId))
/** 形态下拉（添加个体用）：{ form, family } */
const formOptions = getAllFormsWithFamily()

/** 个体详情弹窗：非空时打开 */
const individualDetailId = ref<number | null>(null)

function showIndividual(id: number) {
  individualDetailId.value = id
}

function goToStats() {
  router.push(`/breeding/${planId}/stats`)
}

function refreshGroups() {
  allGroups.value = getGroupsByPlanId(planId)
}

/** 个体形态名（模板辅助，找不到返回空） */
function formNameOf(i?: Individual): string {
  return i ? getFormName(i.currentFormId) : ''
}

// 5组分配总览
const allGroupOverview = computed(() =>
  allGroups.value
    .slice()
    .sort((a, b) => a.groupNo - b.groupNo)
    .map(g => ({
      id: g.id,
      groupNo: g.groupNo,
      father: getIndividualById(g.fatherId ?? -1),
      mother: getIndividualById(g.motherId ?? -1),
      taskName: g.taskId ? tasks.find(t => t.id === g.taskId)?.name : null,
    })),
)

const canAddGroup = computed(() => allGroups.value.length < 5)

// ── 计划编辑 ──
const planDialogVisible = ref(false)
const planForm = reactive({
  name: '',
  accountName: '',
})

function openPlanEdit() {
  if (!plan) return
  planForm.name = plan.name
  planForm.accountName = plan.accountName
  planDialogVisible.value = true
}

function onPlanSave() {
  if (!plan || !planForm.name.trim() || !planForm.accountName.trim()) return
  updatePlan(planId, {
    name: planForm.name,
    accountName: planForm.accountName,
  })
  planDialogVisible.value = false
  ElMessage.success('计划已更新')
}

// ── 小组编辑 ──
const groupDialogVisible = ref(false)
const editingGroupId = ref<number | null>(null)
const groupForm = reactive({
  taskId: null as number | null,
  fatherId: null as number | null,
  motherId: null as number | null,
})

// 全部个体，按性别分组供选择（不限定精灵）
const maleIndividuals = computed(() =>
  getAllIndividuals().filter(i => i.gender === 'male'),
)
const femaleIndividuals = computed(() =>
  getAllIndividuals().filter(i => i.gender === 'female'),
)

function openGroupCreate() {
  editingGroupId.value = null
  groupForm.taskId = null
  groupForm.fatherId = null
  groupForm.motherId = null
  groupDialogVisible.value = true
}

function openGroupEdit(group: BreedingGroup) {
  editingGroupId.value = group.id
  groupForm.taskId = group.taskId
  groupForm.fatherId = group.fatherId
  groupForm.motherId = group.motherId
  groupDialogVisible.value = true
}

function onGroupSave() {
  if (editingGroupId.value !== null) {
    // 编辑现有组
    updateGroup(editingGroupId.value, {
      taskId: groupForm.taskId,
      fatherId: groupForm.fatherId,
      motherId: groupForm.motherId,
    })
    ElMessage.success('小组已更新')
  } else {
    // 新建组
    const newGroup = addGroup(planId, groupForm.taskId)
    if (!newGroup) {
      ElMessage.warning('已达上限（5组/10小窝）')
      return
    }
    if (groupForm.fatherId !== null || groupForm.motherId !== null) {
      updateGroup(newGroup.id, {
        fatherId: groupForm.fatherId,
        motherId: groupForm.motherId,
      })
    }
    ElMessage.success('小组已创建')
  }
  refreshGroups()
  groupDialogVisible.value = false
}

function onGroupRemove(groupId: number, groupNo: number) {
  ElMessageBox.confirm(
    `确定删除第${groupNo}组吗？该组的蛋记录不受影响，但亲本关联会被清除。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
    .then(() => {
      removeGroup(groupId)
      refreshGroups()
      ElMessage.success('小组已删除')
    })
    .catch(() => {})
}

// ── 布局推荐 ──
const layoutDialogVisible = ref(false)
const layoutRecommendation = ref<LayoutRecommendation | null>(null)
const parentPool = computed(() => getParentPoolByPlanId(planId))

function openLayoutDialog() {
  if (!parentPool.value) {
    ElMessage.warning('暂无亲本池数据，请先添加个体并设置亲本')
    return
  }
  layoutRecommendation.value = generateLayoutRecommendation(
    allGroups.value,
    parentPool.value,
    individuals,
  )
  if (layoutRecommendation.value.pairs.length === 0) {
    ElMessage.info('当前没有可推荐的布局方案')
    return
  }
  layoutDialogVisible.value = true
}

function applyLayoutRecommendation() {
  if (!layoutRecommendation.value) return
  for (const pair of layoutRecommendation.value.pairs) {
    updateGroup(pair.groupId, {
      fatherId: pair.fatherId,
      motherId: pair.motherId,
    })
  }
  refreshGroups()
  layoutDialogVisible.value = false
  ElMessage.success('布局已应用')
}

// ── 添加个体 ──
const individualDialogVisible = ref(false)
const individualForm = reactive({
  currentFormId: undefined as number | undefined,
  gender: 'male',
  height: 0,
  weight: 0,
  sizeMedal: '',
  voiceMedal: '',
  personality: '',
  specialty: '',
  location: 'bag' as 'bag' | 'home',
  /** 当前阶段体重（记录为 GrowthRecord） */
  growWeight: 0,
})

function openAddIndividual() {
  individualForm.currentFormId = undefined
  individualForm.gender = 'male'
  individualForm.height = 0
  individualForm.weight = 0
  individualForm.sizeMedal = ''
  individualForm.voiceMedal = ''
  individualForm.personality = ''
  individualForm.specialty = ''
  individualForm.location = 'bag'
  individualForm.growWeight = 0
  individualDialogVisible.value = true
}

const canSaveIndividual = computed(
  () => individualForm.currentFormId !== undefined && individualForm.height > 0 && individualForm.weight > 0 && individualForm.sizeMedal && individualForm.voiceMedal,
)

function onIndividualSave() {
  if (!canSaveIndividual.value || individualForm.currentFormId === undefined) return
  const family = getFamilyOfForm(individualForm.currentFormId)
  if (!family) return
  const newInd = addIndividual({
    familyId: family.familyId,
    currentFormId: individualForm.currentFormId,
    gender: individualForm.gender,
    height: individualForm.height,
    weight: individualForm.weight,
    sizeMedal: individualForm.sizeMedal,
    voiceMedal: individualForm.voiceMedal,
    personality: individualForm.personality,
    specialty: individualForm.specialty,
    location: individualForm.location,
  })
  // 记录当前阶段体重
  if (individualForm.growWeight > 0) {
    addGrowthRecord(newInd.id, {
      formId: individualForm.currentFormId,
      weight: individualForm.growWeight,
    })
  }
  ElMessage.success('个体已添加')
  individualDialogVisible.value = false
}

function individualLabel(i: Individual): string {
  const gender = i.gender === 'male' ? '♂' : '♀'
  const medals = [i.sizeMedal, i.voiceMedal].filter(Boolean).join('+')
  const eggInfo = i.hatchedFromEggId ? ` (蛋#${i.hatchedFromEggId})` : ''
  const traits = [i.personality, i.specialty].filter(Boolean).join('/')
  const name = getFormName(i.currentFormId) || `#${i.id}`
  return `#${i.id} ${name} ${gender} ${i.weight}kg ${medals || '无奖牌'}${traits ? ` [${traits}]` : ''}${eggInfo}`
}

// ── 孵蛋箱（最多3个槽位）──
const hatchSlots = computed(() => getHatchingEggsByPlanId(planId))
const now = ref(Date.now())

// 每30秒刷新一次当前时间，用于计算已孵时长
let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 30000)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

function eggGroupLabel(egg: EggRecord): string {
  const group = getGroupById(egg.sourceGroupId)
  return `第${group?.groupNo ?? '?'}组`
}

/** 蛋的精灵跟随母本（无母本时才看父本） */
function getEggPokemonName(egg: EggRecord): string {
  const group = getGroupById(egg.sourceGroupId)
  const parent = getIndividualById(group?.motherId ?? -1) ?? getIndividualById(group?.fatherId ?? -1)
  return parent ? getFormName(parent.currentFormId) : ''
}

/** 时间显示：MM-DD HH:mm */
function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 已孵时长：X小时Y分钟 / X分钟 / 刚刚 */
function elapsedText(iso?: string): string {
  if (!iso) return '—'
  const start = new Date(iso).getTime()
  if (Number.isNaN(start)) return '—'
  const diff = Math.max(0, Math.floor((now.value - start) / 1000))
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h > 0) return `${h}小时${m}分钟`
  if (m > 0) return `${m}分钟`
  return '刚刚'
}

// 可放入孵蛋箱的蛋（状态=未处理）
const incubatorCandidates = computed(() =>
  getUnhatchedEggsByPlanId(planId).map(e => ({
    ...e,
    label: `蛋#${e.id} ${eggGroupLabel(e)} ${e.height}m/${e.weight}kg`,
  })),
)

const incubatorFull = computed(() => hatchSlots.value.every(s => s.egg !== undefined))
const canStartHatch = computed(() => incubatorCandidates.value.length > 0 && !incubatorFull.value)

// ── 开始孵蛋弹窗：只选蛋，放进孵蛋箱 ──
const startDialogVisible = ref(false)
const startEggId = ref<number | undefined>(undefined)

function openStartDialog() {
  startEggId.value = undefined
  startDialogVisible.value = true
}

function onStartConfirm() {
  if (startEggId.value === undefined) return
  const result = startHatch(startEggId.value)
  if (!result) {
    ElMessage.warning('放入失败：蛋不存在、不可孵或孵蛋箱已满')
    return
  }
  ElMessage.success('已放入孵蛋箱，开始孵蛋！')
  startDialogVisible.value = false
}

// ── 孵化弹窗：对孵蛋箱中的蛋补录个体数据 ──
const hatchDialogVisible = ref(false)
const hatchForm = reactive({
  eggId: undefined as number | undefined,
  familyId: undefined as number | undefined,
  currentFormId: undefined as number | undefined,
  gender: 'male',
  height: 0,
  weight: 0,
  sizeMedal: '',
  voiceMedal: '',
  personality: '',
  specialty: '',
  // 孵化后是否立即进化（可选，只对一阶形态有效）
  evolveAfterHatch: false,
  evolveWeight: 0,
  evolveHeight: 0,
  evolveLevel: 0,
})

function openHatchDialog(egg: EggRecord) {
  hatchForm.eggId = egg.id
  hatchForm.gender = 'male'
  hatchForm.height = egg.height
  hatchForm.weight = egg.weight
  hatchForm.sizeMedal = ''
  hatchForm.voiceMedal = ''
  hatchForm.personality = ''
  hatchForm.specialty = ''
  hatchForm.evolveAfterHatch = false
  hatchForm.evolveWeight = egg.weight
  hatchForm.evolveHeight = egg.height
  hatchForm.evolveLevel = 0
  // 蛋的精灵跟随母本（无母本时才看父本）；1级孵化为一阶形态
  const group = getGroupById(egg.sourceGroupId)
  const parent = getIndividualById(group?.motherId ?? -1) ?? getIndividualById(group?.fatherId ?? -1)
  hatchForm.familyId = parent?.familyId
  hatchForm.currentFormId =
    parent?.familyId !== undefined ? getInitialFormId(parent.familyId) : undefined
  hatchDialogVisible.value = true
}

const canHatch = computed(() =>
  hatchForm.eggId !== undefined &&
  hatchForm.currentFormId !== undefined &&
  hatchForm.height > 0 &&
  hatchForm.weight > 0 &&
  hatchForm.sizeMedal &&
  hatchForm.voiceMedal,
)

/** 孵化时可选进化：需开启且一阶有下一阶段 */
const canEvolveOnHatch = computed(() => {
  if (!hatchForm.evolveAfterHatch || hatchForm.familyId === undefined) return false
  const family = getFamilyById(hatchForm.familyId)
  if (!family) return false
  const currentForm = family.forms.find(f => f.formId === hatchForm.currentFormId)
  return !!currentForm && family.forms.some(f => f.stage === currentForm.stage + 1)
})

/** 孵化时下一形态名（提示用） */
const nextFormNameOnHatch = computed(() => {
  if (hatchForm.familyId === undefined || hatchForm.currentFormId === undefined) return '?'
  const family = getFamilyById(hatchForm.familyId)
  if (!family) return '?'
  const currentForm = family.forms.find(f => f.formId === hatchForm.currentFormId)
  if (!currentForm) return '?'
  const next = family.forms.find(f => f.stage === currentForm.stage + 1)
  return next ? getFormName(next.formId) : '最终形态'
})

function onHatchConfirm() {
  if (!canHatch.value || hatchForm.eggId === undefined || hatchForm.currentFormId === undefined || hatchForm.familyId === undefined) return
  const result = hatchEgg(hatchForm.eggId, {
    familyId: hatchForm.familyId,
    currentFormId: hatchForm.currentFormId,
    gender: hatchForm.gender,
    height: hatchForm.height,
    weight: hatchForm.weight,
    sizeMedal: hatchForm.sizeMedal,
    voiceMedal: hatchForm.voiceMedal,
    personality: hatchForm.personality,
    specialty: hatchForm.specialty,
  })
  if (!result) {
    ElMessage.warning('孵化失败：蛋不在孵蛋箱中')
    return
  }
  // 记录孵化个体的初始形态体重
  addGrowthRecord(result.individual.id, {
    formId: result.individual.currentFormId,
    weight: result.individual.weight,
  })
  // 孵化后可选进化：记录一阶体重并进化到下一阶段
  if (canEvolveOnHatch.value && hatchForm.evolveWeight > 0) {
    const evolved = evolveIndividual(result.individual.id, {
      weight: hatchForm.evolveWeight,
      height: hatchForm.evolveHeight > 0 ? hatchForm.evolveHeight : undefined,
      level: hatchForm.evolveLevel > 0 ? hatchForm.evolveLevel : undefined,
    })
    if (evolved) {
      ElMessage.success(
        `孵化成功！个体 #${result.individual.id} 已进化至 ${getFormName(evolved.nextForm.formId)}`,
      )
      hatchDialogVisible.value = false
      return
    }
  }
  ElMessage.success(`孵化成功！个体 #${result.individual.id} 已创建`)
  hatchDialogVisible.value = false
}

// ── 新增蛋弹窗（只需选来源组，方向/精灵自动带出）──
const addEggDialogVisible = ref(false)
const addEggForm = reactive({
  sourceGroupId: undefined as number | undefined,
  height: 0,
  weight: 0,
})

// 可选来源组：组号 + 方向 + 亲本精灵，未分配方向的组不可选
const addEggGroupOptions = computed(() =>
  allGroups.value.map(g => {
    const task = g.taskId ? tasks.find(t => t.id === g.taskId) : undefined
    const father = getIndividualById(g.fatherId ?? -1)
    const mother = getIndividualById(g.motherId ?? -1)
    const parents = [formNameOf(father), formNameOf(mother)].filter(Boolean).join('×')
    return {
      id: g.id,
      label: `第${g.groupNo}组${task ? `（${task.name}）` : '（未分配方向）'}${parents ? ` · ${parents}` : ''}`,
      available: !!task,
    }
  }),
)

const canSubmitEgg = computed(() =>
  addEggForm.sourceGroupId !== undefined &&
  addEggForm.height > 0 &&
  addEggForm.weight > 0,
)

function openAddEggDialog() {
  addEggForm.sourceGroupId = undefined
  addEggForm.height = 0
  addEggForm.weight = 0
  addEggDialogVisible.value = true
}

function onAddEggConfirm() {
  if (!canSubmitEgg.value || addEggForm.sourceGroupId === undefined) return
  const group = allGroups.value.find(g => g.id === addEggForm.sourceGroupId)
  if (!group || group.taskId === null) {
    ElMessage.warning('该组未分配培育方向，不能产蛋')
    return
  }
  addEggRecord({
    taskId: group.taskId,
    sourceGroupId: group.id,
    height: addEggForm.height,
    weight: addEggForm.weight,
  })
  ElMessage.success('蛋已放入背包！')
  addEggDialogVisible.value = false
}



</script>

<template>
  <div class="breeding-detail">
    <template v-if="plan">
      <!-- Header -->
      <div class="detail-header">
        <div>
          <h2>{{ plan.name }}</h2>
          <div class="header-info">
            <span>账号：{{ plan.accountName }}</span>
          </div>
        </div>
        <div class="header-actions">
          <el-button @click="openPlanEdit">编辑计划</el-button>
          <el-button @click="router.push(`/breeding/${planId}/backpack`)">背包</el-button>
          <el-button type="success" @click="goToStats">统计</el-button>
          <el-button type="primary" @click="openAddEggDialog">新增蛋</el-button>
          <el-button type="warning" :disabled="!canStartHatch" @click="openStartDialog">
            开始孵蛋
          </el-button>
        </div>
      </div>

      <!-- 小窝分配总览 -->
      <div class="section group-overview">
        <div class="section-header">
          <h4>小窝分配总览（{{ allGroups.length }}组 / {{ allGroups.length * 2 }}小窝）</h4>
          <div class="section-header-actions">
            <el-button size="small" @click="openAddIndividual">添加个体</el-button>
            <el-button size="small" type="primary" :disabled="!canAddGroup" @click="openGroupCreate">
              新增小组
            </el-button>
            <el-button size="small" type="success" @click="openLayoutDialog">
              布局推荐
            </el-button>
          </div>
        </div>
        <div v-if="allGroupOverview.length > 0" class="group-slots">
          <div v-for="row in allGroupOverview" :key="row.id" class="group-slot">
            <div class="group-slot-head">
              <span class="group-slot-no">第{{ row.groupNo }}组</span>
              <el-tag v-if="row.taskName" size="small" type="success">{{ row.taskName }}</el-tag>
              <el-tag v-else size="small" type="info">未分配</el-tag>
            </div>

            <div class="group-slot-parents">
              <div class="parent-cell">
                <div class="avatar-clickable" @click="row.father && showIndividual(row.father.id)">
                  <PokemonAvatar
                    :name="formNameOf(row.father)"
                    :gender="row.father?.gender"
                    :placeholder="!row.father"
                    :size="64"
                  />
                </div>
                <div class="parent-name">{{ row.father ? formNameOf(row.father) : '未设置' }}</div>
                <div class="parent-weight">{{ row.father ? `${row.father.weight}kg` : '—' }}</div>
              </div>

              <div class="parent-divider">×</div>

              <div class="parent-cell">
                <div class="avatar-clickable" @click="row.mother && showIndividual(row.mother.id)">
                  <PokemonAvatar
                    :name="formNameOf(row.mother)"
                    :gender="row.mother?.gender"
                    :placeholder="!row.mother"
                    :size="64"
                  />
                </div>
                <div class="parent-name">{{ row.mother ? formNameOf(row.mother) : '未设置' }}</div>
                <div class="parent-weight">{{ row.mother ? `${row.mother.weight}kg` : '—' }}</div>
              </div>
            </div>

            <div class="group-slot-actions">
              <el-button text size="small" @click="openGroupEdit(allGroups.find(g => g.id === row.id)!)">
                编辑
              </el-button>
              <el-button text size="small" type="danger" @click="onGroupRemove(row.id, row.groupNo)">
                删除
              </el-button>
            </div>
          </div>
        </div>
        <el-empty
          v-else
          description="还没有小组，点击「新增小组」开始分配小窝"
          :image-size="60"
        />
      </div>

      <!-- 孵蛋箱（最多3个槽位） -->
      <div class="section">
        <div class="section-header">
          <h4>孵蛋箱（{{ hatchSlots.filter(s => s.egg).length }}/3）</h4>
          <div class="section-header-actions">
            <el-button size="small" type="warning" :disabled="!canStartHatch" @click="openStartDialog">
              开始孵蛋
            </el-button>
          </div>
        </div>
        <div v-if="hatchSlots.some(s => s.egg)" class="hatch-slots">
          <div
            v-for="slot in hatchSlots"
            :key="slot.slotNo"
            class="hatch-slot"
            :class="{ 'hatch-slot--empty': !slot.egg }"
          >
            <template v-if="slot.egg">
              <div class="hatch-slot-main">
                <div class="hatch-slot-egg">
                  <PokemonAvatar
                    :name="getEggPokemonName(slot.egg)"
                    :egg="true"
                    :size="64"
                    :placeholder="!getEggPokemonName(slot.egg)"
                  />
                  <span class="hatch-slot-egg-name">
                    {{ getEggPokemonName(slot.egg) || '未知精灵' }}
                  </span>
                </div>
                <div class="hatch-slot-body">
                  <div class="hatch-slot-title">
                    <span class="hatch-slot-no">槽位{{ slot.slotNo }}</span>
                    <el-tag size="small" type="warning">孵蛋中</el-tag>
                  </div>
                  <p class="hatch-slot-meta">
                    <strong>蛋#{{ slot.egg.id }}</strong> · {{ eggGroupLabel(slot.egg) }}
                  </p>
                  <p class="hatch-slot-meta">{{ slot.egg.height }}m / {{ slot.egg.weight }}kg</p>
                  <p class="hatch-slot-meta">开始：{{ formatDateTime(slot.egg.hatchStartTime) }}</p>
                  <p class="hatch-slot-elapsed">已孵 {{ elapsedText(slot.egg.hatchStartTime) }}</p>
                  <el-button type="primary" size="small" @click="openHatchDialog(slot.egg!)">
                    孵化
                  </el-button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="hatch-slot-head">
                <span class="hatch-slot-no">槽位{{ slot.slotNo }}</span>
              </div>
              <div class="hatch-slot-body">
                <p class="hatch-slot-empty-text">空</p>
              </div>
            </template>
          </div>
        </div>
        <el-empty
          v-else
          description="孵蛋箱是空的，先把蛋放进来吧"
          :image-size="60"
        />
      </div>

      <!-- 编辑计划弹窗 -->
      <el-dialog v-model="planDialogVisible" title="编辑计划" width="480px">
        <el-form :model="planForm" label-width="80px">
          <el-form-item label="计划名" required>
            <el-input v-model="planForm.name" placeholder="如：罗隐奖牌培育计划" />
          </el-form-item>
          <el-form-item label="账号" required>
            <el-input v-model="planForm.accountName" placeholder="如：账号1" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="planDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :disabled="!planForm.name.trim() || !planForm.accountName.trim()"
            @click="onPlanSave"
          >
            保存
          </el-button>
        </template>
      </el-dialog>

      <!-- 编辑/新建小组弹窗 -->
      <el-dialog
        v-model="groupDialogVisible"
        :title="editingGroupId !== null ? `编辑第${allGroups.find(g => g.id === editingGroupId)?.groupNo}组` : '新建小组'"
        width="500px"
      >
        <el-form :model="groupForm" label-width="80px">
          <el-form-item label="培育方向">
            <el-select v-model="groupForm.taskId" placeholder="未分配" clearable style="width: 100%">
              <el-option
                v-for="t in tasks"
                :key="t.id"
                :label="`${t.name}（${t.sizeMedal}+${t.voiceMedal}）`"
                :value="t.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="父本 (♂)">
            <el-select v-model="groupForm.fatherId" placeholder="选择雄性个体" clearable style="width: 100%">
              <el-option
                v-for="i in maleIndividuals"
                :key="i.id"
                :label="individualLabel(i)"
                :value="i.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="母本 (♀)">
            <el-select v-model="groupForm.motherId" placeholder="选择雌性个体" clearable style="width: 100%">
              <el-option
                v-for="i in femaleIndividuals"
                :key="i.id"
                :label="individualLabel(i)"
                :value="i.id"
              />
            </el-select>
          </el-form-item>
          <div v-if="maleIndividuals.length === 0 && femaleIndividuals.length === 0" class="no-individuals-hint">
            <el-alert
              title="暂无个体"
              description="请先点击「添加个体」创建亲本，再配置小组"
              type="info"
              :closable="false"
              show-icon
            />
          </div>
        </el-form>
        <template #footer>
          <el-button @click="groupDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="onGroupSave">保存</el-button>
        </template>
      </el-dialog>

      <!-- 布局推荐弹窗 -->
      <el-dialog v-model="layoutDialogVisible" title="小窝布局推荐" width="620px">
        <el-alert
          title="系统根据亲本池 Top5 自动生成推荐配对方案"
          description="手动调整过的小组不会被覆盖。您可以选择应用推荐方案或忽略。"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
        />
        <div v-if="layoutRecommendation">
          <div v-if="layoutRecommendation.skippedGroups.length > 0" style="margin-bottom: 12px">
            <el-tag size="small" type="warning">
              跳过手动调整的组：{{ layoutRecommendation.skippedGroups.map(n => `第${n}组`).join('、') }}
            </el-tag>
          </div>
          <el-table :data="layoutRecommendation.pairs" border stripe size="small">
            <el-table-column label="目标组" width="80" align="center">
              <template #default="{ row }">第{{ row.groupNo }}组</template>
            </el-table-column>
            <el-table-column label="推荐父本 ♂" min-width="140">
              <template #default="{ row }">
                <template v-if="row.fatherId">
                  <span>{{ getFormName(getIndividualById(row.fatherId)?.currentFormId ?? -1) }}</span>
                  <span style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: 6px">
                    #{{ row.fatherId }} · {{ row.fatherWeight }}kg
                  </span>
                </template>
                <span v-else class="empty-slot">—</span>
              </template>
            </el-table-column>
            <el-table-column label="推荐母本 ♀" min-width="140">
              <template #default="{ row }">
                <template v-if="row.motherId">
                  <span>{{ getFormName(getIndividualById(row.motherId)?.currentFormId ?? -1) }}</span>
                  <span style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: 6px">
                    #{{ row.motherId }} · {{ row.motherWeight }}kg
                  </span>
                </template>
                <span v-else class="empty-slot">—</span>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="layoutRecommendation.unusedMales.length > 0 || layoutRecommendation.unusedFemales.length > 0" style="margin-top: 12px">
            <el-tag v-if="layoutRecommendation.unusedMales.length > 0" size="small" type="info" style="margin-right: 8px">
              未使用父本：{{ layoutRecommendation.unusedMales.map(id => `#${id}`).join('、') }}
            </el-tag>
            <el-tag v-if="layoutRecommendation.unusedFemales.length > 0" size="small" type="info">
              未使用母本：{{ layoutRecommendation.unusedFemales.map(id => `#${id}`).join('、') }}
            </el-tag>
          </div>
        </div>
        <template #footer>
          <el-button @click="layoutDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="applyLayoutRecommendation">应用推荐方案</el-button>
        </template>
      </el-dialog>

      <!-- 添加个体弹窗 -->
      <el-dialog v-model="individualDialogVisible" title="添加个体" width="480px">
        <el-form :model="individualForm" label-width="90px">
          <el-form-item label="精灵" required>
            <el-select v-model="individualForm.currentFormId" placeholder="选择精灵（家族·阶段）" filterable style="width: 100%">
              <el-option
                v-for="f in formOptions"
                :key="f.form.formId"
                :label="`${f.form.name}（${f.family.familyName}·阶段${f.form.stage}）`"
                :value="f.form.formId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="性别" required>
            <el-radio-group v-model="individualForm.gender">
              <el-radio value="male">雄性 ♂</el-radio>
              <el-radio value="female">雌性 ♀</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="身高 (m)" required>
            <el-input-number v-model="individualForm.height" :precision="2" :step="0.01" :min="0" />
          </el-form-item>
          <el-form-item label="体重 (kg)" required>
            <el-input-number v-model="individualForm.weight" :precision="2" :step="0.1" :min="0" />
          </el-form-item>
          <el-form-item label="阶段体重">
            <el-input-number v-model="individualForm.growWeight" :precision="2" :step="0.1" :min="0" />
            <span class="hatch-evolve-tip">记录当前阶段的体重（可选，写入成长记录）</span>
          </el-form-item>
          <el-form-item label="体型奖牌" required>
            <el-select v-model="individualForm.sizeMedal" placeholder="选择体型奖牌" style="width: 100%">
              <el-option label="大块头" value="大块头" />
              <el-option label="小不点" value="小不点" />
              <el-option label="普通" value="普通" />
            </el-select>
          </el-form-item>
          <el-form-item label="声音奖牌" required>
            <el-select v-model="individualForm.voiceMedal" placeholder="选择声音奖牌" style="width: 100%">
              <el-option label="婉转声" value="婉转声" />
              <el-option label="粗嗓门" value="粗嗓门" />
            </el-select>
          </el-form-item>
          <el-form-item label="性格">
            <el-input v-model="individualForm.personality" placeholder="如：固执、开朗、胆小" />
          </el-form-item>
          <el-form-item label="特长">
            <el-input v-model="individualForm.specialty" placeholder="如：攻击、防御、速度" />
          </el-form-item>
          <el-form-item label="所在位置">
            <el-radio-group v-model="individualForm.location">
              <el-radio value="bag">背包</el-radio>
              <el-radio value="home">家园</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="individualDialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!canSaveIndividual" @click="onIndividualSave">添加</el-button>
        </template>
      </el-dialog>

      <!-- 开始孵蛋弹窗：只选蛋，放入孵蛋箱 -->
      <el-dialog v-model="startDialogVisible" title="开始孵蛋" width="480px">
        <el-form label-width="90px">
          <el-form-item label="选择蛋" required>
            <el-select v-model="startEggId" placeholder="选择要孵的蛋" style="width: 100%">
              <el-option
                v-for="e in incubatorCandidates"
                :key="e.id"
                :label="e.label"
                :value="e.id"
              />
            </el-select>
          </el-form-item>
          <el-alert
            v-if="incubatorCandidates.length === 0"
            title="没有可孵的蛋"
            description="请先点击「新增蛋」记录蛋的身高体重，才能放入孵蛋箱"
            type="info"
            :closable="false"
            show-icon
          />
          <el-alert
            v-else-if="incubatorFull"
            title="孵蛋箱已满"
            description="3个槽位都在使用中，请先孵化其中一个"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top: 8px"
          />
        </el-form>
        <template #footer>
          <el-button @click="startDialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="startEggId === undefined" @click="onStartConfirm">
            放入孵蛋箱
          </el-button>
        </template>
      </el-dialog>

      <!-- 孵化弹窗：对孵蛋箱中的蛋补录个体数据 -->
      <el-dialog v-model="hatchDialogVisible" title="孵化完成 · 记录个体" width="520px">
        <el-alert
          title="补录孵化出的个体数据"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
        />
        <el-form :model="hatchForm" label-width="90px">
          <el-form-item label="精灵">
            <el-input
              :model-value="hatchForm.currentFormId !== undefined ? getFormName(hatchForm.currentFormId) : ''"
              disabled
            >
              <template #suffix>
                <el-tooltip content="1级孵化为该家族的一阶形态，跟随来源组亲本家族" placement="top">
                  <span class="hatch-auto-hint">自动</span>
                </el-tooltip>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="性别" required>
            <el-radio-group v-model="hatchForm.gender">
              <el-radio value="male">雄性 ♂</el-radio>
              <el-radio value="female">雌性 ♀</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="身高 (m)" required>
            <el-input-number v-model="hatchForm.height" :precision="2" :step="0.01" :min="0" />
          </el-form-item>
          <el-form-item label="体重 (kg)" required>
            <el-input-number v-model="hatchForm.weight" :precision="2" :step="0.1" :min="0" />
          </el-form-item>
          <el-form-item label="体型奖牌" required>
            <el-select v-model="hatchForm.sizeMedal" placeholder="选择体型奖牌" style="width: 100%">
              <el-option label="大块头" value="大块头" />
              <el-option label="小不点" value="小不点" />
              <el-option label="普通" value="普通" />
            </el-select>
          </el-form-item>
          <el-form-item label="声音奖牌" required>
            <el-select v-model="hatchForm.voiceMedal" placeholder="选择声音奖牌" style="width: 100%">
              <el-option label="婉转声" value="婉转声" />
              <el-option label="粗嗓门" value="粗嗓门" />
            </el-select>
          </el-form-item>
          <el-form-item label="性格">
            <el-input v-model="hatchForm.personality" placeholder="如：固执、开朗、胆小" />
          </el-form-item>
          <el-form-item label="特长">
            <el-input v-model="hatchForm.specialty" placeholder="如：攻击、防御、速度" />
          </el-form-item>

          <!-- 孵化后可选进化 -->
          <el-divider content-position="left">孵化后进化（可选）</el-divider>
          <el-form-item label="是否进化">
            <el-switch v-model="hatchForm.evolveAfterHatch" />
            <span class="hatch-evolve-tip">
              开启后孵化即进化到下一阶段（{{ getFormName(hatchForm.currentFormId ?? -1) }}
              → {{ hatchForm.familyId !== undefined ? nextFormNameOnHatch : '?' }}）
            </span>
          </el-form-item>
          <template v-if="hatchForm.evolveAfterHatch">
            <el-form-item label="阶段体重" required>
              <el-input-number v-model="hatchForm.evolveWeight" :precision="2" :step="0.1" :min="0" />
              <span class="hatch-evolve-tip">记录当前阶段的体重（必须）</span>
            </el-form-item>
            <el-form-item label="阶段身高">
              <el-input-number v-model="hatchForm.evolveHeight" :precision="2" :step="0.01" :min="0" />
            </el-form-item>
            <el-form-item label="等级">
              <el-input-number v-model="hatchForm.evolveLevel" :min="0" :max="200" />
            </el-form-item>
          </template>
        </el-form>
        <template #footer>
          <el-button @click="hatchDialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!canHatch" @click="onHatchConfirm">确认孵化</el-button>
        </template>
      </el-dialog>



      <!-- 新增蛋弹窗 -->
      <el-dialog
        v-model="addEggDialogVisible"
        title="新增蛋"
        width="480px"
        append-to-body
      >
        <el-form :model="addEggForm" label-width="100px">
          <el-form-item label="来源组" required>
            <el-select
              v-model="addEggForm.sourceGroupId"
              placeholder="选择产出蛋的组（方向自动带出）"
              style="width: 100%"
            >
              <el-option
                v-for="g in addEggGroupOptions"
                :key="g.id"
                :label="g.label"
                :value="g.id"
                :disabled="!g.available"
              />
            </el-select>
            <div class="egg-form-hint">方向与精灵从所选组的配置自动识别</div>
          </el-form-item>

          <el-form-item label="身高 (m)" required>
            <el-input-number v-model="addEggForm.height" :precision="2" :step="0.01" :min="0" />
          </el-form-item>

          <el-form-item label="体重 (kg)" required>
            <el-input-number v-model="addEggForm.weight" :precision="2" :step="0.1" :min="0" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="addEggDialogVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!canSubmitEgg" @click="onAddEggConfirm">
            保存
          </el-button>
        </template>
      </el-dialog>

      <!-- 个体详情弹窗 -->
      <IndividualDetailDialog
        :individual-id="individualDetailId"
        @close="individualDetailId = null"
      />
    </template>
    <el-empty v-else description="未找到该培育计划" />
  </div>
</template>

<style scoped>
.avatar-clickable {
  cursor: pointer;
  border-radius: 50%;
  transition: transform 0.15s ease;
}
.avatar-clickable:hover {
  transform: scale(1.06);
}
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}
.detail-header h2 {
  margin: 0 0 8px 0;
}
.header-info {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.task-tabs {
  margin-top: 8px;
}
.section {
  margin-top: 24px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-header h4 {
  margin: 0;
}
.section-header-actions {
  display: flex;
  gap: 8px;
}
.section h4 {
  margin: 0 0 12px 0;
}
.section-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 0 0 12px 0;
}
.no-individuals-hint {
  margin-top: 8px;
}
.hatch-slots {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.hatch-slot {
  flex: 1;
  min-width: 230px;
  max-width: 300px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--el-bg-color-overlay);
}
.hatch-slot-main {
  display: flex;
  align-items: center;
  gap: 14px;
}
.hatch-slot-egg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.hatch-slot-egg-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hatch-slot-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.hatch-slot-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.hatch-slot-body p {
  margin: 0;
}
.hatch-slot-meta {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.hatch-slot-elapsed {
  color: var(--el-color-warning);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px !important;
}
.hatch-auto-hint {
  font-size: 11px;
  color: var(--el-color-info);
  background: var(--el-fill-color);
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
}
.hatch-evolve-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}
.hatch-slot--empty {
  border-style: dashed;
  background: transparent;
}
.hatch-slot-no {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.hatch-slot-empty-text {
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 8px 0;
}
.group-slots {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.group-slot {
  flex: 1;
  min-width: 230px;
  max-width: 260px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 14px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--el-bg-color-overlay);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.group-slot:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}
.group-slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.group-slot-no {
  font-weight: 600;
}
.group-slot-parents {
  display: flex;
  align-items: flex-start;
  justify-content: space-around;
}
.parent-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
}
.parent-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.parent-weight {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.parent-divider {
  align-self: center;
  color: var(--el-text-color-placeholder);
  font-size: 16px;
  padding: 0 4px;
}
.group-slot-actions {
  display: flex;
  justify-content: center;
  gap: 4px;
  border-top: 1px dashed var(--el-border-color-lighter);
  padding-top: 8px;
}
.empty-slot {
  color: var(--el-text-color-placeholder);
}
.egg-form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-top: 4px;
}
</style>
