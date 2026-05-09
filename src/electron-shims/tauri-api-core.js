/**
 * Electron shim for @tauri-apps/api/core
 *
 * 将 Tauri 的 invoke 调用桥接到 Electron IPC。
 * 前端 useExeManager.js 中的 invoke('start_exe') / invoke('close_exe')
 * 会通过此 shim 转发到 Electron main process。
 */

/**
 * 调用后端命令（兼容 Tauri invoke API）
 * @param {string} cmd - 命令名 (如 'start_exe', 'close_exe')
 * @param {object} [args] - 参数（此项目暂不需要）
 * @returns {Promise<any>}
 */
export async function invoke(cmd, args) {
  // 检查是否在 Electron 环境中
  if (window.electronAPI && window.electronAPI.invoke) {
    // 将 Tauri 风格的下划线命名转为 Electron IPC 的连字符命名
    // start_exe → start-exe, close_exe → close-exe
    const ipcChannel = cmd.replace(/_/g, '-');
    return window.electronAPI.invoke(ipcChannel, args);
  }

  // 降级处理：浏览器开发模式
  console.warn('[shim:tauri-api-core] 非 Electron 环境，invoke 不可用');
  return false;
}

export default { invoke };
