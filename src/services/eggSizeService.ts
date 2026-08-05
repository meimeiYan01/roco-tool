import eggSizeRulesData from '@/data/eggSizeRules.json'
import type { EggSizeRule } from '@/types'

const rules = eggSizeRulesData as EggSizeRule[]

/** 获取全部蛋体型规则 */
export function getAllEggSizeRules(): EggSizeRule[] {
  return rules
}

/** 按家族 id 获取该家族的蛋体型规则 */
export function getEggSizeRuleByFamilyId(familyId: number): EggSizeRule | undefined {
  return rules.find(r => r.familyId === familyId)
}
