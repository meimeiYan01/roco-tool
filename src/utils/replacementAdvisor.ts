import type { Individual, BreedingGroup, ParentPool, GrowthRecord } from '../types'
import { insertIntoPool } from './individualEvaluator'

/** 单条自动替换建议 */
export interface ReplacementSuggestion {
  groupId?: number
  groupNo?: number
  role: 'father' | 'mother'
  /** 当前亲本（被替换者/被挤出池者），可能为空 */
  oldIndividual?: Individual
  /** 建议加入的新个体 */
  newIndividual: Individual
  oldWeight: number
  newWeight: number
  /** 被挤出的个体 id，undefined = 池未满，直接加入 */
  evictedId?: number
}

/**
 * 基于亲本池的替换建议：对闲置个体尝试插入排序入对应性别池。
 *
 * 规则：
 * 1. 候选 = 未担任亲本的闲置个体（同性别）
 * 2. 尝试 insertIntoPool → 排进 Top5 → 生成建议（被挤出者=替换对象）
 * 3. 池未满时直接加入，无淘汰者
 */
export function generateReplacementSuggestions(
  individuals: Individual[],
  groups: BreedingGroup[],
  pool: ParentPool,
  growthRecords: readonly GrowthRecord[],
): ReplacementSuggestion[] {
  const parentIds = new Set<number>()
  for (const g of groups) {
    if (g.fatherId != null) parentIds.add(g.fatherId)
    if (g.motherId != null) parentIds.add(g.motherId)
  }

  const suggestions: ReplacementSuggestion[] = []

  for (const role of ['father', 'mother'] as const) {
    const gender = role === 'father' ? 'male' : 'female'
    const currentPool = role === 'father' ? pool.maleParents : pool.femaleParents

    const candidates = individuals.filter(
      i => i.gender === gender && !parentIds.has(i.id),
    )

    for (const ind of candidates) {
      const result = insertIntoPool(ind, currentPool, individuals)
      if (!result) continue

      const evicted = result.evictedId !== undefined
        ? individuals.find(i => i.id === result.evictedId)
        : undefined

      // 找到被挤出者的旧组（用于定位展示）
      const evictedGroup = evicted
        ? groups.find(g =>
            role === 'father' ? g.fatherId === evicted.id : g.motherId === evicted.id,
          )
        : undefined

      suggestions.push({
        groupId: evictedGroup?.id,
        groupNo: evictedGroup?.groupNo,
        role,
        oldIndividual: evicted,
        newIndividual: ind,
        oldWeight: evicted?.weight ?? 0,
        newWeight: ind.weight,
        evictedId: result.evictedId,
      })
    }
  }

  return suggestions
}
