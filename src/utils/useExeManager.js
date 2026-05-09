import { startExe, closeExe } from '@electron/backend';

/**
 * 后端进程管理
 * @returns {{ success: boolean, error?: string }}
 */
export async function ensureStarted() {
  try {
    console.log('[ExeManager] 开始初始化进程...');
    console.log('[ExeManager] 正在清理旧进程...');
    await closeExe();

    // 等待端口释放
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[ExeManager] 正在启动新进程...');
    const result = await startExe();

    if (result && result.success) {
      console.log('[ExeManager] 进程启动成功！');
      return { success: true };
    } else {
      const errMsg = (result && result.error) || '后端返回启动失败';
      console.error('[ExeManager] 启动失败:', errMsg);
      return { success: false, error: errMsg };
    }
  } catch (error) {
    console.error('[ExeManager] 发生严重错误:', error);
    return { success: false, error: error.message || '未知错误' };
  }
}

export async function stop() {
  try {
    return await closeExe();
  } catch (e) {
    console.error('停止失败:', e);
    return false;
  }
}

export const useExeManager = () => ({
  ensureStarted,
  stop,
});
