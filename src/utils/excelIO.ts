import * as XLSX from 'xlsx'
import type { Individual } from '../types'
import { getIndividualsByPlanId, addIndividual } from '../services/breedingService'
import { getFormName, getFamilyName, getFamilyOfForm, searchForms } from '../services/pokemonService'

// ── 导出 ──

/** 导出指定计划的个体为 xlsx 文件 */
export function exportIndividuals(planId: number): void {
  const individuals = getIndividualsByPlanId(planId)
  const rows = individuals.map(ind => ({
    'ID': ind.id,
    '名称': getFormName(ind.currentFormId),
    '家族': getFamilyName(ind.familyId),
    '性别': ind.gender === 'male' ? 'male' : 'female',
    '身高(m)': ind.height,
    '体重(kg)': ind.weight,
    '体型奖牌': ind.sizeMedal,
    '声音奖牌': ind.voiceMedal,
    '性格': ind.personality || '',
    '特长': ind.specialty || '',
    '位置': (ind.location ?? 'bag') === 'home' ? '家园' : '背包',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '精灵数据')

  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  XLSX.writeFile(wb, `精灵数据_${dateStr}.xlsx`)
}

// ── 导入 ──

export interface ImportResult {
  success: number
  errors: string[]
}

/** 从 xlsx 文件导入个体到指定计划 */
export function importIndividuals(file: File, planId: number): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        const result: ImportResult = { success: 0, errors: [] }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const rowNum = i + 2 // Excel 行号（第1行是表头）
          const errorPrefix = `第${rowNum}行`

          // 解析名称
          const name = String(row['名称'] ?? row['name'] ?? '').trim()
          if (!name) {
            result.errors.push(`${errorPrefix}: 名称为空`)
            continue
          }

          // 匹配精灵形态
          const matches = searchForms(name)
          if (matches.length === 0) {
            result.errors.push(`${errorPrefix}: 找不到精灵「${name}」`)
            continue
          }
          const match = matches[0]

          // 解析性别
          const genderRaw = String(row['性别'] ?? row['gender'] ?? '').trim().toLowerCase()
          let gender: string
          if (genderRaw === 'male' || genderRaw === '雄' || genderRaw === '♂' || genderRaw === '雄性') {
            gender = 'male'
          } else if (genderRaw === 'female' || genderRaw === '雌' || genderRaw === '♀' || genderRaw === '雌性') {
            gender = 'female'
          } else {
            result.errors.push(`${errorPrefix}「${name}」: 性别无效「${genderRaw}」，应为 male/female`)
            continue
          }

          // 解析身高
          const height = Number(row['身高(m)'] ?? row['身高'] ?? row['height'] ?? 0)
          if (!height || height <= 0) {
            result.errors.push(`${errorPrefix}「${name}」: 身高无效`)
            continue
          }

          // 解析体重
          const weight = Number(row['体重(kg)'] ?? row['体重'] ?? row['weight'] ?? 0)
          if (!weight || weight <= 0) {
            result.errors.push(`${errorPrefix}「${name}」: 体重无效`)
            continue
          }

          // 解析奖牌
          const sizeMedal = String(row['体型奖牌'] ?? row['sizeMedal'] ?? '普通').trim()
          const voiceMedal = String(row['声音奖牌'] ?? row['voiceMedal'] ?? '').trim()

          // 解析可选字段
          const personality = String(row['性格'] ?? row['personality'] ?? '').trim()
          const specialty = String(row['特长'] ?? row['specialty'] ?? '').trim()

          // 写入
          addIndividual({
            planId,
            familyId: match.family.familyId,
            currentFormId: match.form.formId,
            gender,
            height,
            weight,
            sizeMedal,
            voiceMedal,
            personality,
            specialty,
          })
          result.success++
        }

        resolve(result)
      } catch (err) {
        reject(new Error(`解析 Excel 失败: ${err instanceof Error ? err.message : String(err)}`))
      }
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}
