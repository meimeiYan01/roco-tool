<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '../components/PageHeader.vue'
import { parseMerchantText, formatAsTodayGoods } from '../utils/merchantParser'
import { setTodayGoods } from '../data/merchantData'

const inputText = ref('')
const parsedNames = ref<string[]>([])
const formattedCode = ref('')

function onParse() {
  parsedNames.value = parseMerchantText(inputText.value)
  formattedCode.value = parsedNames.value.length > 0 ? formatAsTodayGoods(parsedNames.value) : ''

  if (parsedNames.value.length > 0) {
    setTodayGoods(parsedNames.value)
    ElMessage.success(`已保存 ${parsedNames.value.length} 件商品到本地`)
  }
}

function onClear() {
  inputText.value = ''
  parsedNames.value = []
  formattedCode.value = ''
}
</script>

<template>
  <div>
    <PageHeader title="商人文本解析" :back="true" />

    <div class="px-4 py-4 space-y-4">
      <div>
        <label class="text-sm text-pink-400 mb-1.5 block">粘贴远行商人文本</label>
        <textarea
          v-model="inputText"
          class="input-field h-40 resize-none"
          placeholder="例如：
8/7(16:00-20:00)远行商人

1.国王球
2.神奇的蛋
3.黑晶琉璃
4.残缺魔镜"
        ></textarea>
      </div>

      <div class="flex gap-2">
        <button class="btn btn-primary flex-1" @click="onParse" :disabled="!inputText.trim()">解析</button>
        <button class="btn btn-secondary w-20" @click="onClear">清空</button>
      </div>

      <div v-if="parsedNames.length > 0">
        <h3 class="section-title">解析结果（{{ parsedNames.length }} 件商品）</h3>
        <div class="card space-y-1">
          <div v-for="(name, i) in parsedNames" :key="i" class="flex items-center gap-2 text-sm">
            <span class="text-pink-400 w-5 text-right">{{ i + 1 }}.</span>
            <span class="text-pink-900">{{ name }}</span>
          </div>
        </div>
      </div>

      <div v-if="formattedCode">
        <h3 class="section-title">可粘贴代码</h3>
        <pre class="card text-xs text-pink-800 whitespace-pre-wrap break-all">{{ formattedCode }}</pre>
      </div>
    </div>
  </div>
</template>
