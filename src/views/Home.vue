<script setup lang="ts">
import { useRouter } from 'vue-router'
import { getPopularForms } from '../services/pokemonService'
import { getAllPlans, getGroupsByPlanId, getAllEggRecordsByPlanId, getHatchingEggsByPlanId } from '../services/breedingService'
import PokemonAvatar from '../components/PokemonAvatar.vue'

const router = useRouter()
const popular = getPopularForms(6)

// 培育计划摘要
const plans = getAllPlans()
const currentPlan = plans[0]
const planGroups = currentPlan ? getGroupsByPlanId(currentPlan.id) : []
const planEggs = currentPlan ? getAllEggRecordsByPlanId(currentPlan.id) : []
const hatchingEggs = currentPlan ? getHatchingEggsByPlanId(currentPlan.id).filter(s => s.egg) : []
</script>

<template>
  <div>
    <!-- Header -->
    <header class="px-4 pt-6 pb-4">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-2xl">🥚</span>
        <h1 class="text-xl font-bold text-slate-100">洛克王国蛋助手</h1>
      </div>
      <p class="text-sm text-slate-400">查精灵 · 测大块头 · 管培育</p>
    </header>

    <!-- 搜索框 -->
    <div class="px-4 mb-6">
      <div
        @click="router.push('/list')"
        class="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 active:bg-slate-700 transition-colors cursor-pointer"
      >
        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span class="text-slate-400 text-sm">搜索精灵名称、系别...</span>
      </div>
    </div>

    <!-- 当前培育计划 -->
    <section v-if="currentPlan" class="px-4 mb-6">
      <h2 class="section-title">当前培育计划</h2>
      <div
        class="card active:bg-slate-700/50 transition-colors cursor-pointer"
        @click="router.push(`/breeding/${currentPlan.id}`)"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-slate-100">{{ currentPlan.name }}</span>
          <span class="badge badge-info">{{ currentPlan.accountName }}</span>
        </div>
        <div class="flex gap-4 text-sm text-slate-400">
          <span>{{ planGroups.length }}组</span>
          <span>{{ planEggs.length }}蛋</span>
          <span class="text-amber-400">{{ hatchingEggs.length }}孵蛋中</span>
        </div>
      </div>
    </section>

    <!-- 快捷操作 -->
    <section class="px-4 mb-6">
      <h2 class="section-title">快捷操作</h2>
      <div class="grid grid-cols-2 gap-3">
        <button
          class="card flex flex-col items-center gap-2 active:bg-slate-700/50 transition-colors"
          @click="router.push('/list')"
        >
          <span class="text-2xl">🔍</span>
          <span class="text-sm font-medium text-slate-200">精灵查询</span>
        </button>
        <button
          class="card flex flex-col items-center gap-2 active:bg-slate-700/50 transition-colors"
          @click="router.push('/check')"
        >
          <span class="text-2xl">📏</span>
          <span class="text-sm font-medium text-slate-200">大块头检测</span>
        </button>
      </div>
    </section>

    <!-- 热门精灵 -->
    <section class="px-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="section-title mb-0">热门精灵</h2>
        <button @click="router.push('/list')" class="text-xs text-violet-400">查看全部 →</button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="p in popular"
          :key="p.form.formId"
          class="card flex items-center gap-3 active:bg-slate-700/50 transition-colors cursor-pointer"
          @click="router.push(`/detail/${p.form.formId}`)"
        >
          <PokemonAvatar :name="p.form.name" :size="40" />
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm text-slate-100 truncate">{{ p.form.name }}</div>
            <div class="text-xs text-slate-400">{{ p.family.types[0] }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 底部声明 -->
    <footer class="px-4 py-6 text-center">
      <p class="text-xs text-slate-500">数据仅供参考 · 阈值以游戏实际为准</p>
    </footer>
  </div>
</template>
