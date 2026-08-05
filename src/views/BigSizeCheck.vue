<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAllFormsWithFamily, getFamilyOfForm } from '@/services/pokemonService'
import { getEggSizeRuleByFamilyId } from '@/services/eggSizeService'
import { calculateEggSize } from '@/utils/bigSizeCalculator'
import type { EggSizeResult } from '@/types'

const route = useRoute()
const router = useRouter()

const forms = getAllFormsWithFamily()
const selectedFormId = ref<number | undefined>(undefined)
const height = ref<number | undefined>(undefined)
const weight = ref<number | undefined>(undefined)
const result = ref<EggSizeResult | null>(null)

const rule = computed(() => {
  if (selectedFormId.value === undefined) return undefined
  const family = getFamilyOfForm(selectedFormId.value)
  return family ? getEggSizeRuleByFamilyId(family.familyId) : undefined
})

// 从详情页带入 formId 预填
onMounted(() => {
  const qid = route.query.formId
  if (qid) selectedFormId.value = Number(qid)
})

function detect() {
  if (selectedFormId.value === undefined || height.value == null || weight.value == null) {
    return
  }
  const r = rule.value
  if (!r) {
    result.value = null
    return
  }
  result.value = calculateEggSize(height.value, weight.value, r)
}

function reset() {
  result.value = null
}

function ratePercent(rate: number): number {
  return Math.min(rate, 1) * 100
}

// 三态结论展示
const verdictMeta = computed(() => {
  if (!result.value) return null
  switch (result.value.verdict) {
    case 'big':
      return { icon: 'success' as const, title: '✅ 是大块头！', sub: '身高与体重均达大块头准入线，恭喜获得大块头奖牌' }
    case 'small':
      return { icon: 'info' as const, title: '🟢 是小不点！', sub: '身高与体重均在小不点准入线内，恭喜获得小不点奖牌' }
    default:
      return { icon: 'warning' as const, title: '⚪ 普通体型', sub: '既未达大块头也未达小不点，属于普通蛋体型' }
  }
})

const formOptions = forms.map(({ form, family }) => ({
  label: `${form.name}（${family.familyName}·阶段${form.stage}）`,
  value: form.formId,
}))
</script>

<template>
  <div class="check-page">
    <h2>📐 蛋体型检测</h2>
    <p class="hint">填入精灵、蛋的实测身高与体重，立即判断是大块头、小不点还是普通体型。</p>

    <el-card>
      <el-form label-width="96px" label-position="right">
        <el-form-item label="选择精灵">
          <el-select
            v-model="selectedFormId"
            placeholder="请选择精灵（家族·阶段）"
            filterable
            style="width: 100%"
            @change="reset"
          >
            <el-option
              v-for="opt in formOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <el-alert
          v-if="rule"
          type="info"
          :closable="false"
          class="rule-tip"
        >
          大块头准入：身高 ≥ <b>{{ rule.bigSizeRule.heightMin }} m</b> 且 体重 ≥
          <b>{{ rule.bigSizeRule.weightMin }} kg</b>；小不点准入：身高 ≤
          <b>{{ rule.smallSizeRule.heightMax }} m</b> 且 体重 ≤
          <b>{{ rule.smallSizeRule.weightMax }} kg</b>
        </el-alert>

        <el-form-item label="蛋身高 (m)">
          <el-input-number
            v-model="height"
            :min="0"
            :step="0.01"
            :precision="2"
            controls-position="right"
            style="width: 100%"
            @change="reset"
          />
        </el-form-item>
        <el-form-item label="蛋体重 (kg)">
          <el-input-number
            v-model="weight"
            :min="0"
            :step="0.1"
            :precision="2"
            controls-position="right"
            style="width: 100%"
            @change="reset"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :disabled="!selectedFormId || height == null || weight == null"
            @click="detect"
          >
            检测
          </el-button>
          <el-button @click="reset">清空结果</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="result && verdictMeta" class="result-card">
      <el-result
        :icon="verdictMeta.icon"
        :title="verdictMeta.title"
        :sub-title="verdictMeta.sub"
      />

      <div class="metrics">
        <div class="metric">
          <div class="metric-label">大块头完成度</div>
          <el-progress
            type="dashboard"
            :percentage="Math.round(result.score * 100)"
            :color="result.isBigSize ? '#67c23a' : '#e6a23c'"
          />
        </div>

        <div class="metric bars">
          <div class="bar-item">
            <div class="bar-label">
              身高达标率（大块头方向）
              <span class="bar-rate">{{ result.heightRate.toFixed(2) }}×</span>
            </div>
            <el-progress
              :percentage="ratePercent(result.heightRate)"
              :status="result.heightRate >= 1 ? 'success' : ''"
              :text-inside="true"
              :stroke-width="18"
            />
            <div
              class="diff"
              :class="result.heightDiff >= 0 ? 'ok' : 'fail'"
            >
              距大块头准入线 {{ result.heightDiff >= 0 ? '超出' : '还差' }}
              {{ Math.abs(result.heightDiff) }} m
            </div>
          </div>

          <div class="bar-item">
            <div class="bar-label">
              体重达标率（大块头方向）
              <span class="bar-rate">{{ result.weightRate.toFixed(2) }}×</span>
            </div>
            <el-progress
              :percentage="ratePercent(result.weightRate)"
              :status="result.weightRate >= 1 ? 'success' : ''"
              :text-inside="true"
              :stroke-width="18"
            />
            <div
              class="diff"
              :class="result.weightDiff >= 0 ? 'ok' : 'fail'"
            >
              距大块头准入线 {{ result.weightDiff >= 0 ? '超出' : '还差' }}
              {{ Math.abs(result.weightDiff) }} kg
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.check-page {
  max-width: 720px;
  margin: 0 auto;
}
.check-page h2 {
  margin: 0 0 4px;
}
.hint {
  color: var(--el-text-color-secondary);
  margin: 0 0 16px;
}
.rule-tip {
  margin-bottom: 16px;
}
.result-card {
  margin-top: 20px;
}
.metrics {
  display: flex;
  gap: 32px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  padding-top: 8px;
}
.metric-label {
  text-align: center;
  margin-bottom: 8px;
  font-weight: 600;
}
.bars {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.bar-item {
  width: 100%;
}
.bar-label {
  margin-bottom: 6px;
  font-size: 13px;
}
.bar-rate {
  color: var(--el-text-color-secondary);
  margin-left: 6px;
}
.diff {
  margin-top: 6px;
  font-size: 13px;
}
.diff.ok {
  color: #67c23a;
}
.diff.fail {
  color: #f56c6c;
}
</style>
