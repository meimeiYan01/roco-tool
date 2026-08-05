import type { EggRecord, Individual, ReplacementRecord, ParentSnapshot } from '../types'

/** 亲本链上的一个节点：某个体在某段时间担任该角色的亲本 */
export interface ChainNode {
  individualId: number
  name: string
  weight: number
  /** 上任时间（被替换进来的时间），初始亲本无 */
  since?: string
  /** 顶替了谁（前一任亲本 id），初始亲本无 */
  replacedFromId?: number
}

/** 一颗蛋的迭代谱系：产出该蛋时，父本线/母本线的完整替换链 */
export interface EggPedigree {
  egg: EggRecord
  groupNo: number
  fatherChain: ChainNode[]
  motherChain: ChainNode[]
}

/**
 * 构建一颗蛋的迭代谱系。
 *
 * 思路：蛋产出时记录了亲本快照（fatherSnapshot/motherSnapshot），
 * 从快照亲本出发，沿该组的替换记录（newIndividualId 命中当前亲本 → 找到上一任）
 * 反向回溯，直到没有更早的替换记录（即初始亲本），得到完整的替换链。
 *
 * 时间正序展示：初始亲本 → 替换 → … → 产出蛋时的亲本 → 产出蛋。
 *
 * @param getName 个体 id → 显示名 的解析函数（调用方注入，避免 utils 依赖 service）
 */
export function buildEggPedigree(
  egg: EggRecord,
  individuals: Individual[],
  records: ReplacementRecord[],
  groupNo: number,
  getName?: (individualId: number) => string,
): EggPedigree {
  // 该组的替换记录，按角色分组、时间正序
  const roleRecords = (role: 'father' | 'mother') =>
    records
      .filter(r => r.groupId === egg.sourceGroupId && r.role === role)
      .slice()
      .sort((a, b) => (a.replacedAt > b.replacedAt ? 1 : -1))

  const nameOf = (id: number, fallback?: ParentSnapshot): string => {
    const resolved = getName?.(id)
    return resolved || fallback?.pokemonName || `#${id}`
  }
  const weightOf = (id: number, fallback?: ParentSnapshot): number => {
    return individuals.find(i => i.id === id)?.weight ?? fallback?.weight ?? 0
  }

  const buildChain = (
    snapshot: ParentSnapshot | undefined,
    role: 'father' | 'mother',
  ): ChainNode[] => {
    if (!snapshot) return []
    const chain: ChainNode[] = []
    let curId = snapshot.individualId

    // 反向回溯：当前亲本 → 顶替它的前一代 → 更早一代……
    for (;;) {
      const rec = roleRecords(role).find(r => r.newIndividualId === curId)
      chain.unshift({
        individualId: curId,
        name: nameOf(curId, snapshot),
        weight: weightOf(curId, snapshot),
        since: rec?.replacedAt,
        replacedFromId: rec?.oldIndividualId,
      })
      if (!rec) break
      curId = rec.oldIndividualId
    }
    return chain
  }

  return {
    egg,
    groupNo,
    fatherChain: buildChain(egg.fatherSnapshot, 'father'),
    motherChain: buildChain(egg.motherSnapshot, 'mother'),
  }
}
