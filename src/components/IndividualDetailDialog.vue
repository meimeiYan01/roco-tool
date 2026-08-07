<script setup lang="ts">
import { computed } from 'vue'
import { getIndividualById, getGroupsByPlanId } from '../services/breedingService'
import { getFormName, getFamilyById } from '../services/pokemonService'
import PokemonAvatar from './PokemonAvatar.vue'

const props = defineProps<{ individualId: number | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const individual = computed(() => props.individualId ? getIndividualById(props.individualId) : undefined)
const family = computed(() => individual.value ? getFamilyById(individual.value.familyId) : undefined)

const groups = computed(() => individual.value ? getGroupsByPlanId(individual.value.planId).filter(g => g.fatherId === individual.value!.id || g.motherId === individual.value!.id) : [])
</script>

<template>
  <el-dialog
    :model-value="!!individualId"
    @update:model-value="!$event && emit('close')"
    width="90%"
    :show-close="true"
  >
    <div v-if="individual && family" class="space-y-6">
      <div class="flex flex-col items-center">
        <PokemonAvatar :name="getFormName(individual.currentFormId)" :gender="individual.gender" :size="64" />
        <h2 class="text-lg font-bold text-pink-900 mt-2">{{ getFormName(individual.currentFormId) }}</h2>
        <span class="text-xs text-pink-400">#{{ individual.id }} {{ individual.gender === 'male' ? '♂' : '♀' }}</span>
        <span class="badge text-[10px] mt-1" :class="(individual.location ?? 'bag') === 'home' ? 'badge-success' : 'badge-neutral'">
          {{ (individual.location ?? 'bag') === 'home' ? '家园中' : '背包' }}
        </span>
      </div>

      <div class="card">
        <div class="data-row"><span class="data-label">身高</span><span class="data-value">{{ individual.height }}m</span></div>
        <div class="data-row"><span class="data-label">体重</span><span class="data-value">{{ individual.weight }}kg</span></div>
        <div class="data-row"><span class="data-label">体型奖牌</span><span class="data-value">{{ individual.sizeMedal || '—' }}</span></div>
        <div class="data-row"><span class="data-label">声音奖牌</span><span class="data-value">{{ individual.voiceMedal || '—' }}</span></div>
        <div class="data-row"><span class="data-label">性格</span><span class="data-value">{{ individual.personality || '—' }}</span></div>
        <div class="data-row border-0"><span class="data-label">特长</span><span class="data-value">{{ individual.specialty || '—' }}</span></div>
      </div>

      <div v-if="groups.length > 0">
        <h3 class="section-title">亲本任职</h3>
        <div class="space-y-2">
          <div v-for="g in groups" :key="g.id" class="card text-sm">
            <span class="text-pink-700">第{{ g.groupNo }}组</span>
            <span class="text-pink-400 ml-2">{{ g.fatherId === individual?.id ? '父本 ♂' : '母本 ♀' }}</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>
