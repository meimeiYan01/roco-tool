<script setup lang="ts">
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()

const menuItems = [
  { icon: '📊', label: '体重记录', desc: '记录精灵家族各阶段体重', path: '/weight' },
  { icon: '📥', label: '导入精灵数据', desc: '从 Excel 批量导入精灵', action: 'import' },
  { icon: '📤', label: '导出培育数据', desc: '导出当前计划的精灵数据', action: 'export' },
]
</script>

<template>
  <div>
    <PageHeader title="我的" />

    <div class="px-4 py-4 space-y-2">
      <div
        v-for="item in menuItems"
        :key="item.label"
        class="card flex items-center gap-3 cursor-pointer active:bg-pink-100 transition-colors"
        @click="item.path ? router.push(item.path) : null"
      >
        <span class="text-xl">{{ item.icon }}</span>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-pink-900">{{ item.label }}</div>
          <div class="text-xs text-pink-400">{{ item.desc }}</div>
        </div>
        <svg class="w-4 h-4 text-pink-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>

    <div class="px-4 py-8 text-center">
      <p class="text-xs text-pink-400">洛克王国：世界 · 大块头蛋查询工具</p>
      <p class="text-xs text-pink-300 mt-1">v0.1.0</p>
    </div>
  </div>
</template>
