<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getIndividualById, getGroupsByPlanId, getIndividualsByPlanId,
  evolveIndividual, getGrowthRecordsByIndividualId, getAllGrowthRecords,
} from '../services/breedingService'
import { getFormName, getFamilyById } from '../services/pokemonService'
import { evaluateStage } from '../utils/individualEvaluator'
import type { StageEvaluation } from '../utils/individualEvaluator'
import PokemonAvatar from './PokemonAvatar.vue'

const props = defineProps<{ individualId: number | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const individual = computed(() => props.individualId ? getIndividualById(props.individualId) : undefined)
const family = computed(() => individual.value ? getFamilyById(individual.value.familyId) : undefined)
const currentForm = computed(() => individual.value && family.value ? family.value.forms.find(f => f.formId === individual.value!.currentFormId) : undefined)
const nextForm = computed(() => currentForm.value && family.value ? family.value.forms.find(f => f.stage === currentForm.value!.stage + 1) : undefined)

const growthRecords = computed(() => individual.value ? getGrowthRecordsByIndividualId(individual.value.id) : [])
const evaluation = computed<StageEvaluation | null>(() => {
  if (!individual.value) return null
  return evaluateStage(individual.value, getIndividualsByPlanId(individual.value.planId), getAllGrowthRecords())
})

const groups = computed(() => individual.value ? getGroupsByPlanId(individual.value.planId).filter(g => g.fatherId === individual.value!.id || g.motherId === individual.value!.id) : [])

// 进化
const evolveDialogVisible = ref(false)
const evolveForm = reactive({ weight: 0, height: 0, level: 0 })
function openEvolve() {
  if (!individual.value) return
  evolveForm.weight = individual.value.weight
  evolveForm.height = individual.value.height
  evolveForm.level = 0
  evolveDialogVisible.value = true
}
function onEvolve() {
  if (!individual.value || evolveForm.weight <= 0) return
  const r = evolveIndividual(individual.value.id, { weight: evolveForm.weight, height: evolveForm.height > 0 ? evolveForm.height : undefined, level: evolveForm.level > 0 ? evolveForm.level : undefined })
  if (!r) { ElMessage.warning('进化失败'); return }
  ElMessage.success(`已进化至 ${getFormName(r.nextForm.formId)}`); evolveDialogVisible.value = false
}

function evalStatusText(s: string) {
  if (s === 'excellent') return '优秀'
  if (s === 'normal') return '普通'
  return '无数据'
}
function evalStatusClass(s: string) {
  if (s === 'excellent') return 'text-emerald-400'
  if (s === 'normal') return 'text-slate-300'
  return 'text-slate-500'
}
</script>

<template>
  <el-dialog
    :model-value="!!individualId"
    @update:model-value="!$event && emit('close')"
    width="90%"
    :show-close="true"
    class="detail-dialog"
  >
    <div v-if="individual && family" class="space-y-6">
      <!-- 头像+基本信息 -->
      <div class="flex flex-col items-center">
        <PokemonAvatar :name="getFormName(individual.currentFormId)" :gender="individual.gender" :size="64" />
        <h2 class="text-lg font-bold text-slate-100 mt-2">{{ getFormName(individual.currentFormId) }}</h2>
        <span class="text-xs text-slate-500">#{{ individual.id }} {{ individual.gender === 'male' ? '♂' : '♀' }}</span>
        <span class="badge text-[10px] mt-1" :class="(individual.location ?? 'bag') === 'home' ? 'badge-success' : 'badge-neutral'">
          {{ (individual.location ?? 'bag') === 'home' ? '家园中' : '背包' }}
        </span>
      </div>

      <!-- 数据 -->
      <div class="card">
        <div class="data-row"><span class="data-label">身高</span><span class="data-value">{{ individual.height }}m</span></div>
        <div class="data-row"><span class="data-label">体重</span><span class="data-value">{{ individual.weight }}kg</span></div>
        <div class="data-row"><span class="data-label">体型奖牌</span><span class="data-value">{{ individual.sizeMedal || '—' }}</span></div>
        <div class="data-row"><span class="data-label">声音奖牌</span><span class="data-value">{{ individual.voiceMedal || '—' }}</span></div>
        <div class="data-row"><span class="data-label">性格</span><span class="data-value">{{ individual.personality || '—' }}</span></div>
        <div class="data-row border-0"><span class="data-label">特长</span><span class="data-value">{{ individual.specialty || '—' }}</span></div>
      </div>

      <!-- 进化 -->
      <div v-if="nextForm" class="card flex items-center justify-between">
        <div>
          <div class="text-xs text-slate-400">可进化至</div>
          <div class="text-sm font-medium text-slate-200">{{ getFormName(nextForm.formId) }}</div>
        </div>
        <button @click="openEvolve" class="btn btn-primary w-auto px-4 py-2 text-sm">进化</button>
      </div>

      <!-- 成长记录 -->
      <div v-if="growthRecords.length > 0">
        <h3 class="section-title">成长阶段</h3>
        <div class="card space-y-2">
          <div v-for="r in growthRecords" :key="r.formId" class="flex items-center justify-between">
            <span class="text-sm text-slate-300">{{ getFormName(r.formId) }}</span>
            <span class="text-sm font-medium text-slate-100">{{ r.weight }}kg</span>
          </div>
        </div>
      </div>

      <!-- 阶段评价 -->
      <div v-if="evaluation">
        <h3 class="section-title">阶段评价</h3>
        <div class="card">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm text-slate-400">当前形态评价</span>
            <span class="text-sm font-medium" :class="evalStatusClass(evaluation.status)">{{ evalStatusText(evaluation.status) }}</span>
          </div>
          <div v-if="evaluation.hasHistory" class="text-xs text-slate-400 space-y-1">
            <div>历史最高：{{ evaluation.historyMax }}kg</div>
            <div>历史平均：{{ evaluation.historyAvg.toFixed(1) }}kg</div>
            <div>样本数：{{ evaluation.historyCount }}</div>
          </div>
        </div>
      </div>

      <!-- 亲本任职 -->
      <div v-if="groups.length > 0">
        <h3 class="section-title">亲本任职</h3>
        <div class="space-y-2">
          <div v-for="g in groups" :key="g.id" class="card text-sm">
            <span class="text-slate-300">第{{ g.groupNo }}组</span>
            <span class="text-slate-400 ml-2">{{ g.fatherId === individual?.id ? '父本 ♂' : '母本 ♀' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 进化弹窗 -->
    <el-dialog v-model="evolveDialogVisible" title="进化确认" width="90%" append-to-body>
      <div class="space-y-4">
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">阶段体重 (kg) *</label>
          <input v-model.number="evolveForm.weight" type="number" step="0.1" class="input-field" />
        </div>
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">阶段身高 (m)</label>
          <input v-model.number="evolveForm.height" type="number" step="0.01" class="input-field" placeholder="可选" />
        </div>
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">等级</label>
          <input v-model.number="evolveForm.level" type="number" class="input-field" placeholder="可选" />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="evolveDialogVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onEvolve" :disabled="evolveForm.weight <= 0">确认进化</button>
        </div>
      </template>
    </el-dialog>
  </el-dialog>
</template>
