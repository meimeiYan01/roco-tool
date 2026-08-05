import type { EggSizeRule, EggSizeResult, EggVerdict } from '@/types'

/**
 * 蛋体型判定算法（由原 bigSizeCalculator 演进）
 *
 * 判定语义（与游戏一致）：
 *   - 大块头：蛋身高 >= bigSizeRule.heightMin 且 蛋体重 >= bigSizeRule.weightMin（同时达标）
 *   - 小不点：蛋身高 <= smallSizeRule.heightMax 且 蛋体重 <= smallSizeRule.weightMax（同时达标）
 *   - 普通：既不满足大块头也不满足小不点
 *
 * 大块头与小不点互斥（上限方向 vs 下限方向），优先判大块头。
 *
 * @param height 蛋实测身高（m）
 * @param weight 蛋实测体重（kg）
 * @param rule   该精灵的蛋体型规则
 */
export function calculateEggSize(
  height: number,
  weight: number,
  rule: EggSizeRule
): EggSizeResult {
  const { bigSizeRule, smallSizeRule } = rule

  // 三态判定
  const isBigSize =
    height >= bigSizeRule.heightMin && weight >= bigSizeRule.weightMin
  const isSmallSize =
    height <= smallSizeRule.heightMax && weight <= smallSizeRule.weightMax

  let verdict: EggVerdict = 'normal'
  if (isBigSize) verdict = 'big'
  else if (isSmallSize) verdict = 'small'

  // 完成度与达标率：以大块头准入线为基准（主查询方向）
  const heightRate =
    bigSizeRule.heightMin > 0 ? height / bigSizeRule.heightMin : 0
  const weightRate =
    bigSizeRule.weightMin > 0 ? weight / bigSizeRule.weightMin : 0

  // 完成度：取身高/体重达标率的均值，单项封顶 1（避免越过准入线后拉高整体）
  const heightCompletion = Math.min(heightRate, 1)
  const weightCompletion = Math.min(weightRate, 1)
  const score = (heightCompletion + weightCompletion) / 2

  // 距大块头准入线差值：负值表示还差多少才达标
  const heightDiff = +(height - bigSizeRule.heightMin).toFixed(2)
  const weightDiff = +(weight - bigSizeRule.weightMin).toFixed(2)

  return {
    verdict,
    isBigSize,
    isSmallSize,
    score,
    heightRate,
    weightRate,
    heightDiff,
    weightDiff,
  }
}
