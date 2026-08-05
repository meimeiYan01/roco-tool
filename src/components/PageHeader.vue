<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  title: string
  back?: boolean
}>()

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800">
    <div class="flex items-center h-12 px-4 max-w-lg mx-auto">
      <button
        v-if="props.back"
        @click="goBack"
        class="flex items-center justify-center w-8 h-8 -ml-1 rounded-lg text-slate-300 active:bg-slate-800 transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="flex-1 text-base font-semibold text-slate-100 truncate" :class="{ 'ml-2': props.back }">
        {{ props.title }}
      </h1>
      <div class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
