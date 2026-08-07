// ── 轮次规则（固定，不需修改）──

export interface RoundRule {
  round: number
  startHour: number
  endHour: number
}

/** 每天固定4轮 */
export const ROUND_RULES: RoundRule[] = [
  { round: 1, startHour: 8, endHour: 12 },
  { round: 2, startHour: 12, endHour: 16 },
  { round: 3, startHour: 16, endHour: 20 },
  { round: 4, startHour: 20, endHour: 24 },
]

// ── 今日出售商品名称（默认数据，可被解析覆盖）──

export const MERCHANT_GOODS_KEY = 'merchant_today_goods'

export const defaultTodayGoods: string[] = [
  '能力钥匙',
  '适格钥匙',
  '龙系血脉密钥',
  '紫莲刚玉',
  '残缺魔镜',
  '调温球',
]

/** 获取今日商品列表：优先 localStorage，无则用默认数据 */
export function getTodayGoods(): string[] {
  try {
    const saved = localStorage.getItem(MERCHANT_GOODS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {}
  return defaultTodayGoods
}

/** 设置今日商品列表（来自 XHS 采集数据或手动解析） */
export function setTodayGoods(names: string[]): void {
  if (names.length > 0) {
    localStorage.setItem(MERCHANT_GOODS_KEY, JSON.stringify(names))
  }
}

// ── 工具函数 ──

/** 根据当前时间判断当前轮次（0 = 不在任何轮次） */
export function getCurrentRound(now: Date): number {
  const hour = now.getHours()
  for (const rule of ROUND_RULES) {
    if (hour >= rule.startHour && hour < rule.endHour) {
      return rule.round
    }
  }
  return 0
}

/** 计算本轮剩余秒数 */
export function getRemainingSeconds(now: Date): number {
  const hour = now.getHours()
  for (const rule of ROUND_RULES) {
    if (hour >= rule.startHour && hour < rule.endHour) {
      const endTime = new Date(now)
      endTime.setHours(rule.endHour, 0, 0, 0)
      return Math.max(0, Math.floor((endTime.getTime() - now.getTime())) / 1000)
    }
  }
  return 0
}

/** 格式化秒数为 HH:MM:SS */
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
