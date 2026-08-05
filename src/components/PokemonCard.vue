<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { FormWithFamily } from '@/services/pokemonService'

const props = defineProps<{ item: FormWithFamily }>()
const router = useRouter()

// 占位头像：资料包无 image 字段，按 formId 生成稳定色相 + 名称首字
const palette = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]
const avatarColor = computed(
  () => palette[(props.item.form.formId - 1) % palette.length]
)
const avatarText = computed(() => props.item.form.name.slice(0, 1))

const stageText = computed(() => {
  switch (props.item.form.stage) {
    case 1: return '初始形态'
    case 2: return '二阶段'
    case 3: return '最终形态'
    default: return `阶段${props.item.form.stage}`
  }
})

const rarityColor = computed(() => {
  switch (props.item.family.rarity) {
    case '传说': return 'danger'
    case '史诗': return 'warning'
    case '稀有': return 'success'
    default: return 'info'
  }
})

function goDetail() {
  router.push(`/detail/${props.item.form.formId}`)
}
</script>

<template>
  <el-card class="pokemon-card" shadow="hover" @click="goDetail">
    <div class="card-body">
      <div class="avatar" :style="{ background: avatarColor }">
        {{ avatarText }}
      </div>
      <div class="info">
        <div class="name-row">
          <span class="name">{{ item.form.name }}</span>
          <el-tag size="small" :type="rarityColor" effect="dark">
            {{ item.family.rarity }}
          </el-tag>
        </div>
        <div class="meta">
          {{ item.family.familyName }} · {{ stageText }}
        </div>
        <div class="types">
          <el-tag
            v-for="t in item.family.types"
            :key="t"
            size="small"
            type="primary"
            effect="plain"
          >
            {{ t }}
          </el-tag>
        </div>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.pokemon-card {
  cursor: pointer;
  transition: transform 0.15s ease;
}
.pokemon-card:hover {
  transform: translateY(-3px);
}
.card-body {
  display: flex;
  align-items: center;
  gap: 14px;
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  flex-shrink: 0;
}
.info {
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  font-size: 16px;
  font-weight: 600;
}
.meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 2px 0 6px;
}
.types {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
