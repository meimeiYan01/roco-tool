import type { EggSizeRule, EggSizeResult, EggVerdict } from '@/types'

/**
 * 蛋体型判定算法
 *
 * 判定语义：
 *   - 大块头：蛋体重 >= bigSize.weightMin（只看体重）
 *   - 小不点：蛋体重 <= smallSize.weightMax（只看体重）
 *   - 普通：既不满足大块头也不满足小不点
 *
 * 大块头与小不点互斥，优先判大块头。
 *
 * @param weight 蛋实测体重（kg）
 * @param rule   该精灵的蛋体型规则
 */
export function calculateEggSize(
  height: number,
  weight: number,
  rule: EggSizeRule
): EggSizeResult {
  const { bigSize, smallSize } = rule

  // 三态判定（只看体重）
  const isBigSize = weight >= bigSize.weightMin
  const isSmallSize = weight <= smallSize.weightMax

  let verdict: EggVerdict = 'normal'
  if (isBigSize) verdict = 'big'
  else if (isSmallSize) verdict = 'small'

  // 体重达标率
  const weightRate = bigSize.weightMin > 0 ? weight / bigSize.weightMin : 0

  // 完成度：体重达标率封顶 1
  const score = Math.min(weightRate, 1)

  // 距大块头准入线差值：负值表示还差多少才达标
  const heightDiff = 0  // 身高不参与判定
  const weightDiff = +(weight - bigSize.weightMin).toFixed(2)

  return {
    verdict,
    isBigSize,
    isSmallSize,
    score,
    heightRate: 0,  // 身高不参与判定
    weightRate,
    heightDiff,
    weightDiff,
  }
}
