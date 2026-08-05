<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'search', keyword: string): void
}>()

const keyword = ref('')

function onSearch() {
  emit('search', keyword.value.trim())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') onSearch()
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      v-model="keyword"
      type="text"
      class="input-field flex-1"
      placeholder="输入精灵名称、系别..."
      @keydown="onKeydown"
    />
    <button @click="onSearch" class="btn btn-primary w-auto px-4 py-3 text-sm flex-shrink-0">
      搜索
    </button>
  </div>
</template>
