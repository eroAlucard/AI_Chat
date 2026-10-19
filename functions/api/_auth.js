// ==================== 共享认证工具 ====================
// Cloudflare Pages Functions 内部模块（_ 前缀不会生成路由）
//
// Token 格式: base64url(JSON{u,exp}) + "." + base64url(HMAC-SHA256(payload, AUTH_SECRET))
// - u:   用户名
// - exp: 过期时间戳（毫秒）
// 前端只需解码 payload 获取用户名/过期时间，无法伪造签名。

const enc = new TextEncoder();

function b64urlEncodeBytes(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeString(str) {
    return b64urlEncodeBytes(enc.encode(str));
}

function b64urlDecodeToString(s) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

async function hmacSign(data, secret) {
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return new Uint8Array(sig);
}

/** 恒定时间字符串比较，避免时序侧信道 */
function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/**
 * 签发 token
 * @param {string} username
 * @param {string} secret - AUTH_SECRET 环境变量
 * @param {number} ttlMs - 有效期（毫秒）
 */
export async function signToken(username, secret, ttlMs) {
    const payload = JSON.stringify({ u: username, exp: Date.now() + ttlMs });
    const payloadB64 = b64urlEncodeString(payload);
    const sig = await hmacSign(payloadB64, secret);
    return payloadB64 + '.' + b64urlEncodeBytes(sig);
}

/**
 * 验证 token
 * @returns {Promise<{u: string, exp: number}|null>} 有效返回 payload，无效/过期返回 null
 */
export async function verifyToken(token, secret) {
    try {
        if (typeof token !== 'string' || !token.includes('.')) return null;
        const [payloadB64, sigB64] = token.split('.');
        if (!payloadB64 || !sigB64) return null;

        const expectedSig = b64urlEncodeBytes(await hmacSign(payloadB64, secret));
        if (!safeEqual(expectedSig, sigB64)) return null;

        const payload = JSON.parse(b64urlDecodeToString(payloadB64));
        if (!payload || typeof payload.u !== 'string' || typeof payload.exp !== 'number') return null;
        if (Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

/** 统一 JSON 响应 */
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}
