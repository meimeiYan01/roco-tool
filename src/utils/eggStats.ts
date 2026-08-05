import type { EggRecord, BreedingGroup } from '../types'

/** 按天统计结果 */
export interface DayEggStat {
  date: string
  count: number
  avgHeight: number
  avgWeight: number
  maxWeight: number
}

/** 按亲本组合统计结果 */
export interface ParentComboStat {
  /** 组合标识：fatherId-motherId（无快照为 unknown） */
  key: string
  fatherName: string
  motherName: string
  fatherWeight: number
  motherWeight: number
  count: number
  avgWeight: number
  maxWeight: number
}

function toDateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '未知日期'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 按天统计收获的蛋：每天蛋数、平均身高、平均体重、最大体重。
 * 蛋按获取时间（acquiredAt）归属到当天，亲本更换不影响。
 */
export function getEggStatsByDay(eggs: EggRecord[]): DayEggStat[] {
  const map = new Map<string, EggRecord[]>()
  for (const e of eggs) {
    const key = toDateKey(e.acquiredAt)
    const list = map.get(key) ?? []
    list.push(e)
    map.set(key, list)
  }

  const stats: DayEggStat[] = []
  for (const [date, list] of map.entries()) {
    const weights = list.map(e => e.weight)
    const heights = list.map(e => e.height)
    stats.push({
      date,
      count: list.length,
      avgHeight: heights.reduce((a, b) => a + b, 0) / heights.length,
      avgWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
      maxWeight: Math.max(...weights),
    })
  }

  return stats.sort((a, b) => (a.date > b.date ? -1 : 1))
}

/**
 * 按亲本组合统计：同一组合（父本×母本）产出的蛋汇总。
 * 用产蛋时的亲本快照归组，亲本之后更换也不影响历史组合的统计。
 * 无快照的蛋归入「未知亲本」组合。按平均体重降序（体现迭代方向）。
 */
export function getEggStatsByParentCombo(eggs: EggRecord[]): ParentComboStat[] {
  const map = new Map<string, EggRecord[]>()
  for (const e of eggs) {
    const f = e.fatherSnapshot
    const m = e.motherSnapshot
    const key = f && m ? `${f.individualId}-${m.individualId}` : 'unknown'
    const list = map.get(key) ?? []
    list.push(e)
    map.set(key, list)
  }

  const stats: ParentComboStat[] = []
  for (const [key, list] of map.entries()) {
    const f = list[0].fatherSnapshot
    const m = list[0].motherSnapshot
    const weights = list.map(e => e.weight)
    stats.push({
      key,
      fatherName: f?.pokemonName ?? '未知',
      motherName: m?.pokemonName ?? '未知',
      fatherWeight: f?.weight ?? 0,
      motherWeight: m?.weight ?? 0,
      count: list.length,
      avgWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
      maxWeight: Math.max(...weights),
    })
  }

  return stats.sort((a, b) => b.avgWeight - a.avgWeight)
}

/** 按组×按天统计结果 */
export interface GroupDayStat {
  groupNo: number
  date: string
  count: number
  avgWeight: number
  maxWeight: number
}

/**
 * 按组×按天统计：每个小组每天产出的蛋（数量、平均体重、最大体重）。
 * 以小组为单位迭代，可对比：同组不同天（亲本迭代效果）、同天不同组（组间产出）。
 */
export function getEggStatsByGroupDay(
  eggs: EggRecord[],
  groups: BreedingGroup[],
): GroupDayStat[] {
  const groupNoOf = (sourceGroupId: number): number =>
    groups.find(g => g.id === sourceGroupId)?.groupNo ?? sourceGroupId

  const map = new Map<string, { groupNo: number; date: string; weights: number[] }>()
  for (const e of eggs) {
    const groupNo = groupNoOf(e.sourceGroupId)
    const date = toDateKey(e.acquiredAt)
    const key = `${groupNo}|${date}`
    const item = map.get(key) ?? { groupNo, date, weights: [] }
    item.weights.push(e.weight)
    map.set(key, item)
  }

  return [...map.values()].map(item => ({
    groupNo: item.groupNo,
    date: item.date,
    count: item.weights.length,
    avgWeight: item.weights.reduce((a, b) => a + b, 0) / item.weights.length,
    maxWeight: Math.max(...item.weights),
  }))
}
