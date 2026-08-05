<script setup lang="ts">
const props = defineProps<{
  name?: string
  gender?: string
  size?: number
  placeholder?: boolean
  egg?: boolean
}>()

const PALETTE = [
  ['#8B5CF6', '#6D28D9'],
  ['#EC4899', '#BE185D'],
  ['#F59E0B', '#D97706'],
  ['#10B981', '#059669'],
  ['#3B82F6', '#1D4ED8'],
  ['#EF4444', '#B91C1C'],
  ['#8B5CF6', '#7C3AED'],
  ['#14B8A6', '#0D9488'],
  ['#F97316', '#EA580C'],
  ['#6366F1', '#4F46E5'],
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const colors = props.name ? PALETTE[hashCode(props.name) % PALETTE.length] : PALETTE[0]
const initial = props.name ? props.name.charAt(0) : '?'
const s = props.size ?? 56
</script>

<template>
  <div
    v-if="placeholder"
    class="flex items-center justify-center rounded-full border-2 border-dashed border-slate-600 text-slate-500"
    :style="{ width: s + 'px', height: (egg ? s * 1.25 : s) + 'px', borderRadius: egg ? '50%/42%' : '50%', fontSize: s * 0.4 + 'px' }"
  >
    ?
  </div>
  <div
    v-else
    class="relative flex items-center justify-center text-white font-semibold shadow-lg"
    :style="{
      width: s + 'px',
      height: (egg ? s * 1.25 : s) + 'px',
      borderRadius: egg ? '50%/42%' : '50%',
      background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      fontSize: s * 0.4 + 'px',
    }"
  >
    {{ initial }}
    <span
      v-if="gender && !egg"
      class="absolute text-white shadow-sm"
      :style="{ fontSize: s * 0.22 + 'px', bottom: '0px', right: '0px' }"
    >
      {{ gender === 'male' ? '♂' : '♀' }}
    </span>
  </div>
</template>
