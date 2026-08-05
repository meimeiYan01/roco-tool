<script setup lang="ts">
import { useRouter } from 'vue-router'
import SearchBar from '@/components/SearchBar.vue'
import PokemonCard from '@/components/PokemonCard.vue'
import { getPopularForms } from '@/services/pokemonService'

const router = useRouter()
const popular = getPopularForms(6)

function onSearch(keyword: string) {
  router.push({ path: '/list', query: { q: keyword } })
}
</script>

<template>
  <div class="home">
    <section class="hero">
      <h1>🥚 大块头蛋查询与培育辅助</h1>
      <p class="subtitle">
        查精灵、看阈值、测蛋尺寸——一眼知道你这颗蛋离「大块头」还差多少。
      </p>
      <div class="search-wrap">
        <SearchBar @search="onSearch" />
      </div>
      <div class="quick-links">
        <el-button @click="router.push('/list')">浏览全部精灵</el-button>
        <el-button type="primary" @click="router.push('/check')">
          去测一颗蛋
        </el-button>
      </div>
    </section>

    <section class="intro">
      <el-alert type="info" :closable="false" show-icon>
        <template #title>什么是「大块头」？</template>
        当精灵蛋的 <b>身高</b> 与 <b>体重</b> 同时达到该物种的阈值上限（体重取前
        2%），即可获得「大块头」奖牌。单项达标不算，两项都要够才行。
      </el-alert>
    </section>

    <section class="popular">
      <div class="section-title">
        <span>🔥 热门精灵</span>
        <el-button text type="primary" @click="router.push('/list')">
          查看全部 →
        </el-button>
      </div>
      <el-row :gutter="16">
        <el-col
          v-for="p in popular"
          :key="p.form.formId"
          :xs="12"
          :sm="8"
          :md="8"
          :lg="6"
          :xl="6"
        >
          <PokemonCard :item="p" class="card-item" />
        </el-col>
      </el-row>
    </section>
  </div>
</template>

<style scoped>
.hero {
  text-align: center;
  padding: 32px 0 16px;
}
.hero h1 {
  font-size: 28px;
  margin: 0 0 8px;
}
.subtitle {
  color: var(--el-text-color-secondary);
  margin: 0 0 24px;
}
.search-wrap {
  display: flex;
  justify-content: center;
}
.quick-links {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  justify-content: center;
}
.intro {
  margin: 24px auto;
  max-width: 760px;
}
.popular {
  margin-top: 32px;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
}
.card-item {
  margin-bottom: 16px;
}
</style>
