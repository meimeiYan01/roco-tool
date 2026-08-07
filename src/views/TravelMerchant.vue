<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { getTodayGoods, setTodayGoods, getCurrentRound, getRemainingSeconds, formatCountdown } from '../data/merchantData'
import { getGoodsByName } from '../data/goodsData'
import { fetchXhsNote } from '../data/xhsNote'
import { parseMerchantText } from '../utils/merchantParser'

const currentRound = ref(0)
const currentTime = ref('')
const countdown = ref('00:00:00')
const goodsNames = ref<string[]>(getTodayGoods())
let timer: ReturnType<typeof setInterval>

const products = computed(() =>
  goodsNames.value.map(name => {
    const found = getGoodsByName(name)
    return found ?? { id: 0, name, image: '', price: 0 }
  })
)

onMounted(async () => {
  updateAll()
  timer = setInterval(updateAll, 1000)

  // 尝试从小红书采集数据更新商品列表
  try {
    const note = await fetchXhsNote()
    if (note) {
      const parsed = parseMerchantText(note.content)
      if (parsed.length > 0) {
        setTodayGoods(parsed)
        goodsNames.value = parsed
      }
    }
  } catch {
    // 静默失败，使用默认数据
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function updateAll() {
  const now = new Date()
  currentRound.value = getCurrentRound(now)
  countdown.value = formatCountdown(getRemainingSeconds(now))
  currentTime.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}
</script>

<template>
  <div>
    <PageHeader title="远行商人" />

    <!-- 商人状态区域 -->
    <div class="px-4 py-3">
      <div class="card bg-gradient-to-r from-pink-50 to-purple-50">
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <div class="text-xs text-pink-400 mb-1">当前轮次</div>
            <div class="text-lg font-bold text-pink-900">
              {{ currentRound > 0 ? `第${currentRound}轮` : '打烊中' }}
            </div>
          </div>
          <div>
            <div class="text-xs text-pink-400 mb-1">当前时间</div>
            <div class="text-sm font-medium text-pink-800">{{ currentTime }}</div>
          </div>
          <div>
            <div class="text-xs text-pink-400 mb-1">剩余时间</div>
            <div class="text-lg font-bold text-amber-600">
              {{ currentRound > 0 ? countdown : '--:--:--' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 商品展示区域 -->
    <div class="px-4 pb-4">
      <template v-if="currentRound > 0">
        <h2 class="section-title">本轮出售商品</h2>
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="product in products"
            :key="product!.id"
            class="card text-center"
          >
            <div class="aspect-square bg-pink-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
              <img v-if="product!.image" :src="product!.image" :alt="product!.name" class="w-full h-full object-contain" />
              <span v-else class="text-2xl">🎁</span>
            </div>
            <div class="font-medium text-sm text-pink-900 truncate">{{ product!.name }}</div>
            <div class="text-xs text-pink-500 mt-1">{{ product!.price > 0 ? product!.price + '金币' : 'xx' }}</div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="card text-center py-12">
          <div class="text-4xl mb-3">🌙</div>
          <div class="text-lg font-bold text-pink-400 mb-1">打烊中</div>
          <div class="text-xs text-pink-300">商人休息中，下一轮开市后刷新查看</div>
        </div>
      </template>
    </div>
  </div>
</template>
