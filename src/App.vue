<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeIndex = computed(() => route.path)

const navList = [
  { index: '/', label: '首页' },
  { index: '/list', label: '精灵列表' },
  { index: '/check', label: '大块头检测' },
  { index: '/breeding', label: '培育助手' },
]
</script>

<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="brand">
        <span class="brand-logo">🥚</span>
        <span class="brand-title">洛克王国：世界 · 大块头蛋查询</span>
      </div>
      <el-menu
        :default-active="activeIndex"
        mode="horizontal"
        router
        class="app-menu"
        :ellipsis="false"
      >
        <el-menu-item v-for="item in navList" :key="item.index" :index="item.index">
          {{ item.label }}
        </el-menu-item>
      </el-menu>
    </el-header>

    <el-main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>

    <el-footer class="app-footer">
      <span>数据仅供参考 · V1 纯前端静态数据 · 阈值以游戏实际为准</span>
    </el-footer>
  </el-container>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 24px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  white-space: nowrap;
}
.brand-logo {
  font-size: 24px;
}
.brand-title {
  font-size: 16px;
}
.app-menu {
  flex: 1;
  border-bottom: none !important;
  background: transparent !important;
}
.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
.app-footer {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  border-top: 1px solid var(--el-border-color);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
