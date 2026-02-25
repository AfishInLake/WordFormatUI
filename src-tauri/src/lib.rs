// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use flexi_logger::{Cleanup, Criterion, FileSpec, Logger, Naming};
use log::{error, info, warn};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, RunEvent, WindowEvent,  State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// 定义全局状态类型别名，方便使用
type SidecarState = Arc<Mutex<Option<CommandChild>>>;

/// 启动 sidecar 的逻辑 (内部函数)
fn start_sidecar_process(app_handle: &AppHandle) -> Result<CommandChild, String> {
    let current_exe = std::env::current_exe().map_err(|e| format!("无法获取当前exe路径: {}", e))?;
    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| "无法获取当前exe目录".to_string())?;
    info!("当前exe目录: {:?}", exe_dir);
    let sidecar_command = app_handle
        .shell()
        .sidecar("wordformat")
        .map_err(|e| format!("无法获取sidecar: {}", e))?
        .current_dir(exe_dir);
    let (_, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("无法启动sidecar: {}", e))?;
    Ok(child)
}

/// 强制清理残留进程 (Windows 兜底)
fn force_kill_process(app_handle: &AppHandle) {
    #[cfg(windows)]
    {
        info!("执行 taskkill 强制清理 wordformat.exe...");
        // 忽略错误，因为如果进程不存在，taskkill 会报错，这很正常
        let _ = app_handle
            .shell()
            .command("taskkill")
            .args(["/IM", "wordformat.exe", "/F"])
            .spawn();
    }
    #[cfg(not(windows))]
    {
        // 其他平台不需要执行
        info!("非 Windows 平台，跳过 taskkill 兜底清理。");
    }
}

/// 供前端调用的关闭命令
/// 逻辑：尝试关闭正在运行的句柄，如果句柄不存在或已退出，则执行兜底强制清理。
/// 返回：true 表示执行了清理操作（无论之前是否运行），false 表示发生严重错误（较少见）。
#[tauri::command]
async fn close_exe(state: State<'_, SidecarState>, app_handle: AppHandle) -> Result<bool, String> {
    info!("前端请求关闭 exe...");

    let mut guard = state.lock().map_err(|e| format!("锁中毒：{}", e))?;

    if let Some(child) = guard.take() {
        info!("发现运行中的句柄，尝试关闭...");
        if let Err(e) = child.kill() {
            warn!("正常关闭失败：{}, 尝试兜底清理", e);
        } else {
            info!("正常关闭成功");
            // 即使正常关闭，也建议跑一次兜底清理以防万一有僵尸进程
        }
    } else {
        info!("未发现运行中的句柄（可能未启动或已崩溃），执行兜底清理...");
    }

    // 释放锁，避免持有锁时执行 shell 命令造成死锁风险
    drop(guard);

    // 执行兜底强制清理
    force_kill_process(&app_handle);

    info!("关闭流程结束");
    Ok(true)
}

/// 🔵 供前端调用的启动命令
/// 逻辑：先确保旧进程已关闭（调用类似 close 的逻辑但不返回给前端），然后启动新进程。
#[tauri::command]
async fn start_exe(state: State<'_, SidecarState>, app_handle: AppHandle) -> Result<bool, String> {
    info!("前端请求启动 exe...");

    // 1. 先检查并清理可能存在的旧进程
    {
        let mut guard = state.lock().map_err(|e| format!("锁中毒：{}", e))?;
        if let Some(child) = guard.take() {
            info!("检测到进程已在运行，先关闭它...");
            let _ = child.kill();
            drop(guard);
            force_kill_process(&app_handle);
            // 稍微等待一下确保端口或文件锁释放 (可选，视具体 exe 行为而定)
            // std::thread::sleep(std::time::Duration::from_millis(500));
        }
    }

    // 2. 启动新进程
    match start_sidecar_process(&app_handle) {
        Ok(child) => {
            let mut guard = state.lock().map_err(|e| format!("锁中毒：{}", e))?;
            *guard = Some(child);
            info!("Sidecar 启动成功");
            Ok(true)
        }
        Err(e) => {
            error!("启动失败：{}", e);
            Err(e)
        }
    }
}

/// 检查进程是否正在运行 (可选辅助命令)
#[tauri::command]
async fn check_exe_status(state: State<'_, SidecarState>) -> Result<bool, String> {
    let guard = state.lock().unwrap();
    // 简单检查是否有句柄，更严谨的检查需要尝试 poll 进程状态
    Ok(guard.is_some())
}

pub fn run() {
    Logger::try_with_str("info")
        .expect("日志配置错误")
        .log_to_file(FileSpec::default().directory("logs").basename("app"))
        .rotate(
            Criterion::Size(5_000_000), // 5MB 分割
            Naming::Timestamps,
            Cleanup::KeepLogFiles(3), // 保留3个旧文件
        )
        .start()
        .expect("日志初始化失败");
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 初始化全局状态
            let sidecar_child: SidecarState = Arc::new(Mutex::new(None));
            app.manage(sidecar_child);

            // 注意：这里不再自动启动，由前端控制
            // 如果你希望应用启动时默认启动，可以在此处调用 start_sidecar_process
            Ok(())
        })
        // 👇 关键：注册命令，让前端可以调用
        .invoke_handler(tauri::generate_handler![
            close_exe,
            start_exe,
            check_exe_status
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            match event {
                // 当应用即将退出时（所有窗口关闭，或主进程结束）
                RunEvent::ExitRequested { .. } => {
                    info!("[兜底机制] 检测到应用退出，执行最终清理...");

                    // 即使前端已经调用过 close_exe，这里再调用一次也是安全的
                    if let Some(state) = app_handle.try_state::<SidecarState>() {
                        // 复用之前的清理逻辑
                        let mut guard: std::sync::MutexGuard<Option<CommandChild>> =
                            match state.lock() {
                                Ok(g) => g,
                                Err(_) => {
                                    error!("锁中毒");
                                    return;
                                }
                            };

                        if let Some(child) = guard.take() {
                            info!("发现残留句柄，执行 Kill");
                            let _ = child.kill();
                        }
                        drop(guard);

                        // 无论是否有句柄，都执行一次 taskkill 确保万无一失
                        force_kill_process(app_handle);
                    } else {
                        force_kill_process(app_handle);
                    }
                }
                // 处理其他事件（可选）
                RunEvent::WindowEvent {
                    label: _,
                    event: window_event,
                    ..
                } => {
                    match window_event{
                        WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        });
}
