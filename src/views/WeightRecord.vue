<script setup lang="ts">
import { ref, computed } from 'vue'
import { getAllWeightRecords, addWeightRecord, deleteWeightRecord } from '../services/breedingService'
import { getFormName, getFamilyById, getAllFamilies } from '../services/pokemonService'
import type { FamilyWeightRecord } from '../types'
import PageHeader from '../components/PageHeader.vue'
import PokemonAvatar from '../components/PokemonAvatar.vue'

const searchKeyword = ref('')
const searchResults = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return []
  return getAllFamilies().filter(f =>
    f.familyName.toLowerCase().includes(kw) ||
    f.forms.some(fm => fm.name.toLowerCase().includes(kw)) ||
    f.types.some(t => t.toLowerCase().includes(kw))
  )
})

const selectedFamilyId = ref<number | null>(null)
const selectedFamily = computed(() => selectedFamilyId.value ? getFamilyById(selectedFamilyId.value) : undefined)

const familyRecords = computed<FamilyWeightRecord[]>(() => {
  if (!selectedFamilyId.value) return []
  return getAllWeightRecords().filter(r => r.familyId === selectedFamilyId.value)
})

const individualNames = computed(() => {
  const seen = new Map<string, string>()
  for (const r of familyRecords.value) {
    if (!seen.has(r.individualName)) seen.set(r.individualName, r.recordedAt)
  }
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([name]) => name)
})

const cellMap = computed(() => {
  const map: Record<string, FamilyWeightRecord> = {}
  for (const r of familyRecords.value) {
    const key = `${r.individualName}|${r.formId}`
    if (!map[key] || r.recordedAt > map[key].recordedAt) map[key] = r
  }
  return map
})

function getCell(name: string, formId: number) {
  return cellMap.value[`${name}|${formId}`]
}

const sortFormId = ref<number | null>(null)
const sortAsc = ref(false)

function getLatestWeight(name: string): number {
  const records = familyRecords.value.filter(r => r.individualName === name)
  if (records.length === 0) return 0
  return records.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0].weight
}

const sortedIndividualNames = computed(() => {
  const names = [...individualNames.value]
  return names.sort((a, b) => {
    let wA: number, wB: number
    if (sortFormId.value !== null) {
      wA = getCell(a, sortFormId.value)?.weight ?? 0
      wB = getCell(b, sortFormId.value)?.weight ?? 0
    } else {
      wA = getLatestWeight(a)
      wB = getLatestWeight(b)
    }
    return sortAsc.value ? wA - wB : wB - wA
  })
})

function onSortByLatest() {
  if (sortFormId.value === null) sortAsc.value = !sortAsc.value
  else { sortFormId.value = null; sortAsc.value = false }
}

function onSortByForm(formId: number) {
  if (sortFormId.value === formId) sortAsc.value = !sortAsc.value
  else { sortFormId.value = formId; sortAsc.value = false }
}

function sortIndicator(formId: number | null): string {
  if (sortFormId.value !== formId) return ''
  return sortAsc.value ? ' ▲' : ' ▼'
}

const recordFormVisible = ref(false)
const recordForm = ref({ individualName: '', formId: 0, weight: 0, source: '' })

function openRecordForm(individualName: string, formId: number) {
  recordForm.value = { individualName, formId, weight: 0, source: '' }
  recordFormVisible.value = true
}

function onSaveRecord() {
  if (!selectedFamilyId.value || recordForm.value.weight <= 0) return
  addWeightRecord({
    familyId: selectedFamilyId.value,
    formId: recordForm.value.formId,
    individualName: recordForm.value.individualName,
    weight: recordForm.value.weight,
    source: recordForm.value.source || undefined,
  })
  recordFormVisible.value = false
}

const addIndividualVisible = ref(false)
const newIndividualName = ref('')

function openAddIndividual() {
  newIndividualName.value = ''
  addIndividualVisible.value = true
}

function onAddIndividual() {
  const name = newIndividualName.value.trim()
  if (!name) return
  addIndividualVisible.value = false
  const firstForm = selectedFamily.value?.forms[0]
  if (firstForm) openRecordForm(name, firstForm.formId)
}

function selectFamily(id: number) {
  selectedFamilyId.value = id
  searchKeyword.value = ''
}

function formName(formId: number) {
  return getFormName(formId) || '#' + formId
}

function stageLabel(formId: number): string {
  if (!selectedFamily.value) return ''
  const form = selectedFamily.value.forms.find(f => f.formId === formId)
  return form ? '阶段' + form.stage : ''
}
</script>

<template>
  <div>
    <PageHeader title="体重记录" :back="true" />

    <div class="px-4 py-3">
      <input v-model="searchKeyword" type="text" class="input-field" placeholder="搜索精灵家族名称或系别..." />
    </div>

    <div v-if="searchKeyword && !selectedFamilyId" class="px-4 space-y-2 pb-4">
      <div v-if="searchResults.length === 0" class="text-center py-8 text-pink-400 text-sm">未找到匹配家族</div>
      <div
        v-for="f in searchResults" :key="f.familyId"
        class="card flex items-center gap-3 cursor-pointer active:bg-pink-100"
        @click="selectFamily(f.familyId)"
      >
        <PokemonAvatar :name="f.forms[0]?.name" :size="40" />
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-pink-900">{{ f.familyName }}</div>
          <div class="text-xs text-pink-400">{{ f.types.join(' ') }} {{ f.forms.length }}个形态</div>
        </div>
      </div>
    </div>

    <div v-if="selectedFamily" class="px-4 pb-4">
      <button @click="selectedFamilyId = null; searchKeyword = ''" class="text-xs text-pink-500 mb-3">返回搜索</button>

      <div class="card flex items-center gap-3 mb-4">
        <PokemonAvatar :name="selectedFamily.forms[0]?.name" :size="48" />
        <div>
          <div class="font-semibold text-pink-900">{{ selectedFamily.familyName }}</div>
          <div class="text-xs text-pink-400">{{ selectedFamily.types.join(' ') }} {{ selectedFamily.rarity }}</div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-pink-200">
              <th class="text-left py-2 px-2 text-pink-400 font-medium sticky left-0 bg-rose-50 cursor-pointer select-none" @click="onSortByLatest">
                个体{{ sortIndicator(null) }}
              </th>
              <th v-for="form in selectedFamily.forms" :key="form.formId" class="text-center py-2 px-2 text-pink-400 font-medium min-w-[80px] cursor-pointer select-none" @click="onSortByForm(form.formId)">
                <div>{{ form.name }}{{ sortIndicator(form.formId) }}</div>
                <div class="text-[10px] text-pink-400">阶段{{ form.stage }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="name in sortedIndividualNames" :key="name" class="border-b border-pink-100">
              <td class="py-2 px-2 text-pink-800 font-medium sticky left-0 bg-rose-50">{{ name }}</td>
              <td v-for="form in selectedFamily.forms" :key="form.formId" class="text-center py-2 px-2 cursor-pointer active:bg-pink-100 transition-colors" @click="openRecordForm(name, form.formId)">
                <span v-if="getCell(name, form.formId)" class="text-pink-900 font-medium">{{ getCell(name, form.formId)!.weight }}kg</span>
                <span v-else class="text-pink-300">-</span>
              </td>
            </tr>
            <tr v-if="sortedIndividualNames.length === 0">
              <td :colspan="selectedFamily.forms.length + 1" class="text-center py-8 text-pink-400 text-sm">暂无记录，点击下方添加个体开始</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button @click="openAddIndividual" class="btn btn-secondary w-full mt-3 text-sm">+ 添加个体</button>
    </div>

    <el-dialog v-model="recordFormVisible" title="记录体重" width="90%" :close-on-click-modal="false">
      <div class="space-y-4">
        <div class="text-sm text-pink-400">
          <span class="text-pink-800 font-medium">{{ recordForm.individualName }}</span>
          {{ formName(recordForm.formId) }}（{{ stageLabel(recordForm.formId) }}）
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-pink-400 mb-1.5 block">体重 (kg) *</label>
            <input v-model.number="recordForm.weight" type="number" step="0.1" min="0" class="input-field" autofocus />
          </div>
          <div>
            <label class="text-sm text-pink-400 mb-1.5 block">来源</label>
            <input v-model="recordForm.source" class="input-field" placeholder="可选" />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="recordFormVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onSaveRecord" :disabled="recordForm.weight <= 0">保存</button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="addIndividualVisible" title="添加个体" width="90%" :close-on-click-modal="false">
      <div>
        <label class="text-sm text-pink-400 mb-1.5 block">个体名称</label>
        <input v-model="newIndividualName" class="input-field" placeholder="如：个体A" autofocus />
      </div>
      <template #footer>
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="addIndividualVisible = false">取消</button>
          <button class="btn btn-primary flex-1" @click="onAddIndividual" :disabled="!newIndividualName.trim()">确定</button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
