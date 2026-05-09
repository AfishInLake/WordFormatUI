const { contextBridge, ipcRenderer } = require('electron');

/**
 * Electron preload 脚本
 *
 * 通过 contextBridge 暴露 electronAPI 给渲染进程。
 * 前端的 shim 模块会调用 window.electronAPI 来桥接原 Tauri API。
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 通用 IPC 调用
   * @param {string} channel - IPC 通道名
   * @param  {...any} args - 参数
   */
  invoke(channel, ...args) {
    // 允许的 IPC 通道白名单
    const allowedChannels = [
      'start-exe',
      'close-exe',
      'save-dialog',
      'open-dialog',
      'confirm-dialog',
      'read-text-file',
      'write-text-file',
      'save-file',
      'get-download-dir',
    ];

    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }

    return Promise.reject(new Error(`不允许的 IPC 通道: ${channel}`));
  },
});
