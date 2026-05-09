/**
 * Electron 实现：进程管理 API
 */

/**
 * 启动后端服务
 */
export async function startExe() {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke('start-exe');
  }
  return false;
}

/**
 * 停止后端服务
 */
export async function closeExe() {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke('close-exe');
  }
  return false;
}
