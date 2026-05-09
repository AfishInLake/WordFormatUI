const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ========== 配置 ==========

const BACKEND_PORT = 8000;
const BACKEND_HOST = "127.0.0.1";
const isWindows = process.platform === "win32";

// ========== 全局变量 ==========
let backendProcess = null;
let mainWindow = null;

/**
 * 获取后端 Python 解释器路径
 *
 * 开发模式和生产模式都使用 electron/python-runtime/ 下的 venv，
 * 用户无需安装任何 Python 环境。
 */
function getPythonExe() {
  // 开发模式：electron/python-runtime/
  const devPython = isWindows
    ? path.join(__dirname, "python-runtime", "Scripts", "python.exe")
    : path.join(__dirname, "python-runtime", "bin", "python3");

  if (fs.existsSync(devPython)) {
    return devPython;
  }

  // 生产模式：resources/python-runtime/
  if (process.resourcesPath) {
    const prodPython = isWindows
      ? path.join(process.resourcesPath, "python-runtime", "Scripts", "python.exe")
      : path.join(process.resourcesPath, "python-runtime", "bin", "python3");

    if (fs.existsSync(prodPython)) {
      return prodPython;
    }
  }

  return null;
}

/**
 * 启动后端
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    if (backendProcess) {
      killBackend();
    }

    const pythonExe = getPythonExe();

    if (!pythonExe) {
      reject(new Error(
        `Python 运行时未找到！\n\n请先运行:\n  npm run build:backend\n\n这会自动创建 electron/python-runtime/`
      ));
      return;
    }

    const entryScript = path.join(__dirname, "backend_entry.py");

    if (!fs.existsSync(entryScript)) {
      reject(new Error(`入口脚本未找到: ${entryScript}`));
      return;
    }

    console.log(`[Main] 启动后端: ${pythonExe} ${entryScript} ${BACKEND_PORT}`);

    backendProcess = spawn(pythonExe, [entryScript, String(BACKEND_PORT)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
    });

    let started = false;

    backendProcess.stdout.on("data", (data) => {
      const msg = data.toString();
      console.log(`[Backend] ${msg.trim()}`);
      checkStarted(msg);
    });

    backendProcess.stderr.on("data", (data) => {
      const msg = data.toString();
      console.log(`[Backend stderr] ${msg.trim()}`);
      checkStarted(msg);
    });

    function checkStarted(msg) {
      if (!started && (
        msg.includes("Uvicorn running") || 
        msg.includes("Application startup complete") ||
        msg.includes("启动服务") ||
        msg.includes("启动API服务")
      )) {
        started = true;
        console.log("[Main] 后端服务已启动");
        resolve(true);
      }
    }

    backendProcess.on("error", (err) => {
      console.error("[Main] 后端进程启动失败:", err.message);
      reject(new Error(`无法启动后端服务: ${err.message}`));
    });

    backendProcess.on("close", (code) => {
      console.log(`[Main] 后端进程退出，退出码: ${code}`);
      backendProcess = null;
      if (!started) {
        reject(new Error(`后端服务异常退出 (code=${code})`));
      }
    });

    // 超时 30 秒
    setTimeout(() => {
      if (!started) {
        killBackend();
        reject(new Error("后端服务启动超时 (30s)"));
      }
    }, 30000);
  });
}

/**
 * 停止后端
 */
function killBackend() {
  if (backendProcess) {
    console.log("[Main] 停止后端服务...");
    try {
      backendProcess.kill("SIGTERM");
      setTimeout(() => {
        if (backendProcess) {
          try { backendProcess.kill("SIGKILL"); } catch {}
        }
      }, 3000);
      backendProcess.once("close", () => {});
    } catch (e) {
      console.error("[Main] 停止进程出错:", e.message);
    }
    backendProcess = null;
  }
}

// ========== 窗口 ==========

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "WordFormat - 论文格式自动化处理工具",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ========== IPC ==========

function registerIpcHandlers() {
  ipcMain.handle("start-exe", async () => {
    try {
      return await startBackend();
    } catch (err) {
      console.error("[IPC start-exe]", err.message);
      return false;
    }
  });

  ipcMain.handle("close-exe", async () => {
    killBackend();
    return true;
  });

  ipcMain.handle("save-dialog", async (_event, options) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options?.title || "保存文件",
      defaultPath: options?.defaultPath || "",
      filters: options?.filters || [{ name: "所有文件", extensions: ["*"] }],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle("open-dialog", async (_event, options) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options?.title || "打开文件",
      defaultPath: options?.defaultPath || "",
      filters: options?.filters || [{ name: "所有文件", extensions: ["*"] }],
      properties: options?.multiple ? ["openFile", "multiSelections"] : ["openFile"],
    });
    if (result.canceled) return null;
    return options?.multiple ? result.filePaths : result.filePaths[0];
  });

  ipcMain.handle("confirm-dialog", async (_event, message, options) => {
    if (!mainWindow) return false;
    const result = await dialog.showMessageBox(mainWindow, {
      type: options?.type || "question",
      title: options?.title || "确认",
      message,
      buttons: ["取消", "确认"],
      defaultId: 1,
      cancelId: 0,
    });
    return result.response === 1;
  });

  ipcMain.handle("read-text-file", async (_event, filePath) => {
    return fs.readFileSync(filePath, "utf-8");
  });

  ipcMain.handle("write-text-file", async (_event, filePath, content) => {
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  });
}

// ========== 生命周期 ==========

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  killBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killBackend();
});
