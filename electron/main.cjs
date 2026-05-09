const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ========== 内存优化 ==========
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256");

// ========== 配置 ==========
const BACKEND_PORT = 8000;
const BACKEND_HOST = "127.0.0.1";
const isWindows = process.platform === "win32";

// ========== 日志文件（生产模式看不到终端，写文件备用） ==========
const logFile = path.join(app.getPath("userData"), "backend.log");
function log(...args) {
  const msg = args.join(" ");
  console.log(msg);
  try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`); } catch {}
}

// ========== 全局变量 ==========
let backendProcess = null;
let mainWindow = null;

/**
 * 获取下载目录路径
 */
function getDownloadsDir() {
  return app.getPath("downloads");
}

/**
 * 获取后端 Python 解释器路径
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
  const extraDir = process.resourcesPath || path.join(path.dirname(app.getPath("exe")), "..", "Resources");
  const prodPython = isWindows
    ? path.join(extraDir, "python-runtime", "Scripts", "python.exe")
    : path.join(extraDir, "python-runtime", "bin", "python3");

  if (fs.existsSync(prodPython)) {
    return prodPython;
  }

  return null;
}

/**
 * 启动后端（-c 内联代码，不依赖 .py 文件，解决 ASAR 文件读取问题）
 */
function startBackend() {
  return new Promise((resolve, reject) => {
    if (backendProcess) {
      killBackend();
    }

    const pythonExe = getPythonExe();

    if (!pythonExe) {
      reject(new Error(
        `Python 运行时未找到！\n\n请先运行:\n  npm run build:backend`
      ));
      return;
    }

    // 内联 Python 代码（避免 ASAR 内文件无法被 Python 读取）
    const pythonCode = `
import os, sys, socket
os.environ["MULTIPROCESSING_RESOURCE_TRACKER"] = "0"
if len(sys.argv) >= 2 and sys.argv[-2] == "-c" and sys.argv[-1].startswith("from multiprocessing"):
    sys.exit(0)

from wordformat.api import app
from wordformat.log_config import setup_logger, setup_uvicorn_loguru
setup_logger()
setup_uvicorn_loguru()

import uvicorn
host = "${BACKEND_HOST}"
port = ${BACKEND_PORT}

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    sock.bind((host, port))
    sock.close()
except OSError:
    print(f"[Backend] Port {port} occupied", flush=True)
    os._exit(1)

print(f"[Backend] http://{host}:{port}", flush=True)
uvicorn.run(app, host=host, port=port, log_config=None, access_log=False)
`;

    log(`[Main] 启动后端: ${pythonExe} -c <python>`);

    backendProcess = spawn(pythonExe, ["-c", pythonCode], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONOPTIMIZE: "2",
        PYTHONDONTWRITEBYTECODE: "1",
        OMP_NUM_THREADS: "1",
        MKL_NUM_THREADS: "1",
        OPENBLAS_NUM_THREADS: "1",
        NUMEXPR_NUM_THREADS: "1",
        TOKENIZERS_PARALLELISM: "false",
      },
    });

    let started = false;

    backendProcess.stdout.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) log(`[Backend stdout] ${msg}`);
      checkStarted(msg);
    });

    backendProcess.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg) log(`[Backend stderr] ${msg}`);
      checkStarted(msg);
    });

    function checkStarted(msg) {
      if (!started && (
        msg.includes("Uvicorn running") ||
        msg.includes("Application startup complete") ||
        msg.includes("启动服务") ||
        msg.includes("启动API服务") ||
        msg.includes("http://")
      )) {
        started = true;
        log("[Main] 后端服务已启动");
        resolve(true);
      }
    }

    backendProcess.on("error", (err) => {
      log(`[Main] 后端进程失败: ${err.message}`);
      reject(new Error(`无法启动后端服务: ${err.message}`));
    });

    backendProcess.on("close", (code) => {
      log(`[Main] 后端退出, code=${code}`);
      backendProcess = null;
      if (!started) {
        reject(new Error(`后端服务异常退出 (code=${code})`));
      }
    });

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
    log("[Main] 停止后端服务...");
    try {
      backendProcess.kill("SIGTERM");
      setTimeout(() => {
        if (backendProcess) {
          try { backendProcess.kill("SIGKILL"); } catch {}
        }
      }, 3000);
      backendProcess.once("close", () => {});
    } catch (e) {
      log(`[Main] 停止进程出错: ${e.message}`);
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
      backgroundThrottling: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // 始终打开开发者工具
  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ========== IPC ==========

function registerIpcHandlers() {
  ipcMain.handle("start-exe", async () => {
    try {
      const ok = await startBackend();
      return { success: ok };
    } catch (err) {
      log(`[IPC start-exe] ${err.message}`);
      return { success: false, error: err.message };
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

  ipcMain.handle("save-file", async (_event, filePath, base64Data) => {
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);
    return true;
  });

  ipcMain.handle("get-download-dir", async () => {
    return getDownloadsDir();
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
