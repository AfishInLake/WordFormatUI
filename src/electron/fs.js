/**
 * Electron 实现：文件系统 API
 */

/**
 * 写入文本文件
 */
export async function writeTextFile(filePath, content) {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke('write-text-file', filePath, content);
  }
  throw new Error('非 Electron 环境');
}

/**
 * 读取文本文件
 */
export async function readTextFile(filePath) {
  if (window.electronAPI?.invoke) {
    return window.electronAPI.invoke('read-text-file', filePath);
  }
  throw new Error('非 Electron 环境');
}
