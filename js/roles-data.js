// ==================== 角色数据（全新重写版）====================
// 所有角色现在通过 BuiltinCards 系统从 cards 目录动态加载
// 这个文件保留为空数组，仅用于初始化
const ROLES_DATA = [];

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ROLES_DATA };
}
