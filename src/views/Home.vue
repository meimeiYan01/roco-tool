<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import quotesData from '../data/skillQuotes.json'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000)
  pickQuotes()
})
onBeforeUnmount(() => { clearInterval(timer) })

const dateStr = computed(() => {
  const d = now.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
})

const timeStr = computed(() => {
  const d = now.value
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
})

const selectedQuotes = ref<{ text: string; skill: string }[]>([])

function pickQuotes() {
  const shuffled = [...quotesData].sort(() => Math.random() - 0.5)
  selectedQuotes.value = shuffled.slice(0, 2)
}

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h >= 5 && h < 12) return '上午好，小洛克'
  if (h >= 12 && h < 14) return '中午好，小洛克'
  if (h >= 14 && h < 18) return '下午好，小洛克'
  return '晚上好，小洛克'
})
</script>

<template>
  <div class="home-hero">
    <!-- 左上角时间 -->
    <div class="home-time-area">
      <p class="home-greeting">{{ greeting }}</p>
      <p class="home-time">{{ timeStr }}</p>
      <p class="home-date">{{ dateStr }}</p>
    </div>

    <!-- 随机技能文案 -->
    <div class="home-quotes">
      <div v-for="(q, i) in selectedQuotes" :key="i" class="home-quote">
        <p class="home-quote-text">"{{ q.text }}"</p>
        <p class="home-quote-skill">— {{ q.skill }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-hero {
  position: relative;
  height: 100%;
  overflow: hidden;
  background-image: url('/roco-tool/bg.jpg');
  background-size: cover;
  background-position: center;
}
.home-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 245, 247, 0);
}

/* 左上角时间 */
.home-time-area {
  position: absolute;
  top: 24px;
  left: 20px;
  z-index: 1;
}
.home-greeting {
  font-size: 0.85rem;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  font-family: 'Georgia', 'Noto Serif SC', serif;
  margin-bottom: 2px;
}
.home-time {
  font-size: 2.2rem;
  font-weight: 300;
  color: #fff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.05em;
  line-height: 1.1;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.home-date {
  font-size: 0.75rem;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  margin-top: 4px;
  font-family: 'Georgia', 'Noto Serif SC', serif;
}

/* 技能文案 */
.home-quotes {
  position: absolute;
  top: 50%;
  left: 20px;
  right: 20px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  transform: translateY(-50%);
}
.home-quote {
  text-align: right;
}
.home-quote-text {
  font-size: 0.9rem;
  color: #fff;
  font-style: italic;
  line-height: 1.6;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
  font-family: 'Georgia', 'Noto Serif SC', serif;
}
.home-quote-skill {
  font-size: 0.7rem;
  color: #fff;
  margin-top: 4px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
</style>
