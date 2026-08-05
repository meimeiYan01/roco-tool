import { reactive } from 'vue'
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

/**
 * 响应式存储：初始化自 JSON，运行时可增删。
 * 刷新后回到 mock 初始状态（V1 纯前端，无持久化）。
 */
const store = reactive({
  plans: [...(plansJson as unknown as BreedingPlan[])],
  tasks: [...(tasksJson as unknown as MedalTask[])],
  groups: [...(groupsJson as unknown as BreedingGroup[])],
  individuals: [...(individualsJson as unknown as Individual[])],
  eggRecords: [...(eggRecordsJson as unknown as EggRecord[])],
  replacementRecords: [...(replacementRecordsJson as unknown as ReplacementRecord[])],
  growthRecords: [...(growthRecordsJson as unknown as GrowthRecord[])],
  parentPools: [...(parentPoolsJson as unknown as ParentPool[])],
})

let nextPlanId = 2
let nextTaskId = 5
let nextGroupId = 6
let nextIndividualId = 2002
let nextEggRecordId = 3005
let nextReplacementRecordId = 1

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

/** 删除计划：级联删除其方向、组、蛋记录、关联个体 */
export function deletePlan(id: number): void {
  const taskIds = store.tasks.filter(t => t.planId === id).map(t => t.id)
  const groupIds = store.groups.filter(g => g.planId === id).map(g => g.id)
  const eggRecordIds = store.eggRecords.filter(e => taskIds.includes(e.taskId)).map(e => e.id)

  // 删除由这些蛋孵化出的个体
  store.individuals = store.individuals.filter(
    i => !(i.hatchedFromEggId !== undefined && eggRecordIds.includes(i.hatchedFromEggId)),
  )
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

/** 按家族 id 筛选个体 */
export function getIndividualsByFamilyId(familyId: number): Individual[] {
  return store.individuals.filter(i => i.familyId === familyId)
}

/** 个体显示名：由 currentFormId 查静态数据，找不到回退 #id */
export function getIndividualDisplayName(id: number): string {
  const ind = getIndividualById(id)
  if (!ind) return `#${id}`
  return getFormName(ind.currentFormId) || `#${id}`
}

/** 手动添加个体（用于设置亲本），默认位置=背包 */
export function addIndividual(data: Omit<Individual, 'id'>): Individual {
  const individual: Individual = { ...data, location: data.location ?? 'bag', id: ++nextIndividualId }
  store.individuals.push(individual)
  return individual
}

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

  record.status = '已孵化'
  record.hatchStartTime = undefined

  const individual: Individual = {
    ...individualData,
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
