<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getAllPlans, createPlan, deletePlan } from '../services/breedingService'
import type { BreedingPlan } from '../types'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()
const plans = getAllPlans()

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({ name: '', accountName: '' })

function openCreate() {
  editingId.value = null
  form.name = ''
  form.accountName = ''
  dialogVisible.value = true
}

function onSave() {
  if (!form.name.trim() || !form.accountName.trim()) return
  const plan = createPlan({ name: form.name, accountName: form.accountName })
  ElMessage.success('计划已创建')
  dialogVisible.value = false
  router.push(`/breeding/${plan.id}`)
}

function onDelete(plan: BreedingPlan) {
  if (confirm(`确定删除「${plan.name}」吗？`)) {
    deletePlan(plan.id)
    ElMessage.success('已删除')
  }
}
</script>

<template>
  <div>
    <PageHeader title="培育计划">
      <template #actions>
        <button @click="openCreate" class="text-xs text-violet-400 font-medium">＋ 新建</button>
      </template>
    </PageHeader>

    <div class="px-4 py-4 space-y-3">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="card active:bg-slate-700/50 transition-colors cursor-pointer"
        @click="router.push(`/breeding/${plan.id}`)"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="font-semibold text-slate-100">{{ plan.name }}</div>
            <div class="text-xs text-slate-400 mt-0.5">{{ plan.accountName }}</div>
          </div>
          <button
            @click.stop="onDelete(plan)"
            class="text-xs text-red-400 px-2 py-1 rounded-lg active:bg-red-500/10"
          >
            删除
          </button>
        </div>
      </div>

      <div v-if="plans.length === 0" class="text-center py-16">
        <p class="text-slate-400 mb-4">还没有培育计划</p>
        <button class="btn btn-primary w-auto px-8" @click="openCreate">创建计划</button>
      </div>
    </div>

    <!-- 新建弹窗 -->
    <el-dialog v-model="dialogVisible" title="新建培育计划" width="90%" :close-on-click-modal="false">
      <div class="space-y-4">
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">计划名</label>
          <input v-model="form.name" class="input-field" placeholder="如：罗隐奖牌培育计划" />
        </div>
        <div>
          <label class="text-sm text-slate-400 mb-1.5 block">账号</label>
          <input v-model="form.accountName" class="input-field" placeholder="如：账号1" />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="dialogVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onSave" :disabled="!form.name.trim() || !form.accountName.trim()">创建</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
