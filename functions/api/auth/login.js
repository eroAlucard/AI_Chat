// ==================== 登录接口 ====================
// POST /api/auth/login  { username, password }
//
// 依赖环境变量（Cloudflare Dashboard 或 wrangler pages secret put 设置）：
//   AUTH_ACCOUNTS — JSON 字符串，如 {"eroalucard":"xxx","hanhan":"yyy"}
//   AUTH_SECRET   — 随机字符串，用于 HMAC 签名 token
//
// 成功返回 { ok: true, token, username, expiresAt }

import { signToken, jsonResponse } from '../_auth.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export async function onRequestPost(context) {
    const { request, env } = context;

    const secret = env?.AUTH_SECRET;
    const accountsJson = env?.AUTH_ACCOUNTS;
    const missing = [];
    if (!secret) missing.push('AUTH_SECRET');
    if (!accountsJson) missing.push('AUTH_ACCOUNTS');
    if (missing.length) {
        return jsonResponse({
            error: `服务端缺少环境变量: ${missing.join('、')}（Cloudflare → Settings → Variables and Secrets → Production 配置后需重新部署）`
        }, 500);
    }

    let accounts;
    try {
        accounts = JSON.parse(accountsJson);
    } catch {
        return jsonResponse({ error: 'AUTH_ACCOUNTS 环境变量不是合法 JSON' }, 500);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: '请求体不是合法 JSON' }, 400);
    }

    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!username || !password) {
        return jsonResponse({ error: '用户名或密码错误' }, 401);
    }

    // 账号不存在与密码错误返回相同信息，避免用户名枚举
    if (!(username in accounts) || accounts[username] !== password) {
        return jsonResponse({ error: '用户名或密码错误' }, 401);
    }

    const token = await signToken(username, secret, TOKEN_TTL_MS);
    return jsonResponse({
        ok: true,
        token,
        username,
        expiresAt: Date.now() + TOKEN_TTL_MS
    });
}

// 非 POST 请求
export async function onRequest() {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
