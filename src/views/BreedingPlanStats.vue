<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getPlanById,
  getTasksByPlanId,
  getGroupsByPlanId,
  getAllIndividuals,
  getIndividualById,
  getIndividualDisplayName,
  getGrowthRecordsByIndividualId,
  getGroupById,
  getAllEggRecordsByPlanId,
  getReplacementRecordsByPlanId,
} from '../services/breedingService'
import { getFormName, getFormById } from '../services/pokemonService'
import { getEggStatsByParentCombo, getEggStatsByGroupDay } from '../utils/eggStats'
import { buildEggPedigree } from '../utils/eggPedigree'
import type { EggPedigree } from '../utils/eggPedigree'
import type { Individual, BreedingGroup, EggRecord, GrowthStageRecord } from '../types'
import PokemonAvatar from '../components/PokemonAvatar.vue'

const route = useRoute()
const router = useRouter()

const planId = Number(route.params.id)
const plan = getPlanById(planId)
const tasks = getTasksByPlanId(planId)
const individuals = getAllIndividuals()
const allGroups = ref<BreedingGroup[]>(getGroupsByPlanId(planId))

function back() {
  router.push(`/breeding/${planId}`)
}

/** 时间显示：MM-DD HH:mm */
function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 从来源组亲本推断蛋对应的精灵名（母本优先） */
function getEggPokemonName(egg: EggRecord): string {
  const group = getGroupById(egg.sourceGroupId)
  const parent = getIndividualById(group?.motherId ?? -1) ?? getIndividualById(group?.fatherId ?? -1)
  return parent ? getFormName(parent.currentFormId) : ''
}

// ── 基础统计 ──
/** 本计划所有蛋 */
const planEggs = computed(() => getAllEggRecordsByPlanId(planId))
/** 按亲本组合汇总（平均体重降序，体现迭代） */
const comboStats = computed(() => getEggStatsByParentCombo(planEggs.value))

// ── 按组×按天统计（小组为单位迭代，两个维度对比）──
const groupDayStats = computed(() => getEggStatsByGroupDay(planEggs.value, allGroups.value))
/** 所有出现的日期（升序） */
const statDates = computed(() => [...new Set(groupDayStats.value.map(s => s.date))].sort())
/** 所有产出过蛋的小组号（升序） */
const statGroupNos = computed(() =>
  [...new Set(groupDayStats.value.map(s => s.groupNo))].sort((a, b) => a - b),
)

/** 对比表行数据：{ groupNo, [date]: {avg, count} | null } */
const groupDayRows = computed(() =>
  statGroupNos.value.map(no => {
    const row: Record<string, unknown> & { groupNo: number } = { groupNo: no }
    for (const d of statDates.value) {
      const st = groupDayStats.value.find(s => s.groupNo === no && s.date === d)
      row[d] = st ? { avg: st.avgWeight, count: st.count, max: st.maxWeight } : null
    }
    return row
  }),
)

/** 每小组一条折线的趋势数据（x=日期索引，y=当天平均体重） */
const GROUP_COLORS = ['#409eff', '#67c23a', '#e6a23c', '#9b59b6', '#f56c6c']
const groupTrends = computed(() => {
  const W = 640
  const H = 240
  const pl = 44
  const pr = 16
  const pt = 18
  const pb = 34
  const innerW = W - pl - pr
  const innerH = H - pt - pb
  const allWeights = planEggs.value.map(e => e.weight)
  const minW = allWeights.length > 0 ? Math.min(...allWeights) - 2 : 30
  const maxW = allWeights.length > 0 ? Math.max(...allWeights) + 2 : 45
  const range = maxW - minW || 1
  const dates = statDates.value
  const xOf = (i: number) =>
    dates.length === 1 ? pl + innerW / 2 : pl + (i * innerW) / (dates.length - 1)

  return statGroupNos.value.map((no, idx) => {
    const byDate = new Map(groupDayStats.value.filter(s => s.groupNo === no).map(s => [s.date, s]))
    const points: { x: number; y: number; avg: number; count: number; date: string }[] = []
    for (let i = 0; i < dates.length; i++) {
      const st = byDate.get(dates[i])
      if (st) {
        points.push({
          x: xOf(i),
          y: pt + innerH - ((st.avgWeight - minW) / range) * innerH,
          avg: st.avgWeight,
          count: st.count,
          date: dates[i],
        })
      }
    }
    // 分段连线（无蛋的日期断开）
    const segments: string[] = []
    let cur: string[] = []
    for (let i = 0; i < dates.length; i++) {
      const p = points.find(p => p.date === dates[i])
      if (p) {
        cur.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      } else if (cur.length > 1) {
        segments.push(cur.join(' '))
        cur = []
      }
    }
    if (cur.length > 1) segments.push(cur.join(' '))

    return {
      groupNo: no,
      color: GROUP_COLORS[idx % GROUP_COLORS.length],
      points,
      segments,
    }
  })
})

/** 多折线 x 轴日期刻度 */
const statDateTicks = computed(() => {
  const dates = statDates.value
  const W = 640
  const pl = 44
  const pr = 16
  const innerW = W - pl - pr
  return dates.map((d, i) => ({
    d,
    x: dates.length === 1 ? pl + innerW / 2 : pl + (i * innerW) / (dates.length - 1),
  }))
})

/** 多折线纵轴范围 */
const groupWeightRange = computed(() => {
  const allWeights = planEggs.value.map(e => e.weight)
  return {
    min: allWeights.length > 0 ? Math.min(...allWeights) - 2 : 30,
    max: allWeights.length > 0 ? Math.max(...allWeights) + 2 : 45,
  }
})

/** 组合条形图的最大平均体重（用于归一化宽度） */
const maxComboAvg = computed(() =>
  comboStats.value.length > 0 ? Math.max(...comboStats.value.map(c => c.avgWeight)) : 1,
)

// ── 蛋的迭代溯源 ──
const pedigreeDialogVisible = ref(false)
const pedigree = ref<EggPedigree | null>(null)

/** 蛋列表行数据：附加来源组号 */
const pedigreeEggs = computed(() =>
  planEggs.value
    .slice()
    .sort((a, b) => (b.acquiredAt || '').localeCompare(a.acquiredAt || ''))
    .map(e => ({
      ...e,
      groupNo: getGroupById(e.sourceGroupId)?.groupNo ?? '?',
      taskName: tasks.find(t => t.id === e.taskId)?.name ?? '未知方向',
    })),
)

function openPedigree(egg: EggRecord) {
  const groupNo = getGroupById(egg.sourceGroupId)?.groupNo ?? 0
  pedigree.value = buildEggPedigree(
    egg,
    individuals,
    getReplacementRecordsByPlanId(planId),
    groupNo,
    id => getIndividualDisplayName(id),
  )
  pedigreeDialogVisible.value = true
}

// ── 个体体重对比（按进化阶段）──
/** 行=个体，列=进化阶段，单元格=该阶段体重；按最终阶段体重降序 */
const growthMatrixRows = computed(() => {
  const rows = getAllIndividuals()
    .map(ind => {
      const records = getGrowthRecordsByIndividualId(ind.id)
      if (records.length === 0) return null
      const byStage: Record<number, GrowthStageRecord> = {}
      for (const r of records) {
        const form = getFormById(r.formId)
        if (form) byStage[form.stage] = r
      }
      return { ind, byStage }
    })
    .filter((x): x is { ind: Individual; byStage: Record<number, GrowthStageRecord> } => x !== null)

  return rows.sort((a, b) => {
    const lastOf = (m: Record<number, GrowthStageRecord>) =>
      Object.values(m).sort((x, y) => y.formId - x.formId)[0]?.weight ?? 0
    return lastOf(b.byStage) - lastOf(a.byStage)
  })
})

/** 出现的最大进化阶段数（表格列数） */
const maxStage = computed(() =>
  growthMatrixRows.value.reduce(
    (m, r) => Math.max(m, ...Object.keys(r.byStage).map(Number)),
    0,
  ),
)

/** 某阶段形态名（tooltip 用） */
function stageFormName(record: GrowthStageRecord): string {
  return getFormById(record.formId)?.name ?? `#${record.formId}`
}

// ── 各组亲本迭代记录 ──
interface IterNode {
  individualId: number
  name: string
  weight: number
  /** 上任时间（初始亲本无） */
  since?: string
}

/** 每组父本/母本的完整迭代链（初始亲本 → 替换 → … → 当前亲本） */
const groupIterations = computed(() =>
  allGroups.value
    .slice()
    .sort((a, b) => a.groupNo - b.groupNo)
    .map(g => ({
      groupNo: g.groupNo,
      father: buildGroupLine(g, 'father'),
      mother: buildGroupLine(g, 'mother'),
    })),
)

function buildGroupLine(g: BreedingGroup, role: 'father' | 'mother'): IterNode[] {
  const recs = getReplacementRecordsByPlanId(planId)
    .filter(r => r.groupId === g.id && r.role === role)
    .slice()
    .sort((a, b) => (a.replacedAt || '').localeCompare(b.replacedAt || ''))

  const nameOf = (id: number) => getIndividualDisplayName(id)
  const weightOf = (id: number) => getIndividualById(id)?.weight ?? 0

  const line: IterNode[] = []
  if (recs.length > 0) {
    line.push({
      individualId: recs[0].oldIndividualId,
      name: nameOf(recs[0].oldIndividualId),
      weight: recs[0].oldWeight,
    })
    for (const r of recs) {
      line.push({
        individualId: r.newIndividualId,
        name: nameOf(r.newIndividualId),
        weight: r.newWeight,
        since: r.replacedAt,
      })
    }
  } else {
    const curId = role === 'father' ? g.fatherId : g.motherId
    if (curId != null) {
      line.push({
        individualId: curId,
        name: nameOf(curId),
        weight: weightOf(curId),
      })
    }
  }
  return line
}
</script>

<template>
  <div class="stats-page">
    <template v-if="plan">
      <div class="stats-header">
        <div>
          <h2>{{ plan.name }} · 统计</h2>
          <div class="header-info">
            {{ plan.accountName }} · 数据实时联动，亲本/蛋变更后自动刷新
          </div>
        </div>
        <el-button @click="back">返回培育详情</el-button>
      </div>

      <div v-if="planEggs.length > 0" class="stats-charts">
        <!-- 各组亲本迭代记录 -->
        <div class="section">
          <h4>各组亲本迭代记录</h4>
          <el-collapse class="iter-collapse">
            <el-collapse-item v-for="it in groupIterations" :key="it.groupNo">
              <template #title>
                <span class="iter-title">第 {{ it.groupNo }} 组</span>
                <el-tag v-if="it.father.length > 1 || it.mother.length > 1" size="small" type="warning">
                  有迭代记录
                </el-tag>
                <el-tag v-else size="small" type="info">亲本未更换</el-tag>
              </template>

              <div class="iter-lines">
                <div class="iter-line">
                  <div class="iter-role">父本迭代</div>
                  <el-timeline v-if="it.father.length > 0">
                    <el-timeline-item
                      v-for="(node, i) in it.father"
                      :key="node.individualId + i"
                      :timestamp="i === 0 ? '初始' : formatDateTime(node.since)"
                      :type="i === it.father.length - 1 ? 'success' : 'primary'"
                    >
                      <span class="iter-node-name">{{ node.name }}</span>
                      <span class="iter-node-weight">{{ node.weight }}kg</span>
                    </el-timeline-item>
                  </el-timeline>
                  <p v-else class="empty-slot">未设置父本</p>
                </div>

                <div class="iter-line">
                  <div class="iter-role">母本迭代</div>
                  <el-timeline v-if="it.mother.length > 0">
                    <el-timeline-item
                      v-for="(node, i) in it.mother"
                      :key="node.individualId + i"
                      :timestamp="i === 0 ? '初始' : formatDateTime(node.since)"
                      :type="i === it.mother.length - 1 ? 'success' : 'primary'"
                    >
                      <span class="iter-node-name">{{ node.name }}</span>
                      <span class="iter-node-weight">{{ node.weight }}kg</span>
                    </el-timeline-item>
                  </el-timeline>
                  <p v-else class="empty-slot">未设置母本</p>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 个体体重对比 -->
        <div class="section">
          <h4>个体体重对比（按进化阶段，最终阶段体重降序）</h4>
          <p class="chart-hint">横向对比不同个体在同一进化阶段的体重，末列展示当前形态与体重</p>
          <el-table :data="growthMatrixRows" border stripe size="small">
            <el-table-column label="个体" min-width="150">
              <template #default="{ row }">
                <div class="backpack-egg-cell">
                  <PokemonAvatar
                    :name="getFormName(row.ind.currentFormId)"
                    :gender="row.ind.gender"
                    :size="36"
                  />
                  <div class="backpack-egg-info">
                    <span class="backpack-egg-name">{{ getFormName(row.ind.currentFormId) }}</span>
                    <span class="backpack-egg-id">#{{ row.ind.id }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-for="s in maxStage"
              :key="s"
              :label="`阶段${s}`"
              width="92"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.byStage[s]">
                  <el-tooltip
                    :content="`${stageFormName(row.byStage[s])} · 等级 ${row.byStage[s].level ?? '—'} · 身高 ${row.byStage[s].height ? row.byStage[s].height + 'm' : '—'}`"
                    placement="top"
                  >
                    <span class="stage-weight">{{ row.byStage[s].weight }}kg</span>
                  </el-tooltip>
                </template>
                <span v-else class="empty-slot">—</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty
            v-if="growthMatrixRows.length === 0"
            description="还没有进化体重记录，孵化或进化个体后自动生成"
            :image-size="60"
          />
        </div>

        <!-- 各组每天蛋平均体重 -->
        <div class="section">
          <h4>各组每天蛋平均体重（按组×按天）</h4>
          <div class="chart-card">
            <svg viewBox="0 0 640 240" class="trend-chart">
              <line x1="44" y1="18" x2="44" y2="206" stroke="var(--el-border-color)" stroke-width="1" />
              <line x1="44" y1="206" x2="624" y2="206" stroke="var(--el-border-color)" stroke-width="1" />
              <text x="38" y="22" text-anchor="end" font-size="11" fill="var(--el-text-color-secondary)">
                {{ groupWeightRange.max }}
              </text>
              <text x="38" y="210" text-anchor="end" font-size="11" fill="var(--el-text-color-secondary)">
                {{ groupWeightRange.min }}
              </text>
              <template v-for="tr in groupTrends" :key="tr.groupNo">
                <polyline
                  v-for="(seg, i) in tr.segments"
                  :key="i"
                  :points="seg"
                  fill="none"
                  :stroke="tr.color"
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <circle
                  v-for="p in tr.points"
                  :key="tr.groupNo + p.date"
                  :cx="p.x"
                  :cy="p.y"
                  r="4"
                  :fill="tr.color"
                >
                  <title>第{{ tr.groupNo }}组 · {{ p.date }} · 平均 {{ p.avg.toFixed(1) }}kg（{{ p.count }}枚）</title>
                </circle>
              </template>
              <text
                v-for="t in statDateTicks"
                :key="'d' + t.d"
                :x="t.x"
                :y="226"
                text-anchor="middle"
                font-size="10"
                fill="var(--el-text-color-secondary)"
              >
                {{ t.d.slice(5) }}
              </text>
            </svg>
            <div class="chart-legend">
              <span v-for="tr in groupTrends" :key="'lg' + tr.groupNo" class="legend-item">
                <i class="legend-dot" :style="{ background: tr.color }" />
                第{{ tr.groupNo }}组
              </span>
            </div>
            <p class="chart-hint">每条线代表一个小组的每天平均蛋重，可对比组间差异与迭代趋势</p>
          </div>
        </div>

        <!-- 按组×天对比表 -->
        <div class="section">
          <h4>各组每天蛋体重对比（平均 kg，括号内为蛋数）</h4>
          <el-table :data="groupDayRows" border stripe size="small">
            <el-table-column label="小组" width="90" align="center">
              <template #default="{ row }">第{{ row.groupNo }}组</template>
            </el-table-column>
            <el-table-column
              v-for="d in statDates"
              :key="d"
              :label="d.slice(5)"
              align="center"
              min-width="90"
            >
              <template #default="{ row }">
                <template v-if="row[d]">
                  <div class="gday-avg">{{ row[d].avg.toFixed(1) }}kg</div>
                  <div class="gday-meta">{{ row[d].count }}枚 · 最高{{ row[d].max }}</div>
                </template>
                <span v-else class="empty-slot">—</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="groupDayRows.length === 0" description="还没有蛋" :image-size="60" />
        </div>

        <!-- 亲本组合 -->
        <div class="section">
          <h4>亲本组合平均体重</h4>
          <div class="chart-card hbar-chart">
            <div v-for="c in comboStats" :key="c.key" class="hbar-row">
              <span class="hbar-label">
                {{ c.fatherName }}♂{{ c.fatherWeight }} × {{ c.motherName }}♀{{ c.motherWeight }}
              </span>
              <div class="hbar-track">
                <div class="hbar-fill" :style="{ width: (c.avgWeight / maxComboAvg) * 100 + '%' }" />
              </div>
              <span class="hbar-value">{{ c.avgWeight.toFixed(1) }}kg</span>
            </div>
          </div>
          <el-empty v-if="comboStats.length === 0" description="还没有蛋" :image-size="60" />
        </div>

        <!-- 蛋的迭代溯源 -->
        <div class="section">
          <h4>蛋的迭代溯源（查看每颗蛋的亲本替换链）</h4>
          <el-table :data="pedigreeEggs" border stripe size="small">
            <el-table-column label="精灵蛋" min-width="130">
              <template #default="{ row }">
                <div class="backpack-egg-cell">
                  <PokemonAvatar
                    :name="getEggPokemonName(row)"
                    :egg="true"
                    :size="36"
                    :placeholder="!getEggPokemonName(row)"
                  />
                  <div class="backpack-egg-info">
                    <span class="backpack-egg-name">{{ getEggPokemonName(row) || '未知精灵' }}</span>
                    <span class="backpack-egg-id">蛋#{{ row.id }} · {{ row.weight }}kg</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="获取时间" width="110">
              <template #default="{ row }">{{ formatDateTime(row.acquiredAt) }}</template>
            </el-table-column>
            <el-table-column label="来源" width="110" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="success">{{ row.taskName }}</el-tag>
                第{{ row.groupNo }}组
              </template>
            </el-table-column>
            <el-table-column label="产出组合" min-width="150">
              <template #default="{ row }">
                <span v-if="row.fatherSnapshot && row.motherSnapshot">
                  {{ row.fatherSnapshot.pokemonName }}♂{{ row.fatherSnapshot.weight }} ×
                  {{ row.motherSnapshot.pokemonName }}♀{{ row.motherSnapshot.weight }}
                </span>
                <span v-else class="empty-slot">快照缺失</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" align="center">
              <template #default="{ row }">
                <el-button text size="small" type="primary" @click="openPedigree(row)">
                  查看溯源
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="pedigreeEggs.length === 0" description="还没有蛋" :image-size="60" />
        </div>
      </div>

      <el-empty
        v-else
        description="还没有蛋数据，先去背包新增蛋吧"
        :image-size="80"
      />

      <!-- 蛋迭代溯源弹窗 -->
      <el-dialog
        v-model="pedigreeDialogVisible"
        title="蛋迭代溯源"
        width="620px"
        append-to-body
      >
        <template v-if="pedigree">
          <el-alert
            :title="`第 ${pedigree.groupNo} 组产出的蛋#${pedigree.egg.id} · ${pedigree.egg.height}m / ${pedigree.egg.weight}kg`"
            type="success"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
          >
            亲本替换链（从最初亲本到产出该蛋）：
          </el-alert>

          <h4 class="pedigree-title">父本迭代链</h4>
          <el-timeline v-if="pedigree.fatherChain.length > 0">
            <el-timeline-item
              v-for="(node, i) in pedigree.fatherChain"
              :key="node.individualId"
              :timestamp="i === 0 ? '最初亲本' : formatDateTime(node.since)"
              :type="i === pedigree.fatherChain.length - 1 ? 'success' : 'primary'"
            >
              {{ node.name }}（{{ node.weight }}kg）
              <span v-if="node.replacedFromId" class="pedigree-replace-note">
                顶替 #{{ node.replacedFromId }}
              </span>
            </el-timeline-item>
            <el-timeline-item type="warning" timestamp="产出">
              🥚 产出蛋#{{ pedigree.egg.id }}（{{ pedigree.egg.weight }}kg）
            </el-timeline-item>
          </el-timeline>
          <p v-else class="empty-slot">该组产出时无父本快照</p>

          <h4 class="pedigree-title">母本迭代链</h4>
          <el-timeline v-if="pedigree.motherChain.length > 0">
            <el-timeline-item
              v-for="(node, i) in pedigree.motherChain"
              :key="node.individualId"
              :timestamp="i === 0 ? '最初亲本' : formatDateTime(node.since)"
              :type="i === pedigree.motherChain.length - 1 ? 'success' : 'primary'"
            >
              {{ node.name }}（{{ node.weight }}kg）
              <span v-if="node.replacedFromId" class="pedigree-replace-note">
                顶替 #{{ node.replacedFromId }}
              </span>
            </el-timeline-item>
            <el-timeline-item type="warning" timestamp="产出">
              🥚 产出蛋#{{ pedigree.egg.id }}（{{ pedigree.egg.weight }}kg）
            </el-timeline-item>
          </el-timeline>
          <p v-else class="empty-slot">该组产出时无母本快照</p>
        </template>
      </el-dialog>
    </template>
    <el-empty v-else description="未找到该培育计划" />
  </div>
</template>

<style scoped>
.stats-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}
.stats-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}
.stats-header h2 {
  margin: 0 0 8px 0;
}
.header-info {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.section {
  margin-bottom: 28px;
}
.section h4 {
  margin: 0 0 12px;
  font-size: 15px;
}
.chart-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-bg-color-overlay);
}
.trend-chart {
  width: 100%;
  height: auto;
  display: block;
}
.chart-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 6px 0 0;
}
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.hbar-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hbar-label {
  font-size: 12px;
  color: var(--el-text-color-primary);
  min-width: 180px;
  white-space: nowrap;
}
.hbar-track {
  flex: 1;
  height: 18px;
  background: var(--el-fill-color-light);
  border-radius: 9px;
  overflow: hidden;
}
.hbar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--el-color-success-light-5), var(--el-color-success));
  border-radius: 9px;
  transition: width 0.3s ease;
}
.hbar-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  min-width: 48px;
  text-align: right;
}
.gday-avg {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.gday-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.iter-collapse {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
.iter-title {
  font-weight: 600;
  margin-right: 10px;
}
.iter-lines {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}
.iter-line {
  flex: 1;
  min-width: 240px;
}
.iter-role {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}
.iter-node-name {
  font-weight: 500;
}
.iter-node-weight {
  color: var(--el-text-color-secondary);
  margin-left: 6px;
}
.pedigree-title {
  margin: 14px 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.pedigree-replace-note {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.backpack-egg-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.growth-chain {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.growth-arrow {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}
.stage-weight {
  font-weight: 600;
  color: var(--el-text-color-primary);
  cursor: default;
}
.backpack-egg-info {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.backpack-egg-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.backpack-egg-id {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.empty-slot {
  color: var(--el-text-color-secondary);
  font-style: italic;
}
</style>
