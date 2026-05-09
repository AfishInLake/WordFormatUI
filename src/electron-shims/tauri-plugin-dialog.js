/**
 * Electron shim for @tauri-apps/plugin-dialog
 *
 * 将 Tauri 的对话框 API 桥接到 Electron 原生对话框。
 */

/**
 * 保存文件对话框
 * @param {object} options
 * @param {string} options.title - 对话框标题
 * @param {string} options.defaultPath - 默认路径
 * @param {Array<{name: string, extensions: string[]}>} options.filters - 文件过滤器
 * @returns {Promise<string|null>} 选择的文件路径，取消则返回 null
 */
export async function save(options = {}) {
  if (window.electronAPI && window.electronAPI.invoke) {
    return window.electronAPI.invoke('save-dialog', options);
  }
  console.warn('[shim:tauri-plugin-dialog] 非 Electron 环境，save 不可用');
  return null;
}

/**
 * 打开文件对话框
 * @param {object} options
 * @param {string} options.title - 对话框标题
 * @param {boolean} options.multiple - 是否允许多选
 * @param {Array<{name: string, extensions: string[]}>} options.filters - 文件过滤器
 * @returns {Promise<string|string[]|null>} 选择的文件路径
 */
export async function open(options = {}) {
  if (window.electronAPI && window.electronAPI.invoke) {
    return window.electronAPI.invoke('open-dialog', options);
  }
  console.warn('[shim:tauri-plugin-dialog] 非 Electron 环境，open 不可用');
  return null;
}

/**
 * 确认对话框
 * @param {string} message - 提示信息
 * @param {object} options
 * @param {string} options.title - 标题
 * @param {string} options.type - 类型 ('warning' | 'info' | 'error' | 'question')
 * @returns {Promise<boolean>} 用户是否确认
 */
export async function confirm(message, options = {}) {
  if (window.electronAPI && window.electronAPI.invoke) {
    return window.electronAPI.invoke('confirm-dialog', message, options);
  }
  console.warn('[shim:tauri-plugin-dialog] 非 Electron 环境，confirm 不可用，默认返回 false');
  return false;
}

export default { save, open, confirm };
