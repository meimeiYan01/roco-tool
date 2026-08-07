import type { Individual } from '../types'

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
