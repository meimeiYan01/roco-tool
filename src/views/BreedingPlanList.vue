<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getAllPlans, createPlan, updatePlan, deletePlan } from '../services/breedingService'
import type { BreedingPlan } from '../types'

const router = useRouter()
const plans = getAllPlans()

// ── 新建/编辑计划弹窗 ──
const dialogVisible = ref(false)
const editingId = ref<number | null>(null) // null=新建，有值=编辑
const form = reactive({
  name: '',
  accountName: '',
})

function openCreate() {
  editingId.value = null
  form.name = ''
  form.accountName = ''
  dialogVisible.value = true
}

function openEdit(plan: BreedingPlan) {
  editingId.value = plan.id
  form.name = plan.name
  form.accountName = plan.accountName
  dialogVisible.value = true
}

const canSave = () => form.name.trim() && form.accountName.trim()

function onSave() {
  if (!canSave()) return

  if (editingId.value !== null) {
    updatePlan(editingId.value, {
      name: form.name,
      accountName: form.accountName,
    })
    ElMessage.success('计划已更新')
  } else {
    const plan = createPlan({
      name: form.name,
      accountName: form.accountName,
    })
    ElMessage.success('计划已创建')
    dialogVisible.value = false
    router.push(`/breeding/${plan.id}`)
    return
  }
  dialogVisible.value = false
}

function onDelete(plan: BreedingPlan) {
  ElMessageBox.confirm(
    `确定删除「${plan.name}」吗？该计划下的所有方向、小组、蛋记录和关联个体都会被删除。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
  )
    .then(() => {
      deletePlan(plan.id)
      ElMessage.success('计划已删除')
    })
    .catch(() => {})
}

function goToDetail(id: number) {
  router.push(`/breeding/${id}`)
}
</script>

<template>
  <div class="breeding-list">
    <div class="page-header">
      <div>
        <h2>培育计划</h2>
        <p class="subtitle">选择一个计划查看培育详情</p>
      </div>
      <el-button type="primary" @click="openCreate">新建计划</el-button>
    </div>
    <el-row :gutter="20">
      <el-col v-for="plan in plans" :key="plan.id" :xs="24" :sm="12" :md="8">
        <el-card class="plan-card" shadow="hover">
          <div class="plan-card-body" @click="goToDetail(plan.id)">
            <h3>{{ plan.name }}</h3>
            <div class="plan-info">
              <span>账号：{{ plan.accountName }}</span>
            </div>
          </div>
          <div class="plan-card-actions">
            <el-button text size="small" @click="openEdit(plan)">编辑</el-button>
            <el-button text size="small" type="danger" @click="onDelete(plan)">删除</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-empty v-if="plans.length === 0" description="暂无培育计划，点击右上角新建" />

    <!-- 新建/编辑计划弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId !== null ? '编辑计划' : '新建计划'"
      width="480px"
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="计划名" required>
          <el-input v-model="form.name" placeholder="如：罗隐奖牌培育计划" />
        </el-form-item>
        <el-form-item label="账号" required>
          <el-input v-model="form.accountName" placeholder="如：账号1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSave()" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.page-header h2 {
  margin: 0 0 4px 0;
}
.subtitle {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin: 0;
}
.plan-card {
  margin-bottom: 20px;
  transition: transform 0.2s;
}
.plan-card-body {
  cursor: pointer;
}
.plan-card-body:hover {
  color: var(--el-color-primary);
}
.plan-card-body h3 {
  margin: 0 0 12px 0;
}
.plan-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
.plan-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 8px;
}
</style>
