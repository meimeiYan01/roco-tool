<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  unit?: string
  icon?: string
  color?: 'default' | 'success' | 'warning' | 'danger'
}>()
</script>

<template>
  <div class="card flex items-center gap-3">
    <div
      v-if="icon"
      class="flex items-center justify-center w-10 h-10 rounded-xl text-lg"
      :class="{
        'bg-slate-700': color === 'default' || !color,
        'bg-emerald-500/20': color === 'success',
        'bg-amber-500/20': color === 'warning',
        'bg-red-500/20': color === 'danger',
      }"
    >
      {{ icon }}
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-xs text-slate-400 truncate">{{ label }}</div>
      <div class="flex items-baseline gap-1">
        <span class="text-lg font-semibold text-slate-100">{{ value }}</span>
        <span v-if="unit" class="text-xs text-slate-400">{{ unit }}</span>
      </div>
    </div>
  </div>
</template>
