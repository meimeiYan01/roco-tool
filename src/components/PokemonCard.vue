<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { FormWithFamily } from '../services/pokemonService'
import PokemonAvatar from './PokemonAvatar.vue'

const props = defineProps<{
  item: FormWithFamily
}>()

const router = useRouter()

function rarityClass(rarity: string) {
  switch (rarity) {
    case '传说': return 'badge-danger'
    case '史诗': return 'badge-warning'
    case '稀有': return 'badge-success'
    default: return 'badge-neutral'
  }
}

function stageText(stage: number) {
  if (stage === 1) return '初始'
  if (stage === 2) return '二阶'
  return '最终'
}
</script>

<template>
  <div
    class="card flex items-center gap-3 active:bg-slate-700/50 transition-colors cursor-pointer"
    @click="router.push(`/detail/${props.item.form.formId}`)"
  >
    <PokemonAvatar :name="props.item.form.name" :size="44" />
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-0.5">
        <span class="font-medium text-sm text-slate-100 truncate">{{ props.item.form.name }}</span>
        <span class="badge text-[10px]" :class="rarityClass(props.item.family.rarity)">{{ props.item.family.rarity }}</span>
      </div>
      <div class="text-xs text-slate-400">
        {{ props.item.family.familyName }} · {{ stageText(props.item.form.stage) }}
      </div>
      <div class="flex gap-1 mt-1">
        <span v-for="t in props.item.family.types" :key="t" class="badge badge-neutral text-[10px]">{{ t }}</span>
      </div>
    </div>
  </div>
</template>
