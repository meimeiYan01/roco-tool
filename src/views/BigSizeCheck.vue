<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAllFormsWithFamily, getFamilyOfForm } from '../services/pokemonService'
import { getEggSizeRuleByFamilyId } from '../services/eggSizeService'
import { calculateEggSize } from '../utils/bigSizeCalculator'
import type { EggSizeResult } from '../types'
import PageHeader from '../components/PageHeader.vue'

const route = useRoute()

const formOptions = getAllFormsWithFamily()
const selectedFormId = ref<number | undefined>()
const weight = ref(0)
const result = ref<EggSizeResult | null>(null)

const rule = computed(() => {
  if (!selectedFormId.value) return undefined
  const family = getFamilyOfForm(selectedFormId.value)
  return family ? getEggSizeRuleByFamilyId(family.familyId) : undefined
})

onMounted(() => {
  const q = route.query.formId
  if (q) selectedFormId.value = Number(q)
})

function detect() {
  if (!rule.value || weight.value <= 0) return
  result.value = calculateEggSize(0, weight.value, rule.value)
}

function clearResult() {
  result.value = null
}

function verdictLabel(v: string) {
  if (v === 'big') return '大块头！'
  if (v === 'small') return '小不点！'
  return '普通体型'
}

function verdictColor(v: string) {
  if (v === 'big') return 'text-emerald-400'
  if (v === 'small') return 'text-amber-400'
  return 'text-pink-400'
}

function verdictBg(v: string) {
  if (v === 'big') return 'bg-emerald-500/20'
  if (v === 'small') return 'bg-amber-500/20'
  return 'bg-pink-200/30'
}
</script>

<template>
  <div>
    <PageHeader title="大块头检测" :back="true" />

    <div class="px-4 py-6 space-y-6">
      <!-- 输入卡片 -->
      <div class="card space-y-4">
        <div>
          <label class="text-sm text-pink-400 mb-1.5 block">选择精灵</label>
          <select v-model="selectedFormId" class="input-field">
            <option :value="undefined" disabled>请选择精灵</option>
            <option
              v-for="f in formOptions"
              :key="f.form.formId"
              :value="f.form.formId"
            >
              {{ f.form.name }}（{{ f.family.familyName }}·阶段{{ f.form.stage }}）
            </option>
          </select>
        </div>

        <!-- 规则提示 -->
        <div v-if="rule" class="bg-pink-100/50 rounded-xl p-3 text-xs text-pink-400 space-y-1">
          <div>大块头：体重 ≥ {{ rule.bigSize.weightMin }}kg</div>
          <div>小不点：体重 ≤ {{ rule.smallSize.weightMax }}kg</div>
        </div>

        <div>
          <label class="text-sm text-pink-400 mb-1.5 block">体重 (kg)</label>
          <input v-model.number="weight" type="number" step="0.1" min="0" class="input-field" placeholder="输入蛋的体重" />
        </div>

        <div class="flex gap-3">
          <button class="btn btn-primary flex-1" @click="detect" :disabled="!rule || weight <= 0">
            检测
          </button>
          <button v-if="result" class="btn btn-secondary w-24" @click="clearResult">
            清空
          </button>
        </div>
      </div>

      <!-- 结果卡片 -->
      <div v-if="result" class="card space-y-4">
        <!-- 判定结果 -->
        <div class="text-center py-4" :class="verdictBg(result.verdict)">
          <div class="text-2xl font-bold" :class="verdictColor(result.verdict)">
            {{ verdictLabel(result.verdict) }}
          </div>
        </div>

        <!-- 完成度 -->
        <div v-if="result.verdict !== 'small'" class="text-center">
          <div class="text-xs text-pink-400 mb-2">大块头完成度</div>
          <div class="relative w-24 h-24 mx-auto">
            <svg class="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
              <path
                class="text-slate-700"
                stroke="currentColor"
                fill="none"
                stroke-width="3"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                class="text-violet-500 transition-all duration-500"
                stroke="currentColor"
                fill="none"
                stroke-width="3"
                :stroke-dasharray="`${Math.min(result.score * 100, 100)}, 100`"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-xl font-bold text-pink-900">{{ Math.round(result.score * 100) }}%</span>
            </div>
          </div>
        </div>

        <!-- 体重达标率 -->
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span class="text-pink-400">体重达标率</span>
            <span :class="result.weightRate >= 1 ? 'text-emerald-400' : 'text-red-400'">
              {{ Math.round(result.weightRate * 100) }}%
            </span>
          </div>
          <div class="h-2 bg-pink-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="result.weightRate >= 1 ? 'bg-emerald-500' : 'bg-violet-500'"
              :style="{ width: `${Math.min(result.weightRate * 100, 100)}%` }"
            />
          </div>
        </div>

        <!-- 差值 -->
        <div class="bg-pink-100/50 rounded-xl p-3 text-center">
          <div class="text-xs text-pink-400 mb-1">距大块头准入线</div>
          <div class="text-lg font-semibold" :class="result.weightDiff >= 0 ? 'text-emerald-400' : 'text-red-400'">
            {{ result.weightDiff >= 0 ? '+' : '' }}{{ result.weightDiff }}kg
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
