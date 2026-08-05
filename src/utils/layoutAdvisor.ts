import type { BreedingGroup, Individual, ParentPool, LayoutRecommendation, PairRecommendation } from '../types'

/**
 * 根据亲本池生成小窝布局推荐方案。
 *
 * 规则：
 * 1. manual=true 的组不参与推荐（跳过）
 * 2. Top5♂ 和 Top5♀ 按体重降序配对（最重♂配最重♀）
 * 3. 优先填空组（fatherId/motherId 都为 null）
 * 4. 空组不够时，覆盖非 manual 的现有配对
 * 5. 池比组多的亲本标记为 unused
 *
 * 不修改任何现有数据，只返回推荐方案。
 */
export function generateLayoutRecommendation(
  groups: BreedingGroup[],
  pool: ParentPool,
  allIndividuals: Individual[],
): LayoutRecommendation {
  const idMap = new Map(allIndividuals.map(i => [i.id, i]))

  const malePool = pool.maleParents
    .map(id => idMap.get(id))
    .filter((i): i is Individual => i !== undefined)
  const femalePool = pool.femaleParents
    .map(id => idMap.get(id))
    .filter((i): i is Individual => i !== undefined)

  // 分出 manual 和非 manual 组
  const manualGroupIds = new Set<number>()
  const editableGroups: BreedingGroup[] = []
  for (const g of groups) {
    if (g.manual) {
      manualGroupIds.add(g.id)
    } else {
      editableGroups.push(g)
    }
  }

  // 非 manual 组再分：空组优先
  const emptyGroups = editableGroups.filter(g => g.fatherId === null && g.motherId === null)
  const nonEmptyGroups = editableGroups.filter(g => !(g.fatherId === null && g.motherId === null))
  const orderedGroups = [...emptyGroups, ...nonEmptyGroups]

  // 配对：按体重降序，第 i 个♂配第 i 个♀
  const pairs: PairRecommendation[] = []
  const usedMaleIds = new Set<number>()
  const usedFemaleIds = new Set<number>()
  const usedGroupIds = new Set<number>()

  const pairCount = Math.min(malePool.length, femalePool.length, orderedGroups.length)

  for (let i = 0; i < pairCount; i++) {
    const group = orderedGroups[i]
    const male = malePool[i]
    const female = femalePool[i]

    pairs.push({
      groupId: group.id,
      groupNo: group.groupNo,
      fatherId: male.id,
      motherId: female.id,
      fatherWeight: male.weight,
      motherWeight: female.weight,
    })
    usedMaleIds.add(male.id)
    usedFemaleIds.add(female.id)
    usedGroupIds.add(group.id)
  }

  // 未使用的亲本
  const unusedMales = malePool.filter(i => !usedMaleIds.has(i.id)).map(i => i.id)
  const unusedFemales = femalePool.filter(i => !usedFemaleIds.has(i.id)).map(i => i.id)

  // 被跳过的组（manual）
  const skippedGroups = groups
    .filter(g => manualGroupIds.has(g.id))
    .map(g => g.groupNo)

  return {
    pairs,
    skippedGroups,
    unusedMales,
    unusedFemales,
  }
}
