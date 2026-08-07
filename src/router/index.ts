import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/list',
    name: 'list',
    component: () => import('@/views/PokemonList.vue'),
    meta: { title: '精灵列表' },
  },
  {
    path: '/detail/:id',
    name: 'detail',
    component: () => import('@/views/PokemonDetail.vue'),
    props: true,
    meta: { title: '精灵详情' },
  },
  {
    path: '/check',
    name: 'check',
    component: () => import('@/views/BigSizeCheck.vue'),
    meta: { title: '大块头检测' },
  },
  {
    path: '/breeding',
    name: 'breeding-list',
    component: () => import('@/views/BreedingPlanList.vue'),
    meta: { title: '培育计划' },
  },
  {
    path: '/breeding/:id',
    name: 'breeding-detail',
    component: () => import('@/views/BreedingPlanDetail.vue'),
    props: true,
    meta: { title: '培育详情' },
  },
  {
    path: '/breeding/:id/stats',
    name: 'breeding-stats',
    component: () => import('@/views/BreedingPlanStats.vue'),
    props: true,
    meta: { title: '生蛋统计' },
  },
  {
    path: '/breeding/:id/backpack',
    name: 'breeding-backpack',
    component: () => import('@/views/BreedingBackpack.vue'),
    props: true,
    meta: { title: '背包' },
  },
  {
    path: '/weight',
    name: 'weight-record',
    component: () => import('@/views/WeightRecord.vue'),
    meta: { title: '体重记录' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/Profile.vue'),
    meta: { title: '我的' },
  },
  {
    path: '/merchant',
    name: 'travel-merchant',
    component: () => import('@/views/TravelMerchant.vue'),
    meta: { title: '远行商人' },
  },
  {
    path: '/merchant/parse',
    name: 'merchant-parse',
    component: () => import('@/views/MerchantParserTest.vue'),
    meta: { title: '文本解析' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/breeding',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
