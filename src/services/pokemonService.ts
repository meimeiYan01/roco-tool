import pokemonData from '@/data/pokemon.json'
import type { PokemonFamily, PokemonForm } from '@/types'

const families = pokemonData as PokemonFamily[]

/** 形态 + 家族上下文（列表/搜索用） */
export interface FormWithFamily {
  form: PokemonForm
  family: PokemonFamily
}

/** 获取全部精灵家族 */
export function getAllFamilies(): PokemonFamily[] {
  return families
}

/** 按家族 id 获取家族 */
export function getFamilyById(familyId: number): PokemonFamily | undefined {
  return families.find(f => f.familyId === familyId)
}

/** 获取全部形态（所有家族展平） */
export function getAllForms(): PokemonForm[] {
  return families.flatMap(f => f.forms)
}

/** 按形态 id 获取形态 */
export function getFormById(formId: number): PokemonForm | undefined {
  for (const f of families) {
    const form = f.forms.find(fm => fm.formId === formId)
    if (form) return form
  }
  return undefined
}

/** 形态所在的家族 */
export function getFamilyOfForm(formId: number): PokemonFamily | undefined {
  return families.find(f => f.forms.some(fm => fm.formId === formId))
}

/** 形态名（显示用；找不到返回空串） */
export function getFormName(formId: number): string {
  return getFormById(formId)?.name ?? ''
}

/** 家族的一阶形态 id（1级孵化形态；找不到 stage=1 时回退第一个形态） */
export function getInitialFormId(familyId: number): number | undefined {
  const family = getFamilyById(familyId)
  if (!family) return undefined
  return family.forms.find(f => f.stage === 1)?.formId ?? family.forms[0]?.formId
}

/** 家族名（显示用；找不到返回空串） */
export function getFamilyName(familyId: number): string {
  return getFamilyById(familyId)?.familyName ?? ''
}

/**
 * 按关键词搜索形态：匹配形态名（含）、家族名（含）或系别。
 * @param keyword 名称关键字或系别
 */
export function searchForms(keyword: string): FormWithFamily[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return getAllFormsWithFamily()
  const results: FormWithFamily[] = []
  for (const f of families) {
    const familyHit =
      f.familyName.toLowerCase().includes(kw) || f.types.some(t => t.toLowerCase().includes(kw))
    for (const form of f.forms) {
      if (familyHit || form.name.toLowerCase().includes(kw)) {
        results.push({ form, family: f })
      }
    }
  }
  return results
}

/** 所有形态（含家族上下文） */
export function getAllFormsWithFamily(): FormWithFamily[] {
  return families.flatMap(f => f.forms.map(form => ({ form, family: f })))
}

/**
 * 热门形态：按家族稀有度优先级排序取前 N，作为首页推荐。
 */
export function getPopularForms(limit = 6): FormWithFamily[] {
  const priority: Record<string, number> = {
    传说: 4,
    史诗: 3,
    稀有: 2,
    普通: 1,
  }
  const sorted = [...getAllFormsWithFamily()].sort(
    (a, b) => (priority[b.family.rarity] ?? 0) - (priority[a.family.rarity] ?? 0),
  )
  return sorted.slice(0, limit)
}
