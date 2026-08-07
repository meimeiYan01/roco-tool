export interface GoodsItem {
  id: number
  name: string
  image: string
  price: number
}

/** 商品基础数据库 */
export const goodsData: GoodsItem[] = [
  { id: 1, name: '能力钥匙', image: '/roco-tool/能力钥匙.png', price: 500 },
  { id: 2, name: '适格钥匙', image: '/roco-tool/适格钥匙.png', price: 1200 },
  { id: 3, name: '龙系血脉密钥', image: '/roco-tool/龙系血脉密钥.png', price: 800 },
  { id: 4, name: '紫莲刚玉', image: '/roco-tool/紫莲刚玉.png', price: 1500 },
  { id: 5, name: '残缺魔镜', image: '/roco-tool/残缺魔镜.png', price: 300 },
  { id: 6, name: '调温球', image: '/roco-tool/调温球.png', price: 2000 },
]

/** 根据商品名查找商品信息 */
export function getGoodsByName(name: string): GoodsItem | undefined {
  return goodsData.find(g => g.name === name)
}
