/**
 * 远行商人文本解析
 *
 * 输入示例：
 *   8/7(16:00-20:00)远行商人
 *
 *   1.国王球
 *   2.神奇的蛋
 *   3.黑晶琉璃
 *   4.残缺魔镜
 *
 * 输出：["国王球", "神奇的蛋", "黑晶琉璃", "残缺魔镜"]
 */

/** 从文本中提取编号后的商品名称 */
export function parseMerchantText(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const results: string[] = []

  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+)/)
    if (match) {
      const name = match[1].trim()
      if (name) results.push(name)
    }
  }

  return results
}

/** 将解析结果格式化为可直接粘贴到 merchantData.ts 的代码 */
export function formatAsTodayGoods(names: string[]): string {
  const items = names.map(n => `  '${n}',`).join('\n')
  return `export const todayGoods: string[] = [\n${items}\n]`
}
