<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ (e: 'search', keyword: string): void }>()
const keyword = ref('')

function onSearch() {
  emit('search', keyword.value)
}
</script>

<template>
  <el-input
    v-model="keyword"
    placeholder="输入精灵名称 / 图鉴编号 / 系别，如：罗隐、58、恶魔系"
    clearable
    size="large"
    class="search-bar"
    @keyup.enter="onSearch"
  >
    <template #append>
      <el-button type="primary" @click="onSearch">搜索</el-button>
    </template>
  </el-input>
</template>

<style scoped>
.search-bar {
  max-width: 640px;
  width: 100%;
}
</style>
