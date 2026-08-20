/**
 * image-store.js — 自定义角色图片 IndexedDB 存储
 * 
 * 用途：自定义角色导入时，base64 图片不存 localStorage（5MB 限制），
 * 改为存 IndexedDB（无大小限制）。
 * 
 * API：
 *   ImageStore.save(roleId, base64DataUrl) — 保存图片
 *   ImageStore.load(roleId) — 加载图片（返回 base64 data URL 或 null）
 *   ImageStore.remove(roleId) — 删除图片
 *   ImageStore.clear() — 清空所有图片
 *   ImageStore.applyImages(container) — 异步为容器中的角色卡片填充图片
 */
const ImageStore = (function() {
    const DB_NAME = 'AIChatImageStore';
    const STORE_NAME = 'images';
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
                    db.createObjectStore(STORE_NAME, { keyPath: 'roleId' });
                }
            };
            request.onsuccess = (e) => {
                _db = e.target.result;
                resolve(_db);
            };
            request.onerror = (e) => {
                console.error('[ImageStore] IndexedDB 打开失败:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    /**
     * 保存图片到 IndexedDB
     * @param {string|number} roleId - 角色 ID
     * @param {string} base64DataUrl - base64 data URL
     */
    async function save(roleId, base64DataUrl) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ roleId: String(roleId), data: base64DataUrl });
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => {
                    console.error('[ImageStore] 保存失败:', e.target.error);
                    reject(e.target.error);
                };
            });
        } catch (err) {
            console.error('[ImageStore] save 异常:', err);
        }
    }

    /**
     * 从 IndexedDB 加载图片
     * @param {string|number} roleId - 角色 ID
     * @returns {Promise<string|null>} base64 data URL 或 null
     */
    async function load(roleId) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(String(roleId));
                request.onsuccess = () => {
                    resolve(request.result ? request.result.data : null);
                };
                request.onerror = (e) => {
                    console.error('[ImageStore] 加载失败:', e.target.error);
                    resolve(null);
                };
            });
        } catch (err) {
            console.error('[ImageStore] load 异常:', err);
            return null;
        }
    }

    /**
     * 删除角色图片
     * @param {string|number} roleId - 角色 ID
     */
    async function remove(roleId) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(String(roleId));
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (err) {
            console.error('[ImageStore] remove 异常:', err);
        }
    }

    /**
     * 清空所有图片
     */
    async function clear() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.clear();
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => reject(e.target.error);
            });
        } catch (err) {
            console.error('[ImageStore] clear 异常:', err);
        }
    }

    /**
     * 为容器中的角色卡片异步填充 IndexedDB 中的图片
     * 同时更新 ROLES_DATA 中对应角色的 image 字段
     * 支持 .role-card 和 .custom-role-card 两种卡片格式
     * @param {HTMLElement} container - 包含角色卡片的容器
     */
    async function applyImages(container) {
        if (!container) return;
        // 同时查找 .role-card 和 .custom-role-card
        const cards = container.querySelectorAll('[data-role-id]');
        for (const card of cards) {
            const roleId = card.getAttribute('data-role-id');
            if (!roleId) continue;
            // 查找卡片中的 <img> 元素
            const img = card.querySelector('img');
            if (!img) continue;
            // 如果图片已有有效 src 且加载成功，跳过
            if (img.src && img.src !== '' && !img.src.endsWith('/') && img.naturalWidth > 0) continue;
            // 从 IndexedDB 加载
            const data = await load(roleId);
            if (data) {
                img.src = data;
                img.style.display = '';
                // 隐藏占位符
                const placeholder = img.nextElementSibling;
                if (placeholder && placeholder.classList.contains('role-card-cover-placeholder')) {
                    placeholder.style.display = 'none';
                }
                // 同步更新 ROLES_DATA 中对应角色的 image 字段
                if (typeof ROLES_DATA !== 'undefined') {
                    const role = ROLES_DATA.find(r => r && String(r.id) === String(roleId));
                    if (role && !role.image) {
                        role.image = data;
                    }
                }
            }
        }
    }

    return { save, load, remove, clear, applyImages };
})();
