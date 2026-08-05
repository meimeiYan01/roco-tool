import type { Individual, GrowthRecord, GrowthStageRecord } from '../types'

/** 阶段评价结果 */
export interface StageEvaluation {
  /** 是否有同条件历史数据 */
  hasHistory: boolean
  /** 评价状态 */
  status: 'excellent' | 'normal' | 'no-data'
  /** 历史样本数 */
  historyCount: number
  /** 历史最高体重（同阶段） */
  historyMax: number
  /** 历史平均体重 */
  historyAvg: number
  /** 所有历史样本体重（用于前端展示） */
  historyWeights: number[]
}

/**
 * 同阶段评价：新孵个体当前形态 vs 历史同条件数据。
 *
 * 比较条件：同家族 + 同形态（formId）+ 同性别 + 同声音奖牌方向。
 * 数据源：所有个体的成长记录（天然覆盖家园亲本/背包闲置/历史个体）。
 *
 * 判定：
 * - 有历史 且 weight > historyMax  → excellent（优秀，不需继续进化）
 * - 有历史 且未超                     → normal（普通）
 * - 无历史                          → no-data（该阶段缺少参考，进化后再比较）
 */
export function evaluateStage(
  individual: Individual,
  individuals: readonly Individual[],
  growthRecords: readonly GrowthRecord[],
): StageEvaluation {
  const { familyId, currentFormId, gender, voiceMedal, weight } = individual

  // 收集同条件所有个体的"该形态体重"
  const weights: number[] = []
  const seenIds = new Set<number>()

  for (const g of growthRecords) {
    if (g.individualId === individual.id) continue // 排除自己
    const otherInd = individuals.find(i => i.id === g.individualId)
    if (!otherInd) continue
    if (
      otherInd.familyId !== familyId ||
      otherInd.gender !== gender ||
      otherInd.voiceMedal !== voiceMedal
    ) continue

    for (const r of g.records) {
      if (r.formId === currentFormId) {
        weights.push(r.weight)
        seenIds.add(g.individualId)
      }
    }
  }

  // 补充：个体当前就在此形态但还没有该阶段记录
  for (const ind of individuals) {
    if (ind.id === individual.id || seenIds.has(ind.id)) continue
    if (
      ind.familyId === familyId &&
      ind.gender === gender &&
      ind.voiceMedal === voiceMedal &&
      ind.currentFormId === currentFormId &&
      !growthRecords.some(g => g.individualId === ind.id && g.records.some(r => r.formId === currentFormId))
    ) {
      weights.push(ind.weight)
    }
  }

  if (weights.length === 0) {
    return {
      hasHistory: false,
      status: 'no-data',
      historyCount: 0,
      historyMax: 0,
      historyAvg: 0,
      historyWeights: [],
    }
  }

  weights.sort((a, b) => b - a)
  const historyMax = weights[0]
  const historyAvg = weights.reduce((s, w) => s + w, 0) / weights.length

  return {
    hasHistory: true,
    status: weight > historyMax ? 'excellent' : 'normal',
    historyCount: weights.length,
    historyMax,
    historyAvg,
    historyWeights: weights,
  }
}

/** 亲本池插入结果 */
export interface PoolInsertResult {
  /** 插入后的新池（Top5） */
  newPool: number[]
  /** 被挤出的个体 id（原第5名被踢出），无则 undefined */
  evictedId?: number
}

/**
 * 将个体按体重插入排序放入亲本池，保留 Top5。
 * 同性别线独立处理：female 线用 female 池，male 线用 male 池。
 * @returns 插入后的 Top5 池和被淘汰者；个体体重 <= 池最轻者 且 池已满时返回 null
 */
export function insertIntoPool(
  individual: Individual,
  pool: readonly number[],
  allIndividuals: readonly Individual[],
): PoolInsertResult | null {
  const idMap = new Map(allIndividuals.map(i => [i.id, i]))

  // 现有池成员（去重、保留存在的个体）
  const members = pool
    .filter(id => idMap.has(id))
    .map(id => idMap.get(id)!)

  // 将新个体加入并去重
  const poolSet = new Set(pool)
  poolSet.add(individual.id)

  // 排序：体重降序，取 Top5
  const sorted = [...poolSet]
    .map(id => idMap.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)

  const newPool = sorted.map(i => i.id)

  // 检查新个体是否在 Top5
  const inTop5 = newPool.includes(individual.id)
  if (!inTop5) return null

  // 如果池变长了（原先不满5），没有淘汰
  if (pool.length >= 5 && newPool.length <= pool.length) {
    // 找出被挤出的（原先在池中但不在新池的）
    const evicted = pool.find(id => !newPool.includes(id))
    // 排除新个体自己（自己加入替代了原来的）
    if (evicted && evicted !== individual.id) {
      return { newPool, evictedId: evicted }
    }
  }

  return { newPool }
}
