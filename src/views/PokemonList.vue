<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchForms, getAllFormsWithFamily } from '../services/pokemonService'
import PageHeader from '../components/PageHeader.vue'
import PokemonAvatar from '../components/PokemonAvatar.vue'

const route = useRoute()
const router = useRouter()

const keyword = computed(() => (route.query.q as string) || '')
const list = computed(() =>
  keyword.value ? searchForms(keyword.value) : getAllFormsWithFamily(),
)

function onSearch(e: Event) {
  const input = e.target as HTMLInputElement
  router.replace({ query: input.value ? { q: input.value } : {} })
}

function rarityClass(rarity: string) {
  switch (rarity) {
    case '传说': return 'badge-danger'
    case '史诗': return 'badge-warning'
    case '稀有': return 'badge-success'
    default: return 'badge-neutral'
  }
}
</script>

<template>
  <div>
    <PageHeader title="精灵查询" />

    <!-- 搜索框 -->
    <div class="px-4 py-3 sticky top-12 z-30 bg-rose-50">
      <input
        type="text"
        class="input-field"
        placeholder="搜索精灵名称、系别..."
        :value="keyword"
        @input="onSearch"
      />
    </div>

    <!-- 结果计数 -->
    <div class="px-4 mb-2">
      <span class="text-xs text-pink-400">
        {{ keyword ? `搜索："${keyword}"` : '全部精灵' }}（共 {{ list.length }} 只）
      </span>
    </div>

    <!-- 精灵列表 -->
    <div class="px-4 space-y-3 pb-4">
      <div
        v-for="p in list"
        :key="p.form.formId"
        class="card flex items-center gap-4 active:bg-pink-100/50 transition-colors cursor-pointer"
        @click="router.push(`/detail/${p.form.formId}`)"
      >
        <PokemonAvatar :name="p.form.name" :size="48" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-pink-900">{{ p.form.name }}</span>
            <span class="badge" :class="rarityClass(p.family.rarity)">{{ p.family.rarity }}</span>
          </div>
          <div class="text-xs text-pink-400">
            {{ p.family.familyName }} · {{ p.family.types.join('·') }}
          </div>
          <div class="text-xs text-pink-400 mt-0.5">
            阶段{{ p.form.stage }}
          </div>
        </div>
        <svg class="w-4 h-4 text-pink-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div v-if="list.length === 0" class="text-center py-12">
        <p class="text-pink-400">没有找到匹配的精灵</p>
      </div>
    </div>
  </div>
</template>
