<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFormById, getFamilyOfForm } from '../services/pokemonService'
import { getEggSizeRuleByFamilyId } from '../services/eggSizeService'
import PageHeader from '../components/PageHeader.vue'
import PokemonAvatar from '../components/PokemonAvatar.vue'

const route = useRoute()
const router = useRouter()

const formId = computed(() => Number(route.params.id))
const form = computed(() => getFormById(formId.value))
const family = computed(() => form.value ? getFamilyOfForm(form.value.formId) : undefined)
const rule = computed(() => family.value ? getEggSizeRuleByFamilyId(family.value.familyId) : undefined)

function rarityClass(rarity: string) {
  switch (rarity) {
    case '传说': return 'badge-danger'
    case '史诗': return 'badge-warning'
    case '稀有': return 'badge-success'
    default: return 'badge-neutral'
  }
}

function stageText(stage: number) {
  if (stage === 1) return '初始形态'
  if (stage === 2) return '二阶段'
  return '最终形态'
}
</script>

<template>
  <div>
    <PageHeader :title="form?.name ?? '精灵详情'" :back="true">
      <template #actions>
        <button
          v-if="form"
          @click="router.push(`/check?formId=${form.formId}`)"
          class="text-xs text-pink-500 font-medium"
        >
          去检测
        </button>
      </template>
    </PageHeader>

    <div v-if="form && family" class="px-4 py-6 space-y-6">
      <div class="flex flex-col items-center">
        <PokemonAvatar :name="form.name" :size="72" />
        <h2 class="text-xl font-bold text-pink-900 mt-3">{{ form.name }}</h2>
        <div class="flex items-center gap-2 mt-1">
          <span class="badge" :class="rarityClass(family.rarity)">{{ family.rarity }}</span>
          <span class="badge badge-info">{{ stageText(form.stage) }}</span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span v-for="t in family.types" :key="t" class="badge badge-neutral">{{ t }}</span>
        </div>
      </div>

      <div v-if="family.forms.length > 1">
        <h3 class="section-title">进化链</h3>
        <div class="card">
          <div class="flex items-center justify-around">
            <div
              v-for="(f, i) in family.forms"
              :key="f.formId"
              class="flex flex-col items-center"
            >
              <div
                class="rounded-full p-0.5"
                :class="f.formId === formId ? 'ring-2 ring-pink-400' : ''"
                @click="router.push(`/detail/${f.formId}`)"
              >
                <PokemonAvatar :name="f.name" :size="48" />
              </div>
              <span class="text-xs mt-1" :class="f.formId === formId ? 'text-pink-500 font-medium' : 'text-pink-400'">
                {{ f.name }}
              </span>
              <span v-if="i < family.forms.length - 1" class="text-pink-300 text-xs mt-0.5">↓</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="rule">
        <h3 class="section-title">蛋体型规则</h3>
        <div class="card space-y-3">
          <div class="border-b border-pink-200 pb-3">
            <div class="text-xs font-medium text-emerald-500 mb-2">大块头蛋</div>
            <div class="data-row">
              <span class="data-label">极限身高</span>
              <span class="data-value">{{ rule.bigSize.maxHeight }}m</span>
            </div>
            <div class="data-row">
              <span class="data-label">极限体重</span>
              <span class="data-value">{{ rule.bigSize.maxWeight }}kg</span>
            </div>
            <div class="data-row">
              <span class="data-label">体重准入线</span>
              <span class="data-value text-emerald-500">≥ {{ rule.bigSize.weightMin }}kg</span>
            </div>
          </div>
          <div>
            <div class="text-xs font-medium text-amber-500 mb-2">小不点蛋</div>
            <div class="data-row">
              <span class="data-label">极限身高</span>
              <span class="data-value">{{ rule.smallSize.minHeight }}m</span>
            </div>
            <div class="data-row">
              <span class="data-label">极限体重</span>
              <span class="data-value">{{ rule.smallSize.minWeight }}kg</span>
            </div>
            <div class="data-row">
              <span class="data-label">体重准入线</span>
              <span class="data-value text-amber-500">≤ {{ rule.smallSize.weightMax }}kg</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="family.description">
        <h3 class="section-title">精灵描述</h3>
        <div class="card">
          <p class="text-sm text-pink-700 leading-relaxed">{{ family.description }}</p>
        </div>
      </div>
    </div>

    <div v-else class="flex items-center justify-center h-64">
      <p class="text-pink-400">未找到该精灵</p>
    </div>
  </div>
</template>
