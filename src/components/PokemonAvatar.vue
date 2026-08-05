<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 精灵名（用于头像配色和首字） */
    name?: string
    /** 性别：male → ♂，female → ♀ */
    gender?: string
    /** 头像直径 px */
    size?: number
    /** 是否占位模式（空位显示） */
    placeholder?: boolean
    /** 蛋形模式：椭圆形状，不显示性别角标（蛋看不出性别） */
    egg?: boolean
  }>(),
  { name: '', gender: '', size: 56, placeholder: false, egg: false },
)

/** 渐变配色板，后续有真实精灵图片可整体替换为图片头像 */
const PALETTE: [string, string][] = [
  ['#ff9a9e', '#fad0c4'],
  ['#a18cd1', '#fbc2eb'],
  ['#84fab0', '#8fd3f4'],
  ['#f6d365', '#fda085'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#8fd3f4'],
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
]

const colors = computed<[string, string]>(() => {
  const n = props.name || ''
  let hash = 0
  for (let i = 0; i < n.length; i++) {
    hash = (hash * 31 + n.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
})

const initial = computed(() => (props.name || '?').slice(0, 1))
const genderMark = computed(() =>
  props.gender === 'male' ? '♂' : props.gender === 'female' ? '♀' : '',
)

const isEmpty = computed(() => props.placeholder || !props.name)
</script>

<template>
  <div
    class="pokemon-avatar"
    :class="{
      'pokemon-avatar--empty': isEmpty,
      'pokemon-avatar--egg': egg,
    }"
    :style="{
      width: `${size}px`,
      height: `${egg ? size * 1.25 : size}px`,
      ...(isEmpty ? {} : { background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }),
    }"
  >
    <template v-if="isEmpty">
      <span class="pokemon-avatar--question">?</span>
    </template>
    <template v-else>
      <span class="pokemon-avatar--initial">{{ initial }}</span>
      <span v-if="!egg && genderMark" class="pokemon-avatar--gender">{{ genderMark }}</span>
    </template>
  </div>
</template>

<style scoped>
.pokemon-avatar {
  position: relative;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  user-select: none;
}
.pokemon-avatar--egg {
  border-radius: 50% / 42%;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
}
.pokemon-avatar--empty {
  border: 2px dashed var(--el-border-color);
  background: var(--el-fill-color-light);
}
.pokemon-avatar--question {
  color: var(--el-text-color-placeholder);
  font-size: calc(v-bind(size) * 0.4px);
  font-weight: 600;
}
.pokemon-avatar--initial {
  color: #fff;
  font-size: calc(v-bind(size) * 0.42px);
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.pokemon-avatar--gender {
  position: absolute;
  right: -2px;
  bottom: -2px;
  min-width: calc(v-bind(size) * 0.34px);
  height: calc(v-bind(size) * 0.34px);
  line-height: calc(v-bind(size) * 0.34px);
  padding: 0 2px;
  border-radius: 50%;
  background: #fff;
  color: var(--el-color-primary);
  font-size: calc(v-bind(size) * 0.24px);
  font-weight: 700;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
</style>
