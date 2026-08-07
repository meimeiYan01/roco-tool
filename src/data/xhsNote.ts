/**
 * 小红书采集数据读取
 *
 * 从 public/xhs_latest_note.json 获取 xhs_merchant_scraper.py 的采集结果。
 * 该文件由 Python 脚本维护，前端只负责读取。
 */

export interface XhsNote {
  title: string
  content: string
  url: string
  scraped_at: string
}

/**
 * 获取最新采集的小红书笔记数据
 * @returns XhsNote 或 null（文件不存在/解析失败）
 */
export async function fetchXhsNote(): Promise<XhsNote | null> {
  try {
    const res = await fetch('/roco-tool/xhs_latest_note.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    if (data && typeof data.title === 'string' && typeof data.content === 'string') {
      return data as XhsNote
    }
    return null
  } catch {
    return null
  }
}
