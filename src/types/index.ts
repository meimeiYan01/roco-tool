// 数据模型类型定义
// 字段对应 src/data 下的 JSON 结构
// 2026-08-04 重构：精灵静态数据改为"家族(PokemonFamily) -> 形态(PokemonForm)"结构；
// 个体只引用 familyId + currentFormId，不重复保存名称/头像

/** 精灵家族（一条进化链） */
export interface PokemonFamily {
  /** 家族 id，如 580 */
  familyId: number
  /** 家族名，如 "阿米亚特家族" */
  familyName: string
  /** 系别，如 ["恶魔系"] */
  types: string[]
  /** 稀有度：普通 / 稀有 / 史诗 / 传说 等 */
  rarity: string
  /** 蛋图片地址（预留，当前为空字符串） */
  eggImage: string
  /** 精灵描述（预留，当前为空字符串） */
  description: string
  /** 蛋壳名，如 "火焰蛋" */
  eggShell?: string
  /** 是否有变体 */
  hasVariant?: boolean
  /** 形态列表（按 stage 升序） */
  forms: PokemonForm[]
}

/** 单个进化形态 */
export interface PokemonForm {
  /** 形态 id，如 5801 / 5802 / 5803 */
  formId: number
  /** 形态名，如 阿米亚特 / 阿米樱 / 罗隐 */
  name: string
  /** 进化阶段：1=初始，2=二阶段，3=最终 */
  stage: number
  /** 头像地址（预留，当前为空字符串） */
  avatar: string
}

/** 大块头蛋数据 */
export interface BigSizeData {
  /** 大块头蛋极限身高（m），参考值 */
  maxHeight: number
  /** 大块头蛋极限体重（kg），参考值 */
  maxWeight: number
  /** 大块头体重准入线（kg），蛋体重 >= 此值即为大块头 */
  weightMin: number
}

/** 小不点蛋数据 */
export interface SmallSizeData {
  /** 小不点蛋极限身高（m），参考值 */
  maxHeight: number
  /** 小不点蛋极限体重（kg），参考值 */
  maxWeight: number
  /** 小不点体重准入线（kg），蛋体重 <= 此值即为小不点 */
  weightMax: number
}

/** 精灵蛋体型规则（按 familyId 关联家族，无独立 id） */
export interface EggSizeRule {
  familyId: number
  /** 大块头蛋数据 */
  bigSize: BigSizeData
  /** 小不点蛋数据 */
  smallSize: SmallSizeData
}

/** 蛋体型判定结论：大块头 / 小不点 / 普通 */
export type EggVerdict = 'big' | 'small' | 'normal'

/** 蛋体型判定算法输出 */
export interface EggSizeResult {
  /** 判定结论 */
  verdict: EggVerdict
  /** 是否大块头（身高与体重同时达大块头准入线） */
  isBigSize: boolean
  /** 是否小不点（身高与体重同时达小不点准入线） */
  isSmallSize: boolean
  /** 大块头完成度（0~1，取身高/体重相对大块头准入线达标率的均值，单项封顶 1） */
  score: number
  /** 身高相对大块头准入线的比例（>=1 表示达标） */
  heightRate: number
  /** 体重相对大块头准入线的比例（>=1 表示达标） */
  weightRate: number
  /** 身高距大块头准入线差值（m，负值表示未达标） */
  heightDiff: number
  /** 体重距大块头准入线差值（kg，负值表示未达标） */
  weightDiff: number
}

// ==================== 奖牌蛋培育模块 ====================

/** 培育计划：一个账号，可包含多种精灵 */
export interface BreedingPlan {
  id: number
  name: string
  accountName: string
}

/** 培育方向：如大婉蛋（大块头+婉转声）、大粗蛋（大块头+粗嗓门） */
export interface MedalTask {
  id: number
  planId: number
  name: string
  /** 体型奖牌：大块头 | 小不点 */
  sizeMedal: string
  /** 声音奖牌：婉转声 | 粗嗓门 */
  voiceMedal: string
}

/** 培育组：两个小窝（父本+母本）组成一组，一个账号最多5组（10小窝） */
export interface BreedingGroup {
  id: number
  /** 所属计划（Plan级别，5组挂在账号下） */
  planId: number
  /** 当前分配到哪个培育方向，null = 未分配 */
  taskId: number | null
  groupNo: number
  fatherId: number | null
  motherId: number | null
  /** 是否人工调整过（true=不被自动布局覆盖） */
  manual?: boolean
}

/** 亲本池：每个计划的最优 Top5♂+Top5♀，按体重降序 */
export interface ParentPool {
  planId: number
  maleParents: number[]
  femaleParents: number[]
}

/** 个体所在位置：背包 / 家园 */
export type IndividualLocation = 'bag' | 'home'

/** 精灵个体：玩家拥有的一只具体精灵（只引用静态数据，不重复保存名称/头像） */
export interface Individual {
  id: number
  /** 所属培育计划（账号隔离） */
  planId: number
  /** 所属家族（静态数据 PokemonFamily.familyId） */
  familyId: number
  /** 当前形态（静态数据 PokemonForm.formId，页面显示名称/头像靠它查） */
  currentFormId: number
  gender: string
  height: number
  weight: number
  sizeMedal: string
  voiceMedal: string
  personality: string
  specialty: string
  /** 所在位置：bag=背包（默认），home=家园中 */
  location?: IndividualLocation
  /** 若该个体由蛋孵化而来，记录来源蛋记录 ID */
  hatchedFromEggId?: number
}

/** 阶段成长记录：个体在不同进化阶段的体重（供大婉蛋培育助手使用） */
export interface GrowthRecord {
  individualId: number
  records: GrowthStageRecord[]
}

/** 单条阶段记录 */
export interface GrowthStageRecord {
  /** 形态 id（PokemonForm.formId） */
  formId: number
  /** 记录时的等级（可选） */
  level?: number
  /** 记录时的身高（m，可选） */
  height?: number
  /** 记录时的体重（kg，进化时必填） */
  weight: number
}

/** 产蛋时亲本的快照（亲本之后会更换，快照保证历史统计准确） */
export interface ParentSnapshot {
  individualId: number
  pokemonName: string
  weight: number
}

/** 蛋记录：蛋只能记录身高和体重，看不出性别和奖牌 */
export interface EggRecord {
  id: number
  taskId: number
  sourceGroupId: number
  height: number
  weight: number
  status: string
  /** 获取时间（ISO 字符串） */
  acquiredAt: string
  /** 放入孵蛋箱的时间（ISO 字符串），缺省/空 = 不在孵蛋箱中 */
  hatchStartTime?: string
  /** 产出时父本快照（亲本更换后仍可追溯） */
  fatherSnapshot?: ParentSnapshot
  /** 产出时母本快照（亲本更换后仍可追溯） */
  motherSnapshot?: ParentSnapshot
}

/** 孵化时补录的数据（性别+奖牌），用于从蛋生成 Individual */
export interface HatchingData {
  gender: string
  sizeMedal: string
  voiceMedal: string
}

/** 替换推荐结果 */
export interface ReplacementAdvice {
  shouldReplace: boolean
  targetGroup?: BreedingGroup
  targetRole?: 'father' | 'mother'
  currentIndividual?: Individual
  newWeight: number
  oldWeight: number
  reason: string
}

/** 替换记录：执行亲本替换后的留痕 */
export interface ReplacementRecord {
  id: number
  planId: number
  /** 所属培育方向，可能为空（组未分配方向时被替换） */
  taskId: number | null
  groupId: number
  groupNo: number
  role: 'father' | 'mother'
  oldIndividualId: number
  newIndividualId: number
  oldWeight: number
  newWeight: number
  /** 替换时间（ISO 字符串） */
  replacedAt: string
}

// ==================== 小窝布局推荐 ====================

/** 单条配对建议：哪一组配哪两个亲本 */
export interface PairRecommendation {
  /** 目标组 ID */
  groupId: number
  /** 目标组编号 */
  groupNo: number
  /** 推荐的父本 ID */
  fatherId: number | null
  /** 推荐的母本 ID */
  motherId: number | null
  /** 父本体重（用于展示） */
  fatherWeight: number
  /** 母本体重（用于展示） */
  motherWeight: number
}

/** 布局推荐方案 */
export interface LayoutRecommendation {
  /** 推荐的配对列表 */
  pairs: PairRecommendation[]
  /** 被跳过的组（manual=true，不覆盖） */
  skippedGroups: number[]
  /** 未使用的亲本池个体（池比组多时剩余） */
  unusedMales: number[]
  unusedFemales: number[]
}
