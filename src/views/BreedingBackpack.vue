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
  getAllEggRecordsByPlanId,
  addIndividual,
  startHatch,
  hatchEgg,
  addEggRecord,
  applyReplacement,
  getReplacementRecordsByPlanId,
  switchIndividualLocation,
  getIndividualDisplayName,
  evolveIndividual,
  getParentPoolByPlanId,
  getAllGrowthRecords,
  updateParentPool,
  addGrowthRecord,
} from '../services/breedingService'
import { getAllFormsWithFamily, getFormName, getFamilyOfForm, getInitialFormId, getFamilyById } from '../services/pokemonService'
import { generateReplacementSuggestions } from '../utils/replacementAdvisor'
import type { Individual, BreedingGroup, EggRecord } from '../types'
import PokemonAvatar from '../components/PokemonAvatar.vue'
import IndividualDetailDialog from '../components/IndividualDetailDialog.vue'

const route = useRoute()
const router = useRouter()

const planId = Number(route.params.id)
const plan = computed(() => getPlanById(planId))
const tasks = getTasksByPlanId(planId)
const individuals = getAllIndividuals()
const allGroups = ref<BreedingGroup[]>(getGroupsByPlanId(planId))
const formOptions = getAllFormsWithFamily()

const parentPool = computed(() => getParentPoolByPlanId(planId))

function back() {
  router.push(`/breeding/${planId}`)
}

function refreshGroups() {
  allGroups.value = getGroupsByPlanId(planId)
}

function formNameOf(i?: Individual): string {
  return i ? getFormName(i.currentFormId) : ''
}

// ── 个体详情弹窗 ──
const individualDetailId = ref<number | null>(null)

function showIndividual(id: number) {
  individualDetailId.value = id
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

const maleIndividuals = computed(() =>
  getAllIndividuals().filter(i => i.gender === 'male'),
)
const femaleIndividuals = computed(() =>
  getAllIndividuals().filter(i => i.gender === 'female'),
)

// ── 切换位置 ──
function onSwitchLocation(id: number) {
  const result = switchIndividualLocation(id)
  if (!result) return
  ElMessage.success(result.location === 'home' ? '已放入家园' : '已收回背包')
}

// ── 蛋相关 ──
function eggGroupLabel(egg: EggRecord): string {
  const group = getGroupById(egg.sourceGroupId)
  return `第${group?.groupNo ?? '?'}组`
}

function getEggPokemonName(egg: EggRecord): string {
  const group = getGroupById(egg.sourceGroupId)
  const parent = getIndividualById(group?.motherId ?? -1) ?? getIndividualById(group?.fatherId ?? -1)
  return parent ? getFormName(parent.currentFormId) : ''
}

/** 该计划所有蛋，按获取时间倒序 */
const backpackEggs = computed(() =>
  getAllEggRecordsByPlanId(planId)
    .slice()
    .sort((a, b) => (b.acquiredAt || '').localeCompare(a.acquiredAt || ''))
    .map(e => ({
      ...e,
      taskName: tasks.find(t => t.id === e.taskId)?.name ?? '未知方向',
      groupNo: getGroupById(e.sourceGroupId)?.groupNo ?? '?',
    })),
)

function getHatchedIndividualInfo(eggId: number): string {
  const ind = individuals.find(i => i.hatchedFromEggId === eggId)
  if (!ind) return '个体已创建'
  const gender = ind.gender === 'male' ? '♂' : '♀'
  const medals = [ind.sizeMedal, ind.voiceMedal].filter(Boolean).join('+')
  return `#${ind.id} ${gender} ${ind.weight}kg ${medals || '无奖牌'}`
}

function statusTagType(status: string) {
  switch (status) {
    case '已孵化': return 'success'
    case '孵蛋中': return 'warning'
    case '保留培养': return 'primary'
    case '淘汰': return 'danger'
    default: return 'info'
  }
}

// ── 孵蛋箱 ──
const hatchSlots = computed(() => getHatchingEggsByPlanId(planId))
const now = ref(Date.now())

let timer: number | undefined
onMounted(() => {
  timer = window.setInterval(() => { now.value = Date.now() }, 30000)
})
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

function onStartHatch(eggId: number) {
  const result = startHatch(eggId)
  if (!result) {
    ElMessage.warning('放入失败：孵蛋箱已满或该蛋不可孵')
    return
  }
  ElMessage.success('已放入孵蛋箱，开始孵蛋！')
}

// ── 孵化弹窗 ──
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

const canEvolveOnHatch = computed(() => {
  if (!hatchForm.evolveAfterHatch || hatchForm.familyId === undefined) return false
  const family = getFamilyById(hatchForm.familyId)
  if (!family) return false
  const currentForm = family.forms.find(f => f.formId === hatchForm.currentFormId)
  return !!currentForm && family.forms.some(f => f.stage === currentForm.stage + 1)
})

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

// ── 新增蛋弹窗 ──
const addEggDialogVisible = ref(false)
const addEggForm = reactive({
  sourceGroupId: undefined as number | undefined,
  height: 0,
  weight: 0,
})

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

// ── 替换建议 ──
const suggestions = computed(() =>
  parentPool.value
    ? generateReplacementSuggestions(individuals, allGroups.value, parentPool.value, getAllGrowthRecords())
    : [],
)

function onApplySuggestion(s: ReturnType<typeof generateReplacementSuggestions>[number]) {
  const roleText = s.role === 'father' ? '父本' : '母本'
  const oldName = s.oldIndividual ? getFormName(s.oldIndividual.currentFormId) : '（新位）'
  const newName = getFormName(s.newIndividual.currentFormId)
  const msg = s.oldIndividual
    ? `确定将第 ${s.groupNo ?? '?'} 组${roleText} ${oldName}（${s.oldWeight}kg）替换为 ${newName}（${s.newWeight}kg）吗？`
    : `确定将 ${newName}（${s.newWeight}kg）加入第 ${s.groupNo ?? '?'} 组${roleText}吗？（池未满，无替换）`

  ElMessageBox.confirm(msg, '执行替换', {
    type: 'warning',
    confirmButtonText: '确认替换',
    cancelButtonText: '取消',
  })
    .then(() => {
      let targetGroup: BreedingGroup | undefined
      if (s.groupId != null) {
        targetGroup = allGroups.value.find(g => g.id === s.groupId)
      }
      if (!targetGroup) {
        targetGroup = allGroups.value.find(g =>
          s.role === 'father' ? g.fatherId != null : g.motherId != null,
        )
      }
      if (!targetGroup) {
        targetGroup = allGroups.value[0]
      }

      const record = applyReplacement(targetGroup.id, s.role, s.newIndividual.id)
      if (!record) {
        ElMessage.warning('替换失败：组或个体不存在')
        return
      }

      if (parentPool.value) {
        const malePool =
          s.role === 'father'
            ? s.evictedId
              ? parentPool.value.maleParents.map(id => (id === s.evictedId ? s.newIndividual.id : id))
              : [...parentPool.value.maleParents, s.newIndividual.id].slice(0, 5)
            : parentPool.value.maleParents
        const femalePool =
          s.role === 'mother'
            ? s.evictedId
              ? parentPool.value.femaleParents.map(id => (id === s.evictedId ? s.newIndividual.id : id))
              : [...parentPool.value.femaleParents, s.newIndividual.id].slice(0, 5)
            : parentPool.value.femaleParents
        updateParentPool(planId, malePool, femalePool)
      }

      ElMessage.success('替换成功，亲本池已更新！')
      refreshGroups()
    })
    .catch(() => {})
}

// ── 替换记录 ──
const replacementRecords = computed(() =>
  getReplacementRecordsByPlanId(planId).map(r => ({
    ...r,
    taskName: r.taskId ? tasks.find(t => t.id === r.taskId)?.name ?? '未知方向' : '未分配方向',
    oldName: getIndividualDisplayName(r.oldIndividualId),
    newName: getIndividualDisplayName(r.newIndividualId),
    oldGender: getIndividualById(r.oldIndividualId)?.gender ?? '',
    newGender: getIndividualById(r.newIndividualId)?.gender ?? '',
  })),
)

// ── tab ──
const backpackTab = ref('individuals')
</script>

<template>
  <div v-if="!plan">
    <el-empty description="培育计划不存在" />
  </div>
  <div v-else class="backpack-page">
    <!-- Header -->
    <div class="detail-header">
      <div>
        <h2>{{ plan.name }} · 背包</h2>
        <div class="header-info">{{ plan.accountName }}</div>
      </div>
      <div class="header-actions">
        <el-button size="small" type="primary" @click="openAddIndividual">添加个体</el-button>
        <el-button size="small" type="primary" @click="openAddEggDialog">新增蛋</el-button>
        <el-button @click="back">返回培育详情</el-button>
      </div>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="backpackTab">
      <!-- 精灵 -->
      <el-tab-pane :label="`精灵（${individuals.length}）`" name="individuals">
        <el-table :data="individuals" border stripe size="small">
          <el-table-column label="精灵" min-width="140">
            <template #default="{ row }">
              <div class="backpack-egg-cell">
                <div class="avatar-clickable" @click="showIndividual(row.id)">
                  <PokemonAvatar :name="formNameOf(row)" :gender="row.gender" :size="40" />
                </div>
                <div class="backpack-egg-info">
                  <span class="backpack-egg-name">{{ formNameOf(row) }}</span>
                  <span class="backpack-egg-id">
                    #{{ row.id }} {{ row.gender === 'male' ? '♂' : '♀' }}
                  </span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="身高" width="70" align="center">
            <template #default="{ row }">{{ row.height }}m</template>
          </el-table-column>
          <el-table-column label="体重" width="70" align="center">
            <template #default="{ row }">{{ row.weight }}kg</template>
          </el-table-column>
          <el-table-column label="体型奖牌" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.sizeMedal" size="small">{{ row.sizeMedal }}</el-tag>
              <span v-else class="empty-slot">—</span>
            </template>
          </el-table-column>
          <el-table-column label="声音奖牌" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.voiceMedal" size="small" type="info">{{ row.voiceMedal }}</el-tag>
              <span v-else class="empty-slot">—</span>
            </template>
          </el-table-column>
          <el-table-column label="性格" width="80">
            <template #default="{ row }">{{ row.personality || '—' }}</template>
          </el-table-column>
          <el-table-column label="特长" width="80">
            <template #default="{ row }">{{ row.specialty || '—' }}</template>
          </el-table-column>
          <el-table-column label="位置" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="(row.location ?? 'bag') === 'home'" size="small" type="success">家园</el-tag>
              <el-tag v-else size="small">背包</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ row }">
              <el-button
                v-if="(row.location ?? 'bag') === 'home'"
                text
                size="small"
                @click="onSwitchLocation(row.id)"
              >
                收回背包
              </el-button>
              <el-button
                v-else
                text
                size="small"
                type="success"
                @click="onSwitchLocation(row.id)"
              >
                放入家园
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="individuals.length === 0" description="还没有精灵" :image-size="60" />
      </el-tab-pane>

      <!-- 精灵蛋 -->
      <el-tab-pane :label="`精灵蛋（${backpackEggs.length}）`" name="eggs">
        <el-table :data="backpackEggs" border stripe size="small">
          <el-table-column label="精灵蛋" min-width="130">
            <template #default="{ row }">
              <div class="backpack-egg-cell">
                <PokemonAvatar
                  :name="getEggPokemonName(row)"
                  :egg="true"
                  :size="40"
                  :placeholder="!getEggPokemonName(row)"
                />
                <div class="backpack-egg-info">
                  <span class="backpack-egg-name">{{ getEggPokemonName(row) || '未知精灵' }}</span>
                  <span class="backpack-egg-id">蛋#{{ row.id }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="获取时间" width="110">
            <template #default="{ row }">{{ formatDateTime(row.acquiredAt) }}</template>
          </el-table-column>
          <el-table-column label="方向" width="90">
            <template #default="{ row }">
              <el-tag size="small" type="success">{{ row.taskName }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源组" width="70" align="center">
            <template #default="{ row }">第{{ row.groupNo }}组</template>
          </el-table-column>
          <el-table-column label="身高" width="75" align="center">
            <template #default="{ row }">{{ row.height }}m</template>
          </el-table-column>
          <el-table-column label="体重" width="75" align="center">
            <template #default="{ row }">{{ row.weight }}kg</template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="孵化个体" min-width="130">
            <template #default="{ row }">
              <span v-if="row.status === '已孵化'" class="hatched-info">
                {{ getHatchedIndividualInfo(row.id) }}
              </span>
              <span v-else class="empty-slot">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button
                v-if="row.status === '未处理'"
                text
                size="small"
                type="warning"
                @click="onStartHatch(row.id)"
              >
                放入孵蛋箱
              </el-button>
              <el-button
                v-else-if="row.status === '孵蛋中'"
                text
                size="small"
                type="primary"
                @click="openHatchDialog(row)"
              >
                孵化
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="backpackEggs.length === 0" description="背包里还没有蛋" :image-size="60" />
      </el-tab-pane>

      <!-- 替换推荐 -->
      <el-tab-pane :label="`替换推荐（${suggestions.length}）`" name="replacements">
        <div class="replace-panel">
          <el-alert
            title="自动替换建议"
            description="根据背包中闲置个体的体重自动给出建议：同性别亲本按体重降序排列，让第 1 组亲本最重，实现体重快速迭代。"
            type="info"
            :closable="false"
            show-icon
          />

          <div v-if="suggestions.length > 0" class="suggestion-list">
            <div v-for="(s, idx) in suggestions" :key="idx" class="suggestion-item">
              <span class="suggestion-pos">
                第{{ s.groupNo ?? '?' }}组{{ s.role === 'father' ? '父本' : '母本' }} ·
                {{ formNameOf(s.newIndividual) }}（{{ s.newIndividual.voiceMedal || '—' }}）
              </span>
              <div v-if="s.oldIndividual" class="backpack-egg-cell">
                <div class="avatar-clickable" @click="showIndividual(s.oldIndividual.id)">
                  <PokemonAvatar
                    :name="formNameOf(s.oldIndividual)"
                    :gender="s.oldIndividual.gender"
                    :size="36"
                  />
                </div>
                <div class="backpack-egg-info">
                  <span class="backpack-egg-name">{{ formNameOf(s.oldIndividual) }}</span>
                  <span class="backpack-egg-id">#{{ s.oldIndividual.id }} · {{ s.oldWeight }}kg</span>
                </div>
              </div>
              <span v-else class="suggestion-pos">（池未满，直接加入）</span>
              <span class="suggestion-arrow">→</span>
              <div class="backpack-egg-cell">
                <div class="avatar-clickable" @click="showIndividual(s.newIndividual.id)">
                  <PokemonAvatar
                    :name="formNameOf(s.newIndividual)"
                    :gender="s.newIndividual.gender"
                    :size="36"
                  />
                </div>
                <div class="backpack-egg-info">
                  <span class="backpack-egg-name">{{ formNameOf(s.newIndividual) }}</span>
                  <span class="backpack-egg-id">#{{ s.newIndividual.id }} · {{ s.newWeight }}kg</span>
                </div>
              </div>
              <el-button type="primary" size="small" @click="onApplySuggestion(s)">
                执行替换
              </el-button>
            </div>
          </div>
          <el-empty
            v-else
            description="当前无需替换：背包闲置个体的体重均未超过对应亲本"
            :image-size="60"
          />

          <el-divider content-position="left">替换记录</el-divider>
          <el-table :data="replacementRecords" border stripe size="small">
            <el-table-column label="时间" width="110">
              <template #default="{ row }">{{ formatDateTime(row.replacedAt) }}</template>
            </el-table-column>
            <el-table-column label="方向" width="90">
              <template #default="{ row }">
                <el-tag size="small" type="success">{{ row.taskName }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="位置" width="110" align="center">
              <template #default="{ row }">
                第{{ row.groupNo }}组{{ row.role === 'father' ? '父本' : '母本' }}
              </template>
            </el-table-column>
            <el-table-column label="旧个体" min-width="120">
              <template #default="{ row }">
                <div class="backpack-egg-cell">
                  <div class="avatar-clickable" @click="showIndividual(row.oldIndividualId)">
                    <PokemonAvatar
                      :name="row.oldName"
                      :gender="row.oldGender"
                      :size="32"
                      :placeholder="!getIndividualById(row.oldIndividualId)"
                    />
                  </div>
                  <div class="backpack-egg-info">
                    <span class="backpack-egg-name">{{ row.oldName }}</span>
                    <span class="backpack-egg-id">#{{ row.oldIndividualId }} · {{ row.oldWeight }}kg</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="新个体" min-width="120">
              <template #default="{ row }">
                <div class="backpack-egg-cell">
                  <div class="avatar-clickable" @click="showIndividual(row.newIndividualId)">
                    <PokemonAvatar
                      :name="row.newName"
                      :gender="row.newGender"
                      :size="32"
                      :placeholder="!getIndividualById(row.newIndividualId)"
                    />
                  </div>
                  <div class="backpack-egg-info">
                    <span class="backpack-egg-name">{{ row.newName }}</span>
                    <span class="backpack-egg-id">#{{ row.newIndividualId }} · {{ row.newWeight }}kg</span>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty
            v-if="replacementRecords.length === 0"
            description="还没有替换记录，执行替换后在此查看"
            :image-size="60"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

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

    <!-- 新增蛋弹窗 -->
    <el-dialog v-model="addEggDialogVisible" title="新增蛋" width="480px" append-to-body>
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
        <el-button type="primary" :disabled="!canSubmitEgg" @click="onAddEggConfirm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 孵化弹窗 -->
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

    <!-- 个体详情弹窗 -->
    <IndividualDetailDialog
      :individual-id="individualDetailId"
      @close="individualDetailId = null"
    />
  </div>
</template>

<style scoped>
.backpack-page {
  padding-bottom: 24px;
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
.avatar-clickable {
  cursor: pointer;
  border-radius: 50%;
  transition: transform 0.15s ease;
}
.avatar-clickable:hover {
  transform: scale(1.06);
}
.backpack-egg-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.backpack-egg-info {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.backpack-egg-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.backpack-egg-id {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.hatched-info {
  color: var(--el-color-success);
  font-size: 13px;
}
.empty-slot {
  color: var(--el-text-color-placeholder);
}
.hatch-evolve-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}
.hatch-auto-hint {
  font-size: 11px;
  color: var(--el-color-info);
  background: var(--el-fill-color);
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
}
.egg-form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-top: 4px;
}
.replace-panel .suggestion-list {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}
.suggestion-pos {
  font-weight: 600;
  font-size: 13px;
  min-width: 96px;
  color: var(--el-text-color-primary);
}
.suggestion-arrow {
  color: var(--el-color-primary);
  font-size: 18px;
  font-weight: 700;
}
</style>
