/**
 * PWA 安装和更新管理
 */

let deferredPrompt = null;
let swRegistration = null;

// 注册 Service Worker
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('[PWA] Service Worker 注册成功:', swRegistration.scope);

            // 监听更新
            swRegistration.addEventListener('updatefound', () => {
                const newWorker = swRegistration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateNotification();
                    }
                });
            });
        } catch (error) {
            console.error('[PWA] Service Worker 注册失败:', error);
        }
    }
}

// 监听安装提示事件
export function initPWAInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        console.log('[PWA] 安装提示已准备');
        showInstallButton();
    });

    // 监听已安装事件
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] 应用已安装');
        deferredPrompt = null;
        hideInstallButton();
        showToast('✓ AI Chat 已添加到主屏幕');
    });
}

// 显示安装按钮
function showInstallButton() {
    // 检查是否已经安装
    if (isStandalone()) {
        return;
    }

    // 创建安装提示横幅
    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
        <div class="pwa-banner-content">
            <div class="pwa-banner-icon">✦</div>
            <div class="pwa-banner-text">
                <div class="pwa-banner-title">安装 AI Chat</div>
                <div class="pwa-banner-subtitle">获得更好的使用体验</div>
            </div>
            <button class="pwa-install-btn" id="pwaInstallBtn">安装</button>
            <button class="pwa-close-btn" id="pwaCloseBtn">✕</button>
        </div>
    `;

    document.body.appendChild(banner);

    // 绑定安装按钮
    document.getElementById('pwaInstallBtn').addEventListener('click', installPWA);
    
    // 绑定关闭按钮
    document.getElementById('pwaCloseBtn').addEventListener('click', () => {
        banner.remove();
        // 记录用户关闭，24小时内不再显示
        localStorage.setItem('pwaInstallDismissed', Date.now());
    });

    // 检查是否在24小时内关闭过
    const dismissed = localStorage.getItem('pwaInstallDismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) {
        banner.style.display = 'none';
    }
}

// 隐藏安装按钮
function hideInstallButton() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
        banner.remove();
    }
}

// 安装 PWA
async function installPWA() {
    if (!deferredPrompt) {
        showToast('⚠ 无法安装，请使用支持的浏览器');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`[PWA] 用户选择: ${outcome}`);
    
    if (outcome === 'accepted') {
        hideInstallButton();
    }
    
    deferredPrompt = null;
}

// 检查是否在独立模式运行（已安装）
function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

// 显示更新通知
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'pwa-update-notification';
    notification.innerHTML = `
        <div class="pwa-update-content">
            <span>🎉 新版本可用</span>
            <button class="pwa-update-btn" id="pwaUpdateBtn">更新</button>
        </div>
    `;

    document.body.appendChild(notification);

    document.getElementById('pwaUpdateBtn').addEventListener('click', () => {
        if (swRegistration && swRegistration.waiting) {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    });
}

// Toast 提示函数（如果全局没有，使用这个简单版本）
function showToast(message) {
    if (window.showToast) {
        window.showToast(message);
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'pwa-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: fadeInOut 2s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}
