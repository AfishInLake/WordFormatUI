// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::sync::{Arc, Mutex};
use tauri::WindowEvent;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

fn start(app_handle: AppHandle) -> Result<Option<CommandChild>, String> {
    // 获取当前主程序所在目录（例如 target/debug/）
    let current_exe =
        std::env::current_exe().map_err(|e| format!("无法获取当前程序路径: {}", e))?;

    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| "无法获取程序目录".to_string())?;

    println!("🔧 设置工作目录为: {:?}", exe_dir);

    // 启动 sidecar，并设置工作目录
    let sidecar_command = app_handle
        .shell()
        .sidecar("wordformat")
        .map_err(|e| format!("创建 sidecar 命令失败: {}", e))?
        .current_dir(exe_dir); // 👈 关键：设置正确工作目录

    let (_, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("启动 sidecar 失败: {}", e))?;

    Ok(Some(child))
}

fn stop(sidecar_child: State<Arc<Mutex<Option<CommandChild>>>>, app_handle: AppHandle) -> bool {
    if let Some(child) = sidecar_child.lock().unwrap().take() {
        println!("准备关闭 wordformat.exe 进程");
        let _ = child.kill(); // 忽略结果，继续强制清理
    }

    // 👇 Windows 下兜底：强制结束所有 wordformat.exe
    #[cfg(windows)]
    {
        println!("执行 taskkill 强制清理...");
        let _ = app_handle
            .shell()
            .command("taskkill")
            .args(["/IM", "wordformat.exe", "/F"])
            .spawn();
    }

    println!("关闭成功");
    true
}
fn close_all_windows(app_handle: AppHandle) {
    let windows = app_handle.webview_windows();
    for (_, window) in windows {
        println!("关闭窗口");
        if let Err(e) = window.close() {
            println!("{:#?}", e)
        }
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let sidecar_child = Arc::new(Mutex::new(None)); // 用于存储 CommandChild 对象
            app.manage(sidecar_child.clone()); // 将 sidecar_child 存储在全局状态中
            let app_handle = app.handle().clone();
            match start(app_handle) {
                Ok(child_opt) => {
                    // 存储子进程句柄
                    println!("✅ Sidecar started successfully");
                    *sidecar_child.lock().unwrap() = child_opt;
                }
                Err(e) => {
                    eprintln!("❌ Failed to start sidecar: {}", e);
                    print!("{}", e)
                }
            }
            Ok(())
        })
        .on_window_event(move |window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                println!("触发close事件");
                // 获取 Sidecar 进程句柄
                let sidecar_child = window.state::<Arc<Mutex<Option<CommandChild>>>>();
                let _ = stop(sidecar_child, window.app_handle().clone());
                let app_handle = window.app_handle();
                close_all_windows(app_handle.clone());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
