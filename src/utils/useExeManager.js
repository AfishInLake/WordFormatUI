import { startExe, closeExe } from '@electron/backend';

/**
 * 后端进程管理
 */
export async function ensureStarted() {
  try {
    console.log('[ExeManager] 开始初始化进程...');

    // 1. 清理旧进程
    console.log('[ExeManager] 正在清理旧进程...');
    await closeExe();

    // 2. 等待端口释放
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. 启动新进程
    console.log('[ExeManager] 正在启动新进程...');
    const success = await startExe();

    if (success) {
      console.log('[ExeManager] 进程启动成功！');
      return true;
    } else {
      console.error('[ExeManager] 启动返回 false');
      return false;
    }
  } catch (error) {
    console.error('[ExeManager] 发生严重错误:', error);
    return false;
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
