/**
 * Electron shim for @tauri-apps/plugin-fs
 *
 * 将 Tauri 的文件系统 API 桥接到 Electron IPC → Node.js fs。
 */

/**
 * 写入文本文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @returns {Promise<void>}
 */
export async function writeTextFile(filePath, content) {
  if (window.electronAPI && window.electronAPI.invoke) {
    return window.electronAPI.invoke('write-text-file', filePath, content);
  }
  console.warn('[shim:tauri-plugin-fs] 非 Electron 环境，writeTextFile 不可用');
  throw new Error('非 Electron 环境，无法执行文件写入操作');
}

/**
 * 读取文本文件
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} 文件内容
 */
export async function readTextFile(filePath) {
  if (window.electronAPI && window.electronAPI.invoke) {
    return window.electronAPI.invoke('read-text-file', filePath);
  }
  console.warn('[shim:tauri-plugin-fs] 非 Electron 环境，readTextFile 不可用');
  throw new Error('非 Electron 环境，无法执行文件读取操作');
}

export default { writeTextFile, readTextFile };
