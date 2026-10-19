/**
 * chat-store.js — 聊天记录等状态数据的 IndexedDB 存储
 *
 * 用途：localStorage 有 5-10MB 配额限制，长期聊天记录容易触顶导致保存失败，
 * 改为存入 IndexedDB（容量上限通常为磁盘可用空间的一定比例，远大于 localStorage）。
 *
 * API：
 *   ChatStore.save(key, data)      — 保存（data 为可结构化克隆的对象；失败时回退 JSON 字符串）
 *   ChatStore.load(key)            — 加载（返回对象或 null）
 *   ChatStore.remove(key)          — 删除
 *   ChatStore.estimateSize(data)   — 估算数据字节大小（用于存储统计展示）
 */
const ChatStore = (function() {
    const DB_NAME = 'AIChatDataStore';
    const STORE_NAME = 'state';
    const DB_VERSION = 1;
    let _db = null;

    /**
     * 打开/创建 IndexedDB
     */
    function openDB() {
        if (_db) return Promise.resolve(_db);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
            request.onsuccess = (e) => {
                _db = e.target.result;
                resolve(_db);
            };
            request.onerror = (e) => {
                console.error('[ChatStore] IndexedDB 打开失败:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    /**
     * 保存数据
     * 优先结构化克隆（高效、免序列化）；若数据含不可克隆属性则回退 JSON 字符串存储
     */
    async function save(key, data) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put({ key: String(key), data });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            } catch (e) {
                // DataCloneError 等：回退为 JSON 字符串
                try {
                    const tx2 = db.transaction(STORE_NAME, 'readwrite');
                    tx2.objectStore(STORE_NAME).put({ key: String(key), json: JSON.stringify(data) });
                    tx2.oncomplete = () => resolve();
                    tx2.onerror = () => reject(tx2.error);
                    tx2.onabort = () => reject(tx2.error);
                } catch (e2) {
                    console.error('[ChatStore] 保存失败:', e2);
                    reject(e2);
                }
            }
        });
    }

    /**
     * 加载数据
     * @returns {Promise<object|null>}
     */
    async function load(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(String(key));
            request.onsuccess = () => {
                const rec = request.result;
                if (!rec) return resolve(null);
                if (rec.json !== undefined) {
                    try { resolve(JSON.parse(rec.json)); }
                    catch (e) { console.error('[ChatStore] JSON 解析失败:', e); resolve(null); }
                } else {
                    resolve(rec.data || null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 删除数据
     */
    async function remove(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(String(key));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 估算数据大小（字节）
     */
    function estimateSize(data) {
        try {
            return new Blob([JSON.stringify(data)]).size;
        } catch (e) {
            return 0;
        }
    }

    return { save, load, remove, estimateSize };
})();
