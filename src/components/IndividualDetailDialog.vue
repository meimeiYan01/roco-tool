<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getIndividualById,
  getAllGroups,
  getAllIndividuals,
  evolveIndividual,
  getGrowthRecordsByIndividualId,
  getAllGrowthRecords,
} from '../services/breedingService'
import { getFormName, getFamilyById } from '../services/pokemonService'
import { evaluateStage } from '../utils/individualEvaluator'
import type { StageEvaluation } from '../utils/individualEvaluator'
import type { PokemonForm } from '../types'
import PokemonAvatar from './PokemonAvatar.vue'

const props = defineProps<{
  /** 要查看的个体 id，null 时关闭 */
  individualId: number | null
}>()

const emit = defineEmits<{ close: [] }>()

const visible = computed({
  get: () => props.individualId !== null,
  set: (v: boolean) => {
    if (!v) emit('close')
  },
})

const individual = computed(() =>
  props.individualId !== null ? getIndividualById(props.individualId) : undefined,
)

/** 个体形态名（由 currentFormId 查静态数据） */
const displayName = computed(() =>
  individual.value ? getFormName(individual.value.currentFormId) || `#${individual.value.id}` : '',
)

const family = computed(() =>
  individual.value ? getFamilyById(individual.value.familyId) : undefined,
)

const currentForm = computed<PokemonForm | undefined>(() => {
  if (!individual.value || !family.value) return undefined
  return family.value.forms.find(f => f.formId === individual.value!.currentFormId)
})

/** 下一形态（只能进化到下一阶段，不跨阶段） */
const nextForm = computed<PokemonForm | undefined>(() => {
  if (!currentForm.value || !family.value) return undefined
  return family.value.forms.find(f => f.stage === currentForm.value!.stage + 1)
})

/** 亲本任职：该个体当前在哪些组担任父本/母本 */
const parentRoles = computed(() => {
  const id = props.individualId
  if (id === null) return []
  return getAllGroups()
    .filter(g => g.fatherId === id || g.motherId === id)
    .sort((a, b) => a.groupNo - b.groupNo)
    .map(g => ({
      groupNo: g.groupNo,
      role: g.fatherId === id ? 'father' : 'mother',
    }))
})

/** 阶段成长记录（进化时写入） */
const growthRecords = computed(() =>
  props.individualId !== null ? getGrowthRecordsByIndividualId(props.individualId) : [],
)

const genderText = computed(() => (individual.value?.gender === 'male' ? '雄性 ♂' : '雌性 ♀'))

// ── 进化 ──
const evolveDialogVisible = ref(false)
const evolveForm = reactive({
  weight: 0,
  height: 0,
  level: 0,
})

function openEvolve() {
  if (!individual.value) return
  evolveForm.weight = individual.value.weight
  evolveForm.height = individual.value.height
  evolveForm.level = 0
  evolveDialogVisible.value = true
}

function onEvolveConfirm() {
  if (props.individualId === null || evolveForm.weight <= 0) {
    ElMessage.warning('请填写该阶段的体重')
    return
  }
  const result = evolveIndividual(props.individualId, {
    weight: evolveForm.weight,
    height: evolveForm.height > 0 ? evolveForm.height : undefined,
    level: evolveForm.level > 0 ? evolveForm.level : undefined,
  })
  if (!result) {
    ElMessage.warning('进化失败：个体不存在或已是最终形态')
    return
  }
  ElMessage.success(`进化成功！${getFormName(result.nextForm.formId)} 已记录成长数据`)
  evolveDialogVisible.value = false
}

/** 成长记录显示名 */
function recordLabel(record: { formId: number }): string {
  return getFormName(record.formId) || `#${record.formId}`
}

/** 阶段评价：新孵个体 vs 同条件历史数据 */
const stageEval = computed(() => {
  const ind = individual.value
  if (!ind) return null
  return evaluateStage(ind, getAllIndividuals(), getAllGrowthRecords())
})
</script>

<template>
  <el-dialog v-model="visible" title="个体详情" width="480px" append-to-body>
    <template v-if="individual">
      <div class="ind-header">
        <PokemonAvatar :name="displayName" :gender="individual.gender" :size="72" />
        <div class="ind-header-info">
          <div class="ind-name">{{ displayName }}</div>
          <div class="ind-id">#{{ individual.id }}</div>
          <el-tag v-if="(individual.location ?? 'bag') === 'home'" size="small" type="success">家园中</el-tag>
          <el-tag v-else size="small">背包</el-tag>
        </div>
      </div>

      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="性别">{{ genderText }}</el-descriptions-item>
        <el-descriptions-item label="身高">{{ individual.height }}m</el-descriptions-item>
        <el-descriptions-item label="体重">{{ individual.weight }}kg</el-descriptions-item>
        <el-descriptions-item label="体型奖牌">{{ individual.sizeMedal || '—' }}</el-descriptions-item>
        <el-descriptions-item label="声音奖牌">{{ individual.voiceMedal || '—' }}</el-descriptions-item>
        <el-descriptions-item label="性格">{{ individual.personality || '—' }}</el-descriptions-item>
        <el-descriptions-item label="特长">{{ individual.specialty || '—' }}</el-descriptions-item>
        <el-descriptions-item label="来源">
          <span v-if="individual.hatchedFromEggId">蛋#{{ individual.hatchedFromEggId }} 孵化</span>
          <span v-else>手动添加</span>
        </el-descriptions-item>
      </el-descriptions>

      <div class="ind-section">
        <h4>进化状态</h4>
        <div class="evolve-row">
          <el-tag size="small" type="primary">{{ displayName }}</el-tag>
          <template v-if="nextForm">
            <span class="evolve-arrow">→</span>
            <el-tag size="small" type="success">{{ getFormName(nextForm.formId) }}</el-tag>
            <el-button size="small" type="primary" @click="openEvolve">进化</el-button>
          </template>
          <el-tag v-else size="small" type="info">最终形态</el-tag>
        </div>
        <p class="evolve-hint">
          {{ nextForm ? '进化是可选操作，只能进入下一阶段，进化时需记录当前阶段的体重' : '该家族已无更高阶段' }}
        </p>
      </div>

      <div class="ind-section" v-if="stageEval">
        <h4>阶段评价 · {{ getFormName(individual.currentFormId) }}</h4>
        <template v-if="stageEval.hasHistory">
          <div class="eval-row">
            <el-tag
              :type="stageEval.status === 'excellent' ? 'success' : 'warning'"
              size="small"
            >
              {{ stageEval.status === 'excellent' ? '优秀' : '普通' }}
            </el-tag>
            <span class="eval-detail">
              历史 {{ stageEval.historyCount }} 样本 · 最高 {{ stageEval.historyMax }}kg · 平均 {{ stageEval.historyAvg.toFixed(1) }}kg
            </span>
          </div>
          <p class="evolve-hint">
            {{ stageEval.status === 'excellent' ? '当前体重超过历史最高，优秀个体！' : '有历史参考但未超最高，可选继续培养。' }}
          </p>
        </template>
        <el-alert
          v-else
          title="该阶段缺少参考数据"
          description="暂无同家族、同形态、同性别、同声音奖牌的历史记录。建议进化到下一阶段后再进行比较。"
          type="info"
          :closable="false"
          show-icon
        />
      </div>

      <div class="ind-section">
        <h4>成长记录（{{ growthRecords.length }}）</h4>
        <el-table v-if="growthRecords.length > 0" :data="growthRecords" border stripe size="small">
          <el-table-column label="阶段" min-width="90">
            <template #default="{ row }">{{ recordLabel(row) }}</template>
          </el-table-column>
          <el-table-column label="等级" width="60" align="center">
            <template #default="{ row }">{{ row.level ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="身高" width="80" align="center">
            <template #default="{ row }">{{ row.height ? row.height + 'm' : '—' }}</template>
          </el-table-column>
          <el-table-column label="体重" width="80" align="center">
            <template #default="{ row }">{{ row.weight }}kg</template>
          </el-table-column>
        </el-table>
        <p v-else class="empty-slot">暂无成长记录，进化时自动记录</p>
      </div>

      <div class="ind-section">
        <h4>亲本任职</h4>
        <div v-if="parentRoles.length > 0" class="parent-role-list">
          <el-tag
            v-for="r in parentRoles"
            :key="r.groupNo + r.role"
            size="small"
            :type="r.role === 'father' ? 'primary' : 'danger'"
          >
            第{{ r.groupNo }}组{{ r.role === 'father' ? '父本' : '母本' }}
          </el-tag>
        </div>
        <p v-else class="empty-slot">当前未担任亲本</p>
      </div>
    </template>
  </el-dialog>

  <!-- 进化弹窗 -->
  <el-dialog v-model="evolveDialogVisible" title="进化" width="420px" append-to-body>
    <template v-if="individual && currentForm && nextForm">
      <div class="evolve-banner">
        <el-tag size="small" type="primary">{{ getFormName(currentForm.formId) }}</el-tag>
        <span class="evolve-arrow">→</span>
        <el-tag size="small" type="success">{{ getFormName(nextForm.formId) }}</el-tag>
      </div>
      <el-alert
        title="进化前请记录当前阶段数据"
        description="记录的是「当前形态」的最终体重/身高，进化后个体变为下一阶段。"
        type="info"
        :closable="false"
        show-icon
        style="margin: 12px 0"
      />
      <el-form :model="evolveForm" label-width="90px">
        <el-form-item label="体重 (kg)" required>
          <el-input-number v-model="evolveForm.weight" :precision="2" :step="0.1" :min="0" />
        </el-form-item>
        <el-form-item label="身高 (m)">
          <el-input-number v-model="evolveForm.height" :precision="2" :step="0.01" :min="0" />
        </el-form-item>
        <el-form-item label="等级">
          <el-input-number v-model="evolveForm.level" :min="0" :max="200" />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="evolveDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="onEvolveConfirm">确认进化</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ind-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.ind-header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}
.ind-name {
  font-size: 18px;
  font-weight: 700;
}
.ind-id {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.ind-section {
  margin-top: 16px;
}
.ind-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
}
.parent-role-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.evolve-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.evolve-arrow {
  color: var(--el-text-color-placeholder);
  font-size: 16px;
}
.evolve-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 8px 0 0;
}
.eval-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.eval-detail {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.evolve-banner {
  display: flex;
  align-items: center;
  gap: 10px;
}
.empty-slot {
  color: var(--el-text-color-secondary);
  font-style: italic;
  margin: 0;
}
</style>
