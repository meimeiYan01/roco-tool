<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAllPlans } from '../services/breedingService'

const route = useRoute()
const router = useRouter()

interface Tab {
  path: string
  label: string
  icon: string
  matchPaths: string[]
}

const currentPlanId = computed(() => {
  const id = route.params.id
  if (id) return Number(id)
  const plans = getAllPlans()
  return plans[0]?.id ?? 1
})

const tabs = computed<Tab[]>(() => [
  { path: '/', label: '首页', icon: '🏠', matchPaths: ['/'] },
  { path: '/list', label: '查询', icon: '🔍', matchPaths: ['/list', '/detail', '/check'] },
  { path: '/breeding', label: '培育', icon: '🥚', matchPaths: ['/breeding'] },
  { path: `/breeding/${currentPlanId.value}/stats`, label: '统计', icon: '📊', matchPaths: ['/breeding/'] },
])

const activeTab = computed(() => {
  const path = route.path
  for (const tab of tabs.value) {
    if (tab.matchPaths.some(p => path.startsWith(p) && (p === '/' ? path === '/' : true))) {
      return tab.path
    }
  }
  return '/'
})

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-lg border-t border-slate-700 z-50 safe-bottom">
    <div class="flex justify-around items-center h-14 max-w-lg mx-auto">
      <button
        v-for="tab in tabs"
        :key="tab.path"
        @click="navigate(tab.path)"
        class="flex flex-col items-center justify-center flex-1 h-full transition-colors"
        :class="activeTab === tab.path ? 'text-violet-400' : 'text-slate-400'"
      >
        <span class="text-lg leading-none">{{ tab.icon }}</span>
        <span class="text-[10px] mt-0.5 font-medium">{{ tab.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
