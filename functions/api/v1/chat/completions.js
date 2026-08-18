// Cloudflare Pages Function — API 代理
// 解决 Cloudflare Tunnel 注入 Clear-Site-Data 头导致浏览器拒绝响应的问题
// 前端请求同域 /api/v1/chat/completions，此函数转发到实际的 LM Studio API

// 从环境变量读取目标 API 地址（wrangler.toml 或 Cloudflare Dashboard 设置）
// 默认值可在下方 TARGET_URL 修改
const TARGET_URL = ''; // 留空则从请求头 X-Target-URL 读取

export async function onRequest(context) {
    const { request, env } = context;

    // 只允许 POST 请求
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 获取目标 API 地址：优先环境变量，其次请求头，最后拒绝
    let targetUrl = env?.LM_STUDIO_URL || TARGET_URL;
    if (!targetUrl) {
        // 从请求自定义头读取（前端设置）
        targetUrl = request.headers.get('X-Target-URL');
    }
    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'No target API URL configured. Set LM_STUDIO_URL env var or X-Target-URL header.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 去掉末尾斜杠
    targetUrl = targetUrl.replace(/\/+$/, '');

    // 构建目标 URL
    const targetPath = new URL(request.url).pathname.replace('/api', '');
    const targetFullUrl = targetUrl + targetPath;

    try {
        // 转发请求，删除自定义头
        const headers = new Headers(request.headers);
        headers.delete('X-Target-URL');
        headers.delete('host');
        headers.delete('origin');
        headers.delete('referer');
        headers.set('Content-Type', 'application/json');

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
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, X-Target-URL');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 处理 CORS 预检请求
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Target-URL',
            'Access-Control-Max-Age': '86400'
        }
    });
}
