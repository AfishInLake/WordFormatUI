/**
 * Electron 实现：对话框 API
 */

/**
 * 保存文件对话框
 */
export async function save(options = {}) {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke('save-dialog', options);
  }
  console.warn('[electron-shim] 非 Electron 环境');
  return null;
}

/**
 * 打开文件对话框
 */
export async function open(options = {}) {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke('open-dialog', options);
  }
  console.warn('[electron-shim] 非 Electron 环境');
  return null;
}

/**
 * 确认对话框
 */
export async function confirm(message, options = {}) {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke('confirm-dialog', message, options);
  }
  return false;
}
