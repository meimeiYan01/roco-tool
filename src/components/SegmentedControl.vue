<script setup lang="ts">
defineProps<{
  options: { value: string; label: string }[]
  modelValue: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="flex bg-white rounded-xl p-1 gap-1">
    <button
      v-for="option in options"
      :key="option.value"
      @click="$emit('update:modelValue', option.value)"
      class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all text-center"
      :class="modelValue === option.value
        ? 'bg-pink-400 text-white shadow-sm'
        : 'text-pink-400 active:bg-pink-100'"
    >
      {{ option.label }}
    </button>
  </div>
</template>
