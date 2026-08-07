<script setup lang="ts">
import BottomTabBar from './components/BottomTabBar.vue'
</script>

<template>
  <div class="min-h-screen bg-rose-50 pb-16">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
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
