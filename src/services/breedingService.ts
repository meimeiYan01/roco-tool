import { reactive, watch } from 'vue'
import type { BreedingPlan, MedalTask, BreedingGroup, Individual, EggRecord, ReplacementRecord, GrowthRecord, GrowthStageRecord, PokemonForm, ParentPool } from '../types'
import plansJson from '../data/breedingPlans.json'
import tasksJson from '../data/medalTasks.json'
import groupsJson from '../data/groups.json'
import individualsJson from '../data/individuals.json'
import eggRecordsJson from '../data/eggRecords.json'
import replacementRecordsJson from '../data/replacementRecords.json'
import growthRecordsJson from '../data/growthRecords.json'
import parentPoolsJson from '../data/parentPools.json'
import { getFormName, getFamilyById } from './pokemonService'
import { hasData, getAll, saveSnapshot, STORES } from './storage'

/**
 * 响应式存储
 *
 * V2：首次加载从 JSON 初始化并写入 IndexedDB；后续从 IndexedDB 读取。
 * 每次 mutation 后自动防抖保存（200ms）。
 * 刷新页面数据不丢失。
 */
const store = reactive({
  plans: [] as BreedingPlan[],
  tasks: [] as MedalTask[],
  groups: [] as BreedingGroup[],
  individuals: [] as Individual[],
  eggRecords: [] as EggRecord[],
  replacementRecords: [] as ReplacementRecord[],
  growthRecords: [] as GrowthRecord[],
  parentPools: [] as ParentPool[],
})

/** 自增计数器（从 IDB meta 表恢复，或从 JSON mock 推算） */
let nextPlanId = 0
let nextTaskId = 0
let nextGroupId = 0
let nextIndividualId = 0
let nextEggRecordId = 0
let nextReplacementRecordId = 0

/** 从现有 store 数据推算自增 ID */
function recalcNextIds(): void {
  nextPlanId = Math.max(0, ...store.plans.map(p => p.id)) + 1
  nextTaskId = Math.max(0, ...store.tasks.map(t => t.id)) + 1
  nextGroupId = Math.max(0, ...store.groups.map(g => g.id)) + 1
  nextIndividualId = Math.max(0, ...store.individuals.map(i => i.id)) + 1
  nextEggRecordId = Math.max(0, ...store.eggRecords.map(e => e.id)) + 1
  nextReplacementRecordId = Math.max(0, ...store.replacementRecords.map(r => r.id)) + 1
}

/** 从 JSON mock 加载默认数据 */
function loadDefaults(): void {
  store.plans = [...(plansJson as unknown as BreedingPlan[])]
  store.tasks = [...(tasksJson as unknown as MedalTask[])]
  store.groups = [...(groupsJson as unknown as BreedingGroup[])]
  store.individuals = [...(individualsJson as unknown as Individual[])]
  store.eggRecords = [...(eggRecordsJson as unknown as EggRecord[])]
  store.replacementRecords = [...(replacementRecordsJson as unknown as ReplacementRecord[])]
  store.growthRecords = [...(growthRecordsJson as unknown as GrowthRecord[])]
  store.parentPools = [...(parentPoolsJson as unknown as ParentPool[])]
  recalcNextIds()
}

/** 是否正在从 IDB 加载（加载期间不触发自动保存） */
let isLoading = false

/** 初始化标志 */
let initialized = false

// ── 初始化 ──

/**
 * 初始化存储：优先从 IndexedDB 恢复；无数据时从 JSON mock 初始化并持久化。
 * 必须在 Vue app mount 前调用（await initStore()）。
 */
export async function initStore(): Promise<void> {
  if (initialized) return
  isLoading = true

  try {
    const exists = await hasData()
    console.log('[breedingService] initStore: IDB has data =', exists)

    if (exists) {
      // ── 从 IndexedDB 恢复 ──
      store.plans = await getAll<BreedingPlan>(STORES.plans)
      store.tasks = await getAll<MedalTask>(STORES.tasks)
      store.groups = await getAll<BreedingGroup>(STORES.groups)
      store.individuals = await getAll<Individual>(STORES.individuals)
      store.eggRecords = await getAll<EggRecord>(STORES.eggRecords)
      store.replacementRecords = await getAll<ReplacementRecord>(STORES.replacementRecords)
      store.growthRecords = await getAll<GrowthRecord>(STORES.growthRecords)
      store.parentPools = await getAll<ParentPool>(STORES.parentPools)
      recalcNextIds()
    } else {
      // ── 首次：从 JSON mock 初始化 ──
      loadDefaults()
      await persistToIDB()
    }
  } catch (e) {
    console.error('[breedingService] initStore failed, falling back to JSON:', e)
    if (store.plans.length === 0) {
      loadDefaults()
      try { await persistToIDB() } catch (_) { /* IDB 完全不可用时忽略 */ }
    }
  } finally {
    isLoading = false
    initialized = true
  }
}

// ── 自动保存（防抖 200ms）──

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** 将当前 store 全量写入 IndexedDB */
async function persistToIDB(): Promise<void> {
  try {
    // JSON 序列化彻底去除 Vue 响应式 Proxy，确保 IndexedDB 结构化克隆不报错
    const plain = JSON.parse(JSON.stringify({
      plans: store.plans,
      tasks: store.tasks,
      groups: store.groups,
      individuals: store.individuals,
      eggRecords: store.eggRecords,
      replacementRecords: store.replacementRecords,
      growthRecords: store.growthRecords,
      parentPools: store.parentPools,
    }))
    await saveSnapshot({
      ...plain,
      meta: {
        nextPlanId,
        nextTaskId,
        nextGroupId,
        nextIndividualId,
        nextEggRecordId,
        nextReplacementRecordId,
      },
    })
  } catch (e) {
    console.error('[breedingService] persistToIDB failed:', e)
  }
}

function scheduleSave(): void {
  if (isLoading) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    persistToIDB().catch(e => {
      console.error('[breedingService] auto-save failed:', e)
    })
  }, 200)
}

// 深度监听 store 的所有字段
watch(
  () => [
    store.plans,
    store.tasks,
    store.groups,
    store.individuals,
    store.eggRecords,
    store.replacementRecords,
    store.growthRecords,
    store.parentPools,
  ],
  () => { scheduleSave() },
  { deep: true },
)

// ── 重置为默认数据（调试用）──

export async function resetToDefaults(): Promise<void> {
  isLoading = true
  loadDefaults()
  isLoading = false
  await persistToIDB()
}

// ── Plan ──

export function getAllPlans(): BreedingPlan[] {
  return store.plans
}

export function getPlanById(id: number): BreedingPlan | undefined {
  return store.plans.find(p => p.id === id)
}

/** 新建培育计划，同时自动生成4个默认培育方向 */
export function createPlan(data: {
  name: string
  accountName: string
}): BreedingPlan {
  const plan: BreedingPlan = {
    id: ++nextPlanId,
    name: data.name,
    accountName: data.accountName,
  }
  store.plans.push(plan)

  // 自动创建4个默认培育方向
  const defaultTasks = [
    { name: '大婉蛋', sizeMedal: '大块头', voiceMedal: '婉转声' },
    { name: '大粗蛋', sizeMedal: '大块头', voiceMedal: '粗嗓门' },
    { name: '小婉蛋', sizeMedal: '小不点', voiceMedal: '婉转声' },
    { name: '小粗蛋', sizeMedal: '小不点', voiceMedal: '粗嗓门' },
  ]
  for (const t of defaultTasks) {
    store.tasks.push({
      id: ++nextTaskId,
      planId: plan.id,
      name: t.name,
      sizeMedal: t.sizeMedal,
      voiceMedal: t.voiceMedal,
    })
  }

  return plan
}

/** 更新计划信息（名称、账号） */
export function updatePlan(
  id: number,
  data: Partial<Pick<BreedingPlan, 'name' | 'accountName'>>,
): void {
  const plan = store.plans.find(p => p.id === id)
  if (!plan) return
  if (data.name !== undefined) plan.name = data.name
  if (data.accountName !== undefined) plan.accountName = data.accountName
}

/** 删除计划：级联删除其方向、组、蛋记录、所有个体 */
export function deletePlan(id: number): void {
  const taskIds = store.tasks.filter(t => t.planId === id).map(t => t.id)

  // 删除该计划下所有个体（账号隔离）
  store.individuals = store.individuals.filter(i => i.planId !== id)
  store.eggRecords = store.eggRecords.filter(e => !taskIds.includes(e.taskId))
  store.groups = store.groups.filter(g => g.planId !== id)
  store.tasks = store.tasks.filter(t => t.planId !== id)
  store.plans = store.plans.filter(p => p.id !== id)
}

// ── MedalTask ──

export function getTasksByPlanId(planId: number): MedalTask[] {
  return store.tasks.filter(t => t.planId === planId)
}

export function getTaskById(id: number): MedalTask | undefined {
  return store.tasks.find(t => t.id === id)
}

// ── Group ──

/** 取一个计划下的全部组（最多5组=10小窝） */
export function getGroupsByPlanId(planId: number): BreedingGroup[] {
  return store.groups.filter(g => g.planId === planId)
}

/** 取分配到某个培育方向的组（从计划的5组中筛选 taskId 匹配的） */
export function getGroupsByTaskId(taskId: number): BreedingGroup[] {
  const task = getTaskById(taskId)
  if (!task) return []
  return store.groups.filter(g => g.planId === task.planId && g.taskId === taskId)
}

export function getGroupById(id: number): BreedingGroup | undefined {
  return store.groups.find(g => g.id === id)
}

/** 取所有小组（跨计划，用于个体详情查亲本任职） */
export function getAllGroups(): BreedingGroup[] {
  return store.groups.slice()
}

/** 新增小组（一个计划最多5组） */
export function addGroup(planId: number, taskId: number | null = null): BreedingGroup | null {
  const existing = store.groups.filter(g => g.planId === planId)
  if (existing.length >= 5) return null // 超过5组=10小窝上限

  const maxGroupNo = existing.reduce((max, g) => Math.max(max, g.groupNo), 0)
  const group: BreedingGroup = {
    id: ++nextGroupId,
    planId,
    taskId,
    groupNo: maxGroupNo + 1,
    fatherId: null,
    motherId: null,
  }
  store.groups.push(group)
  return group
}

/** 更新小组：分配方向、设置亲本 */
export function updateGroup(
  id: number,
  data: Partial<Pick<BreedingGroup, 'taskId' | 'fatherId' | 'motherId'>>,
): void {
  const group = store.groups.find(g => g.id === id)
  if (!group) return
  if (data.taskId !== undefined) group.taskId = data.taskId
  if (data.fatherId !== undefined) group.fatherId = data.fatherId
  if (data.motherId !== undefined) group.motherId = data.motherId
}

/** 删除小组 */
export function removeGroup(id: number): void {
  store.groups = store.groups.filter(g => g.id !== id)
}

// ── Individual ──

/** 按计划筛选个体（账号隔离） */
export function getIndividualsByPlanId(planId: number): Individual[] {
  return store.individuals.filter(i => i.planId === planId)
}

/** 按家族 id 筛选个体（可选 planId 过滤） */
export function getIndividualsByFamilyId(familyId: number, planId?: number): Individual[] {
  return store.individuals.filter(i => i.familyId === familyId && (planId === undefined || i.planId === planId))
}

/** 个体显示名：由 currentFormId 查静态数据，找不到回退 #id */
export function getIndividualDisplayName(id: number): string {
  const ind = getIndividualById(id)
  if (!ind) return `#${id}`
  return getFormName(ind.currentFormId) || `#${id}`
}

/** 手动添加个体（需要指定 planId），默认位置=背包 */
export function addIndividual(data: Omit<Individual, 'id'>): Individual {
  const individual: Individual = { ...data, location: data.location ?? 'bag', id: ++nextIndividualId }
  store.individuals.push(individual)
  return individual
}

/** 取全部个体（内部使用，如替换推荐需要跨组查） */
export function getAllIndividuals(): Individual[] {
  return store.individuals
}

export function getIndividualById(id: number): Individual | undefined {
  return store.individuals.find(i => i.id === id)
}

// ── EggRecord ──

export function getEggRecordsByTaskId(taskId: number): EggRecord[] {
  return store.eggRecords.filter(e => e.taskId === taskId)
}

export function getEggRecordById(id: number): EggRecord | undefined {
  return store.eggRecords.find(e => e.id === id)
}

/** 取一个计划下可放入孵蛋箱的蛋（状态为"未处理"） */
export function getUnhatchedEggsByPlanId(planId: number): EggRecord[] {
  const taskIds = new Set(store.tasks.filter(t => t.planId === planId).map(t => t.id))
  return store.eggRecords.filter(e => taskIds.has(e.taskId) && e.status === '未处理')
}

/** 取一个计划下所有蛋记录 */
export function getAllEggRecordsByPlanId(planId: number): EggRecord[] {
  const taskIds = new Set(store.tasks.filter(t => t.planId === planId).map(t => t.id))
  return store.eggRecords.filter(e => taskIds.has(e.taskId))
}

/** 孵蛋箱槽位：最多3个，返回固定3槽位（无蛋=空位） */
export interface HatchSlot {
  slotNo: number
  egg?: EggRecord
}

/** 取一个计划的孵蛋箱（3个槽位，前 N 个放孵蛋中的蛋） */
export function getHatchingEggsByPlanId(planId: number): HatchSlot[] {
  const taskIds = new Set(store.tasks.filter(t => t.planId === planId).map(t => t.id))
  const hatching = store.eggRecords.filter(e => taskIds.has(e.taskId) && e.status === '孵蛋中')
  const slots: HatchSlot[] = []
  for (let i = 1; i <= 3; i++) {
    slots.push({ slotNo: i, egg: hatching[i - 1] })
  }
  return slots
}

/** 取某个培育方向下已孵化的蛋对应的个体（用于替换推荐筛选） */
export function getHatchedIndividualsByTaskId(taskId: number): Individual[] {
  const hatchedEggIds = new Set(
    store.eggRecords
      .filter(e => e.taskId === taskId && e.status === '已孵化')
      .map(e => e.id),
  )
  return store.individuals.filter(
    i => i.hatchedFromEggId !== undefined && hatchedEggIds.has(i.hatchedFromEggId),
  )
}

/** 新增蛋记录：只记录身高、体重，自动记录获取时间与产出时亲本快照，状态默认"未处理" */
export function addEggRecord(
  record: Omit<EggRecord, 'id' | 'status' | 'acquiredAt' | 'fatherSnapshot' | 'motherSnapshot'>,
): EggRecord {
  // 产出时亲本快照（亲本之后会更换，快照用于历史统计）
  const group = getGroupById(record.sourceGroupId)
  const father = group?.fatherId != null ? store.individuals.find(i => i.id === group.fatherId) : undefined
  const mother = group?.motherId != null ? store.individuals.find(i => i.id === group.motherId) : undefined

  const newRecord: EggRecord = {
    ...record,
    id: ++nextEggRecordId,
    status: '未处理',
    acquiredAt: new Date().toISOString(),
    fatherSnapshot: father
      ? { individualId: father.id, pokemonName: getFormName(father.currentFormId), weight: father.weight }
      : undefined,
    motherSnapshot: mother
      ? { individualId: mother.id, pokemonName: getFormName(mother.currentFormId), weight: mother.weight }
      : undefined,
  }
  store.eggRecords.push(newRecord)
  return newRecord
}

/** 开始孵蛋：把蛋放入孵蛋箱（最多3个），只选蛋+记录开始时间 */
export function startHatch(eggId: number): EggRecord | null {
  const record = store.eggRecords.find(e => e.id === eggId)
  if (!record) return null
  if (record.status !== '未处理') return null // 只能从未处理的蛋开始孵

  const task = getTaskById(record.taskId)
  if (!task) return null
  const hatchingCount = store.eggRecords.filter(
    e => getTaskById(e.taskId)?.planId === task.planId && e.status === '孵蛋中',
  ).length
  if (hatchingCount >= 3) return null // 孵蛋箱已满

  record.status = '孵蛋中'
  record.hatchStartTime = new Date().toISOString()
  return record
}

/** 孵化完成：只对孵蛋箱中的蛋，更新状态为"已孵化"，创建个体关联来源蛋 */
export function hatchEgg(
  eggRecordId: number,
  individualData: Omit<Individual, 'id' | 'hatchedFromEggId'>,
): { record: EggRecord; individual: Individual } | null {
  const record = store.eggRecords.find(e => e.id === eggRecordId)
  if (!record) return null
  if (record.status !== '孵蛋中') return null // 必须在孵蛋箱中才能孵化

  // 从蛋记录推导 planId（eggRecord → task → planId）
  const task = getTaskById(record.taskId)
  const planId = task?.planId ?? individualData.planId

  record.status = '已孵化'
  record.hatchStartTime = undefined

  const individual: Individual = {
    ...individualData,
    planId,
    location: 'bag',
    id: ++nextIndividualId,
    hatchedFromEggId: record.id,
  }
  store.individuals.push(individual)

  return { record, individual }
}

/** 切换个体所在位置（背包 ↔ 家园） */
export function switchIndividualLocation(id: number): Individual | null {
  const individual = store.individuals.find(i => i.id === id)
  if (!individual) return null
  individual.location = individual.location === 'home' ? 'bag' : 'home'
  return individual
}

// ── ReplacementRecord ──

/** 取一个计划下的所有替换记录（按时间倒序） */
export function getReplacementRecordsByPlanId(planId: number): ReplacementRecord[] {
  return store.replacementRecords
    .filter(r => r.planId === planId)
    .slice()
    .sort((a, b) => (b.replacedAt || '').localeCompare(a.replacedAt || ''))
}

/**
 * 执行亲本替换：更新组的父本/母本，并写入替换记录留痕。
 * 返回替换记录；失败返回 null（组或新个体不存在，或角色没有旧亲本）。
 */
export function applyReplacement(
  groupId: number,
  role: 'father' | 'mother',
  newIndividualId: number,
): ReplacementRecord | null {
  const group = store.groups.find(g => g.id === groupId)
  if (!group) return null

  const newIndividual = store.individuals.find(i => i.id === newIndividualId)
  if (!newIndividual) return null

  const oldId = role === 'father' ? group.fatherId : group.motherId
  if (oldId === null || oldId === undefined) return null

  const oldIndividual = store.individuals.find(i => i.id === oldId)
  const oldWeight = oldIndividual?.weight ?? 0

  // 更新亲本
  if (role === 'father') group.fatherId = newIndividualId
  else group.motherId = newIndividualId

  // 写替换记录
  const planId = group.planId
  const record: ReplacementRecord = {
    id: ++nextReplacementRecordId,
    planId,
    taskId: group.taskId,
    groupId: group.id,
    groupNo: group.groupNo,
    role,
    oldIndividualId: oldId,
    newIndividualId,
    oldWeight,
    newWeight: newIndividual.weight,
    replacedAt: new Date().toISOString(),
  }
  store.replacementRecords.push(record)
  return record
}

// ── GrowthRecord（阶段成长记录，供大婉蛋培育助手使用）──

/** 取所有个体的阶段成长记录（统计用） */
export function getAllGrowthRecords(): GrowthRecord[] {
  return store.growthRecords.slice()
}

/** 取个体的阶段成长记录（无则返回空 records） */
export function getGrowthRecordsByIndividualId(individualId: number): GrowthStageRecord[] {
  return store.growthRecords.find(g => g.individualId === individualId)?.records ?? []
}

/** 新增/覆盖一条阶段记录（同形态只保留最新一条） */
export function addGrowthRecord(individualId: number, record: GrowthStageRecord): void {
  const group = store.growthRecords.find(g => g.individualId === individualId)
  if (group) {
    const idx = group.records.findIndex(r => r.formId === record.formId)
    if (idx >= 0) group.records[idx] = record
    else group.records.push(record)
  } else {
    store.growthRecords.push({ individualId, records: [record] })
  }
}

/**
 * 个体进化：只能进化到下一阶段（不跨阶段），进化可选。
 * 所有个体只要有下一阶段即可进化（手动添加或蛋孵均可）。
 * 进化时记录当前阶段的体重（必填）/身高（可选）/等级（可选），
 * 然后更新个体形态与体重。
 * @returns 进化结果，不可进化时返回 null
 */
export function evolveIndividual(
  individualId: number,
  data: { weight: number; height?: number; level?: number },
): { individual: Individual; nextForm: PokemonForm } | null {
  const individual = getIndividualById(individualId)
  if (!individual) return null

  const family = getFamilyById(individual.familyId)
  if (!family) return null
  const currentForm = family.forms.find(f => f.formId === individual.currentFormId)
  if (!currentForm) return null

  // 下一形态：stage + 1（不跨阶段）
  const nextForm = family.forms.find(f => f.stage === currentForm.stage + 1)
  if (!nextForm) return null

  // 进化：更新形态与体重
  individual.currentFormId = nextForm.formId
  individual.weight = data.weight

  // 记录进化后新阶段的体重（进化前的形态由调用方负责记录）
  addGrowthRecord(individualId, {
    formId: nextForm.formId,
    weight: data.weight,
  })

  return { individual, nextForm }
}

// ── ParentPool ──

export function getParentPoolByPlanId(planId: number): ParentPool | undefined {
  return store.parentPools.find(p => p.planId === planId)
}

export function updateParentPool(planId: number, maleParents: number[], femaleParents: number[]): void {
  const pool = store.parentPools.find(p => p.planId === planId)
  if (pool) {
    pool.maleParents = [...maleParents]
    pool.femaleParents = [...femaleParents]
  } else {
    store.parentPools.push({ planId, maleParents: [...maleParents], femaleParents: [...femaleParents] })
  }
}
