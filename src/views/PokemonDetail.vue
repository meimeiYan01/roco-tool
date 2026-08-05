<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFormById, getFamilyOfForm } from '@/services/pokemonService'
import { getEggSizeRuleByFamilyId } from '@/services/eggSizeService'
import PokemonAvatar from '@/components/PokemonAvatar.vue'

const route = useRoute()
const router = useRouter()

const formId = computed(() => Number(route.params.id))
const form = computed(() => getFormById(formId.value))
const family = computed(() => getFamilyOfForm(formId.value))
const rule = computed(() =>
  family.value ? getEggSizeRuleByFamilyId(family.value.familyId) : undefined
)

const stageText = computed(() => {
  if (!form.value) return ''
  switch (form.value.stage) {
    case 1: return '初始形态'
    case 2: return '二阶段'
    case 3: return '最终形态'
    default: return `阶段${form.value.stage}`
  }
})

const rarityColor = computed(() => {
  switch (family.value?.rarity) {
    case '传说': return 'danger'
    case '史诗': return 'warning'
    case '稀有': return 'success'
    default: return 'info'
  }
})

function goCheck() {
  if (family.value) {
    router.push({ path: '/check', query: { formId: formId.value } })
  }
}
</script>

<template>
  <div class="detail-page">
    <el-button text @click="router.back()">← 返回</el-button>

    <el-empty v-if="!form || !family" description="未找到该精灵" />

    <template v-else>
      <el-card class="detail-card">
        <!-- 基础信息 -->
        <div class="top">
          <PokemonAvatar :name="form.name" :size="88" />
          <div class="head-info">
            <div class="title-row">
              <h2>{{ form.name }}</h2>
              <el-tag :type="rarityColor" effect="dark">{{ family.rarity }}</el-tag>
              <el-tag type="info" effect="plain">{{ stageText }}</el-tag>
            </div>
            <div class="number">{{ family.familyName }}</div>
            <div class="types">
              <el-tag
                v-for="t in family.types"
                :key="t"
                type="primary"
                effect="plain"
              >
                {{ t }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 进化形态列表 -->
        <div v-if="family.forms.length > 1" class="section">
          <h3>🔄 进化家族</h3>
          <div class="form-chain">
            <template v-for="(f, i) in family.forms" :key="f.formId">
              <div
                class="form-node"
                :class="{ 'form-node--active': f.formId === formId }"
                @click="router.push(`/detail/${f.formId}`)"
              >
                <PokemonAvatar :name="f.name" :size="52" />
                <div class="form-name">{{ f.name }}</div>
                <div class="form-stage">阶段{{ f.stage }}</div>
              </div>
              <span v-if="i < family.forms.length - 1" class="form-arrow">→</span>
            </template>
          </div>
        </div>

        <el-divider />

        <!-- 蛋体型信息 -->
        <div class="section">
          <h3>🥚 蛋体型信息</h3>
          <el-descriptions v-if="rule" :column="2" border>
            <el-descriptions-item label="蛋极限身高">
              {{ rule.maxEggHeight }} m
            </el-descriptions-item>
            <el-descriptions-item label="蛋极限体重">
              {{ rule.maxEggWeight }} kg
            </el-descriptions-item>
            <el-descriptions-item label="大块头准入 · 身高">
              ≥ {{ rule.bigSizeRule.heightMin }} m
            </el-descriptions-item>
            <el-descriptions-item label="大块头准入 · 体���">
              ≥ {{ rule.bigSizeRule.weightMin }} kg
            </el-descriptions-item>
            <el-descriptions-item label="小不点准入 · 身高">
              ≤ {{ rule.smallSizeRule.heightMax }} m
            </el-descriptions-item>
            <el-descriptions-item label="小不点准入 · 体重">
              ≤ {{ rule.smallSizeRule.weightMax }} kg
            </el-descriptions-item>
          </el-descriptions>
          <el-text v-else type="info">暂无蛋体型规则数据</el-text>
        </div>

        <div v-if="family.description" class="section">
          <h3>📝 精灵描述</h3>
          <p class="desc">{{ family.description }}</p>
        </div>

        <div class="actions">
          <el-button type="primary" @click="goCheck">去检测这颗蛋 →</el-button>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  max-width: 760px;
  margin: 0 auto;
}
.detail-card {
  margin-top: 16px;
}
.top {
  display: flex;
  gap: 20px;
  align-items: center;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.title-row h2 {
  margin: 0;
  font-size: 24px;
}
.number {
  color: var(--el-text-color-secondary);
  margin: 6px 0;
}
.types {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.section {
  margin-top: 18px;
}
.section h3 {
  font-size: 16px;
  margin: 0 0 10px;
}
.form-chain {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.form-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 10px;
  border: 2px solid transparent;
  border-radius: 12px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.form-node:hover {
  background: var(--el-fill-color-light);
}
.form-node--active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.form-name {
  font-size: 13px;
  font-weight: 600;
}
.form-stage {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.form-arrow {
  color: var(--el-text-color-placeholder);
  font-size: 18px;
}
.desc {
  margin: 0;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}
.actions {
  margin-top: 24px;
  text-align: right;
}
</style>
