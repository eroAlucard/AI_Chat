// ==================== 临时诊断端点（排查完成后删除） =====================
// GET /api/auth/check
// 返回 Function 运行时实际可见的环境变量【名称】清单（不返回任何变量值），
// 用于排查「服务端未配置 AUTH_SECRET / AUTH_ACCOUNTS」问题：
//   - hasAuthSecret / hasAuthAccounts / hasLmStudioUrl: 三个关键变量是否已绑定
//   - authAccountsUsernames: AUTH_ACCOUNTS 中配置的用户名列表（用于检查大小写/拼写，不含密码）

import { jsonResponse } from '../_auth.js';

export async function onRequest(context) {
    const env = context.env || {};

    let accountsInfo = { valid: false, usernames: [] };
    if (typeof env.AUTH_ACCOUNTS === 'string' && env.AUTH_ACCOUNTS.trim()) {
        try {
            const parsed = JSON.parse(env.AUTH_ACCOUNTS);
            accountsInfo = { valid: true, usernames: Object.keys(parsed) };
        } catch {
            accountsInfo = { valid: false, error: 'AUTH_ACCOUNTS 不是合法 JSON' };
        }
    }

    return jsonResponse({
        ok: true,
        note: '临时诊断端点，仅返回变量名不返回值',
        envNames: Object.keys(env).sort(),
        hasAuthSecret: typeof env.AUTH_SECRET === 'string' && env.AUTH_SECRET.length > 0,
        hasAuthAccounts: typeof env.AUTH_ACCOUNTS === 'string' && env.AUTH_ACCOUNTS.length > 0,
        hasLmStudioUrl: typeof env.LM_STUDIO_URL === 'string' && env.LM_STUDIO_URL.length > 0,
        authAccounts: accountsInfo,
    });
}
