import {invoke} from '@tauri-apps/api/core'; // Tauri v2

export function useExeManager() {

    /**
     * 核心逻辑：先关闭（清理残留），再启动
     * @returns {Promise<boolean>} 启动是否成功
     */
    async function ensureStarted() {
        try {
            console.log('[ExeManager] 开始初始化进程...');

            // 1. 强制关闭可能存在的错误进程/残留进程
            // 即使之前没启动，close_exe 也会返回 true (兜底清理)，所以不用判断返回值
            console.log('[ExeManager] 正在清理旧进程...');
            await invoke('close_exe');

            // 2. 稍微等待一下，确保端口/文件锁释放 (视你的 exe 特性而定，通常 200-500ms)
            await new Promise(resolve => setTimeout(resolve, 300));

            // 3. 启动新进程
            console.log('[ExeManager] 正在启动新进程...');
            const success = await invoke('start_exe');

            if (success) {
                console.log('[ExeManager] 进程启动成功！');
                return true;
            } else {
                console.error('[ExeManager] 启动返回 false');
                return false;
            }

        } catch (error) {
            console.error('[ExeManager] 发生严重错误:', error);
            // 这里可以触发一个全局事件通知用户，或者设置一个 error 状态
            return false;
        }
    }

    async function stop() {
        try {
            return await invoke('close_exe');
        } catch (e) {
            console.error('停止失败:', e);
            return false;
        }
    }

    return {
        ensureStarted,
        stop
    };
}