<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SearchBar from '@/components/SearchBar.vue'
import PokemonCard from '@/components/PokemonCard.vue'
import { searchForms, getAllFormsWithFamily } from '@/services/pokemonService'

const route = useRoute()
const router = useRouter()

const keyword = computed(() => (route.query.q as string) ?? '')
const list = computed(() =>
  keyword.value ? searchForms(keyword.value) : getAllFormsWithFamily()
)

function onSearch(kw: string) {
  router.push({ path: '/list', query: { q: kw } })
}
</script>

<template>
  <div class="list-page">
    <div class="list-header">
      <h2>
        {{ keyword ? `搜索：“${keyword}”` : '全部精灵' }}
        <small>（共 {{ list.length }} 只）</small>
      </h2>
      <SearchBar @search="onSearch" />
    </div>

    <el-empty v-if="list.length === 0" description="没有匹配的精灵，换个关键词试试" />

    <el-row v-else :gutter="16">
      <el-col
        v-for="p in list"
        :key="p.form.formId"
        :xs="12"
        :sm="8"
        :md="8"
        :lg="6"
        :xl="6"
      >
        <PokemonCard :item="p" class="card-item" />
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.list-header h2 {
  font-size: 20px;
  margin: 0;
}
.list-header small {
  color: var(--el-text-color-secondary);
  font-weight: 400;
  font-size: 14px;
}
.card-item {
  margin-bottom: 16px;
}
</style>
