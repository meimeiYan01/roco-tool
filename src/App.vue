<script setup lang="ts">
import BottomTabBar from './components/BottomTabBar.vue'
</script>

<template>
  <div class="h-screen overflow-hidden bg-rose-50 flex flex-col">
    <div class="flex-1 min-h-0">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
    <BottomTabBar />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
