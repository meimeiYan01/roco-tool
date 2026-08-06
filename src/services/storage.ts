/**
 * IndexedDB 持久化层
 *
 * 数据库：roco-breeding-db v1
 * 对象存储：8 个业务表 + 1 个元数据表（自增计数器）
 *
 * 设计原则：
 * - 只做存储，不包含业务逻辑
 * - 所有操作返回 Promise
 * - 提供 initStore() 供 breedingService 启动时调用
 */

const DB_NAME = 'roco-breeding-db'
const DB_VERSION = 1

/** 8 个业务对象存储的名称 */
export const STORES = {
  plans: 'plans',
  tasks: 'tasks',
  groups: 'groups',
  individuals: 'individuals',
  eggRecords: 'eggRecords',
  replacementRecords: 'replacementRecords',
  growthRecords: 'growthRecords',
  parentPools: 'parentPools',
  meta: 'meta',
} as const

let dbInstance: IDBDatabase | null = null

/** 打开数据库（仅首次调用会创建 schema） */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      // 8 个业务表 — keyPath = 各实体的自然主键
      if (!db.objectStoreNames.contains(STORES.plans))
        db.createObjectStore(STORES.plans, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.tasks))
        db.createObjectStore(STORES.tasks, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.groups))
        db.createObjectStore(STORES.groups, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.individuals))
        db.createObjectStore(STORES.individuals, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.eggRecords))
        db.createObjectStore(STORES.eggRecords, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.replacementRecords))
        db.createObjectStore(STORES.replacementRecords, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.growthRecords))
        db.createObjectStore(STORES.growthRecords, { keyPath: 'individualId' })
      if (!db.objectStoreNames.contains(STORES.parentPools))
        db.createObjectStore(STORES.parentPools, { keyPath: 'planId' })
      // 元数据表 — 存自增计数器等
      if (!db.objectStoreNames.contains(STORES.meta))
        db.createObjectStore(STORES.meta, { keyPath: 'key' })
    }

    req.onsuccess = () => {
      dbInstance = req.result
      resolve(dbInstance)
    }
    req.onerror = () => reject(req.error)
  })
}

// ── 通用 CRUD ──

/** 读取对象存储的全部记录 */
export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

/** 覆盖写入整个数组（先清空再批量 put） */
export async function putAll<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    store.clear()
    for (const item of items) {
      store.put(item)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── 元数据（自增计数器）──

export interface StoreMeta {
  key: string
  value: number
}

/** 读取全部计数器 */
export async function getAllMeta(): Promise<Record<string, number>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.meta, 'readonly')
    const store = tx.objectStore(STORES.meta)
    const req = store.getAll()
    req.onsuccess = () => {
      const result: Record<string, number> = {}
      for (const item of req.result as StoreMeta[]) {
        result[item.key] = item.value
      }
      resolve(result)
    }
    req.onerror = () => reject(req.error)
  })
}

/** 保存全部计数器 */
export async function putAllMeta(meta: Record<string, number>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.meta, 'readwrite')
    const store = tx.objectStore(STORES.meta)
    store.clear()
    for (const [key, value] of Object.entries(meta)) {
      store.put({ key, value })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── 批量保存全部业务数据 ──

export interface StoreSnapshot {
  plans: unknown[]
  tasks: unknown[]
  groups: unknown[]
  individuals: unknown[]
  eggRecords: unknown[]
  replacementRecords: unknown[]
  growthRecords: unknown[]
  parentPools: unknown[]
  meta: Record<string, number>
}

/** 一次性保存全部 8 张表 + 元数据（单个事务，原子性） */
export async function saveSnapshot(snapshot: StoreSnapshot): Promise<void> {
  const db = await openDB()
  const storeNames = Object.values(STORES)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite')

    tx.onerror = () => {
      console.error('[storage] saveSnapshot transaction error:', tx.error)
      reject(tx.error)
    }
    tx.onabort = () => {
      console.error('[storage] saveSnapshot transaction aborted:', tx.error)
      reject(tx.error)
    }

    // 8 个业务表（排除 meta）
    for (const name of storeNames) {
      if (name === STORES.meta) continue
      const store = tx.objectStore(name)
      store.clear()
      const items = (snapshot as Record<string, unknown[]>)[name]
      if (Array.isArray(items)) {
        for (const item of items) {
          store.put(item)
        }
      }
    }

    // 元数据
    const metaStore = tx.objectStore(STORES.meta)
    metaStore.clear()
    for (const [key, value] of Object.entries(snapshot.meta)) {
      metaStore.put({ key, value })
    }

    tx.oncomplete = () => resolve()
  })
}

// ── 检查是否有数据 ──

export async function hasData(): Promise<boolean> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.plans, 'readonly')
    const store = tx.objectStore(STORES.plans)
    const req = store.count()
    req.onsuccess = () => {
      console.log('[storage] hasData: plans count =', req.result)
      resolve(req.result > 0)
    }
    req.onerror = () => reject(req.error)
  })
}

// ── 清除全部数据（调试/重置用）──

export async function clearAll(): Promise<void> {
  const db = await openDB()
  const storeNames = [...Object.values(STORES)]
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite')
    for (const name of storeNames) {
      tx.objectStore(name).clear()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
