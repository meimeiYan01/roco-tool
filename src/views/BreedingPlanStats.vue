<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getPlanById, getTasksByPlanId, getGroupsByPlanId, getAllIndividuals,
  getIndividualById, getIndividualDisplayName, getGrowthRecordsByIndividualId,
  getGroupById, getAllEggRecordsByPlanId, getReplacementRecordsByPlanId,
} from '../services/breedingService'
import { getFormName, getFormById } from '../services/pokemonService'
import { getEggStatsByParentCombo, getEggStatsByGroupDay } from '../utils/eggStats'
import { buildEggPedigree } from '../utils/eggPedigree'
import type { EggPedigree } from '../utils/eggPedigree'
import type { Individual, BreedingGroup, EggRecord, GrowthStageRecord } from '../types'
import PageHeader from '../components/PageHeader.vue'
import PokemonAvatar from '../components/PokemonAvatar.vue'

const route = useRoute()
const router = useRouter()

const planId = Number(route.params.id)
const plan = getPlanById(planId)
const tasks = getTasksByPlanId(planId)
const allGroups = ref<BreedingGroup[]>(getGroupsByPlanId(planId))

const planEggs = computed(() => getAllEggRecordsByPlanId(planId))
const comboStats = computed(() => getEggStatsByParentCombo(planEggs.value))
const groupDayStats = computed(() => getEggStatsByGroupDay(planEggs.value, allGroups.value))

// ── 亲本迭代记录 ──
const expandedGroups = ref<number[]>([])
function buildGroupLine(g: BreedingGroup, role: 'father' | 'mother') {
  const recs = getReplacementRecordsByPlanId(planId).filter(r => r.groupId === g.id && r.role === role).sort((a, b) => (a.replacedAt > b.replacedAt ? 1 : -1))
  const currentId = role === 'father' ? g.fatherId : g.motherId
  if (!currentId) return []
  const nodes: { id: number; name: string; weight: number; since?: string }[] = []
  for (const r of recs) {
    nodes.push({ id: r.oldIndividualId, name: getIndividualDisplayName(r.oldIndividualId), weight: r.oldWeight })
    nodes.push({ id: r.newIndividualId, name: getIndividualDisplayName(r.newIndividualId), weight: r.newWeight, since: r.replacedAt })
  }
  if (nodes.length === 0) {
    const ind = getIndividualById(currentId)
    if (ind) nodes.push({ id: ind.id, name: getFormName(ind.currentFormId), weight: ind.weight })
  }
  return nodes
}

// ── 个体体重对比 ──
const growthMatrixRows = computed(() => {
  const rows = getAllIndividuals().map(ind => {
    const records = getGrowthRecordsByIndividualId(ind.id)
    if (records.length === 0) return null
    const byStage: Record<number, GrowthStageRecord> = {}
    for (const r of records) { const f = getFormById(r.formId); if (f) byStage[f.stage] = r }
    return { ind, byStage }
  }).filter((x): x is { ind: Individual; byStage: Record<number, GrowthStageRecord> } => x !== null)
  return rows.sort((a, b) => {
    const lastOf = (m: Record<number, GrowthStageRecord>) => Object.values(m).sort((x, y) => y.formId - x.formId)[0]?.weight ?? 0
    return lastOf(b.byStage) - lastOf(a.byStage)
  })
})
const maxStage = computed(() => growthMatrixRows.value.reduce((m, r) => Math.max(m, ...Object.keys(r.byStage).map(Number)), 0))

// ── 蛋迭代溯源 ──
const pedigreeDialogVisible = ref(false)
const pedigree = ref<EggPedigree | null>(null)
function showPedigree(egg: EggRecord) {
  const g = getGroupById(egg.sourceGroupId)
  pedigree.value = buildEggPedigree(egg, getAllIndividuals(), getReplacementRecordsByPlanId(planId), g?.groupNo ?? 0, getIndividualDisplayName)
  pedigreeDialogVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader title="统计" :back="true" />

    <div class="px-4 py-4 space-y-6">
      <!-- 亲本迭代记录 -->
      <section>
        <h2 class="section-title">亲本迭代记录</h2>
        <div class="space-y-3">
          <div v-for="g in allGroups" :key="g.id" class="card">
            <div class="font-semibold text-sm text-slate-200 mb-3">第{{ g.groupNo }}组</div>
            <div class="space-y-3">
              <div v-for="role in (['father', 'mother'] as const)" :key="role">
                <div class="text-xs text-slate-400 mb-1">{{ role === 'father' ? '父本 ♂' : '母本 ♀' }}</div>
                <div class="space-y-1">
                  <div v-for="(node, i) in buildGroupLine(g, role)" :key="i" class="flex items-center gap-2 text-sm">
                    <div class="w-2 h-2 rounded-full" :class="i === buildGroupLine(g, role).length - 1 ? 'bg-violet-500' : 'bg-slate-600'" />
                    <span class="text-slate-200">{{ node.name }}</span>
                    <span class="text-xs text-slate-500">{{ node.weight }}kg</span>
                    <span v-if="node.since" class="text-xs text-slate-600 ml-auto">{{ node.since.slice(0, 10) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 个体体重对比 -->
      <section v-if="growthMatrixRows.length > 0">
        <h2 class="section-title">个体体重对比</h2>
        <div class="space-y-2">
          <div v-for="row in growthMatrixRows" :key="row.ind.id" class="card">
            <div class="flex items-center gap-3 mb-2">
              <PokemonAvatar :name="getFormName(row.ind.currentFormId)" :gender="row.ind.gender" :size="32" />
              <span class="text-sm font-medium text-slate-200">{{ getFormName(row.ind.currentFormId) }}</span>
              <span class="text-xs text-slate-500">#{{ row.ind.id }}</span>
            </div>
            <div class="flex gap-2">
              <div v-for="s in maxStage" :key="s" class="flex-1 text-center bg-slate-700/50 rounded-lg py-2">
                <div class="text-[10px] text-slate-500">阶段{{ s }}</div>
                <div class="text-sm font-medium" :class="row.byStage[s] ? 'text-slate-100' : 'text-slate-600'">
                  {{ row.byStage[s] ? row.byStage[s].weight + 'kg' : '—' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 亲本组合平均体重 -->
      <section v-if="comboStats.length > 0">
        <h2 class="section-title">亲本组合平均体重</h2>
        <div class="card space-y-3">
          <div v-for="c in comboStats" :key="c.key" class="space-y-1">
            <div class="flex justify-between text-xs">
              <span class="text-slate-300">{{ c.fatherName }} × {{ c.motherName }}</span>
              <span class="text-slate-400">{{ c.avgWeight.toFixed(1) }}kg · {{ c.count }}蛋</span>
            </div>
            <div class="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full bg-violet-500 rounded-full" :style="{ width: `${comboStats.length > 0 ? (c.avgWeight / comboStats[0].avgWeight * 100) : 0}%` }" />
            </div>
          </div>
        </div>
      </section>

      <!-- 蛋的迭代溯源 -->
      <section v-if="planEggs.length > 0">
        <h2 class="section-title">蛋迭代溯源</h2>
        <div class="space-y-2">
          <div v-for="egg in planEggs" :key="egg.id" class="card">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm text-slate-200">蛋#{{ egg.id }} · {{ egg.weight }}kg</div>
                <div class="text-xs text-slate-400">{{ egg.acquiredAt?.slice(0, 10) }}</div>
              </div>
              <button @click="showPedigree(egg)" class="text-xs text-violet-400 px-2 py-1 rounded-lg active:bg-violet-500/10">
                查看溯源
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 溯源弹窗 -->
    <el-dialog v-model="pedigreeDialogVisible" title="蛋迭代溯源" width="90%">
      <div v-if="pedigree" class="space-y-4">
        <div>
          <div class="text-xs text-slate-400 mb-2">父本链</div>
          <div class="space-y-1">
            <div v-for="(node, i) in pedigree.fatherChain" :key="i" class="flex items-center gap-2 text-sm">
              <div class="w-2 h-2 rounded-full" :class="i === pedigree.fatherChain.length - 1 ? 'bg-violet-500' : 'bg-slate-600'" />
              <span class="text-slate-200">{{ node.name }}</span>
              <span class="text-xs text-slate-500">{{ node.weight }}kg</span>
            </div>
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-400 mb-2">母本链</div>
          <div class="space-y-1">
            <div v-for="(node, i) in pedigree.motherChain" :key="i" class="flex items-center gap-2 text-sm">
              <div class="w-2 h-2 rounded-full" :class="i === pedigree.motherChain.length - 1 ? 'bg-violet-500' : 'bg-slate-600'" />
              <span class="text-slate-200">{{ node.name }}</span>
              <span class="text-xs text-slate-500">{{ node.weight }}kg</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>
