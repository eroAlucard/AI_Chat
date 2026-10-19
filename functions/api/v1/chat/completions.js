// ==================== Cloudflare Pages Function — API 代理 ====================
// 前端请求同域 /api/v1/chat/completions，此函数转发到实际的 LM Studio API。
//
// 安全设计：
// 1. 目标地址只从环境变量 LM_STUDIO_URL 读取（不再接受请求头指定，杜绝开放转发滥用）
// 2. 必须携带有效登录 token（Authorization: Bearer <token>），由 AUTH_SECRET 验签
//
// 必需环境变量（Cloudflare Dashboard 或 wrangler pages secret put 设置）：
//   LM_STUDIO_URL — 目标 API 地址（如 Cloudflare Tunnel 地址）
//   AUTH_SECRET   — 与 /api/auth/login 相同的签名密钥

import { verifyToken, jsonResponse } from '../../_auth.js';

export async function onRequest(context) {
    const { request, env } = context;

    // 只允许 POST 请求
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    // ---- 认证校验 ----
    const secret = env?.AUTH_SECRET;
    if (!secret) {
        return jsonResponse({ error: '服务端未配置 AUTH_SECRET 环境变量' }, 500);
    }
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = await verifyToken(token, secret);
    if (!payload) {
        return jsonResponse({ error: '未登录或登录已过期，请重新登录' }, 401);
    }

    // ---- 目标地址：仅从环境变量读取 ----
    const targetUrl = (env?.LM_STUDIO_URL || '').replace(/\/+$/, '');
    if (!targetUrl) {
        return jsonResponse({ error: '服务端未配置 LM_STUDIO_URL 环境变量' }, 500);
    }

    // 构建目标 URL
    const targetPath = new URL(request.url).pathname.replace('/api', '');
    const targetFullUrl = targetUrl + targetPath;

    try {
        // 转发请求，只保留必要头
        const headers = new Headers();
        headers.set('Content-Type', 'application/json');
        const accept = request.headers.get('Accept');
        if (accept) headers.set('Accept', accept);

        const response = await fetch(targetFullUrl, {
            method: 'POST',
            headers: headers,
            body: request.body
        });

        // 构建响应，删除 Cloudflare Tunnel 注入的问题头
        const newHeaders = new Headers(response.headers);
        newHeaders.delete('Clear-Site-Data');
        newHeaders.delete('clear-site-data');

        // 设置 CORS 头（同域其实不需要，但保险起见）
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (err) {
        return jsonResponse({ error: 'Proxy error: ' + err.message }, 502);
    }
}

// 处理 CORS 预检请求
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
}
