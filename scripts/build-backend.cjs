/**
 * 构建可移植 Python 运行时
 *
 * 替代 PyInstaller：原生 Python 解释器，无 fork 线程泄漏问题。
 *
 * 版本来源（按优先级）：
 *   1. 命令行: node scripts/build-backend.cjs --ver v1.1.3
 *   2. 文件:   读取 .backend-version
 *   3. 默认:   从 PyPI 安装最新版
 *
 * 版本格式：
 *   v1.1.3              → PyPI: pip install wordformat[api]==1.1.3
 *   github:v1.1.3       → GitHub: pip install git+https://github.com/AfishInLake/WordFormat.git@v1.1.3#egg=wordformat[api]
 *   pypi:1.1.3          → PyPI 显式写法
 *   latest              → PyPI 最新版
 *
 * 流程：
 *   1. 创建 venv（--copies 模式，复制而非符号链接）
 *   2. pip install wordformat[api]@指定版本
 *   3. 输出到 electron/python-runtime/
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ===== 参数解析 =====
const args = process.argv.slice(2);
let versionSpec = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ver" || args[i] === "--version") {
    versionSpec = args[i + 1];
    i++;
  }
}

// 从 .backend-version 读取默认版本
if (!versionSpec) {
  const versionFile = path.join(__dirname, "..", ".backend-version");
  if (fs.existsSync(versionFile)) {
    versionSpec = fs.readFileSync(versionFile, "utf-8").trim();
  }
}

if (!versionSpec) {
  versionSpec = "latest";
}

// ===== 解析版本 → pip install 参数 =====
// 重要：[api] 可选依赖必须正确传递
function resolveInstallTarget(spec) {
  // GitHub 源码: github:v1.1.3 或 github:user/repo@v1.1.3
  if (spec.startsWith("github:")) {
    const ref = spec.slice("github:".length);

    // 如果包含 / 就当作完整仓库路径
    if (ref.includes("/")) {
      return {
        label: `GitHub 源码 ${ref}`,
        // GitHub 安装需要 #egg=wordformat[api] 来指定可选依赖
        pkg: `"git+https://github.com/${ref}#egg=wordformat[api]"`,
      };
    }

    // 否则使用默认仓库 AfishInLake/WordFormat
    const tag = ref.startsWith("v") ? ref : `v${ref}`;
    return {
      label: `GitHub 源码 AfishInLake/WordFormat@${tag}`,
      pkg: `"git+https://github.com/AfishInLake/WordFormat.git@${tag}#egg=wordformat[api]"`,
    };
  }

  // PyPI 显式版本: pypi:1.1.3
  if (spec.startsWith("pypi:")) {
    const ver = spec.slice("pypi:".length);
    return {
      label: `PyPI wordformat[api]==${ver}`,
      pkg: `"wordformat[api]==${ver}"`,
    };
  }

  // latest
  if (spec === "latest") {
    return {
      label: "PyPI 最新版",
      pkg: `"wordformat[api]"`,
    };
  }

  // 默认 PyPI 版本
  const ver = spec.startsWith("v") ? spec.slice(1) : spec;
  return {
    label: `PyPI wordformat[api]==${ver}`,
    pkg: `"wordformat[api]==${ver}"`,
  };
}

// ===== 常量 =====
const RUNTIME_DIR = path.join(__dirname, "..", "electron", "python-runtime");
const platform = os.platform();
const isWindows = platform === "win32";

const pythonBin = isWindows
  ? path.join("Scripts", "python.exe")
  : path.join("bin", "python3");

const { label: versionLabel, pkg: installTarget } = resolveInstallTarget(versionSpec);

console.log("=========================================");
console.log("  构建可移植 Python 运行时");
console.log("=========================================");
console.log(`  平台:    ${platform}`);
console.log(`  版本:    ${versionLabel}`);
console.log(`  pip:     ${installTarget}`);
console.log(`  输出:    ${RUNTIME_DIR}`);
console.log("");

// ===== 步骤 1: 查找系统 Python =====
function findSystemPython() {
  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    try {
      const out = execSync(`${cmd} --version 2>&1`, { stdio: "pipe" }).toString().trim();
      const verMatch = out.match(/Python (\d+)\.(\d+)/);
      if (verMatch) {
        const major = parseInt(verMatch[1]);
        const minor = parseInt(verMatch[2]);
        console.log(`[1/5] 系统 Python: ${out}`);
        
        // 版本检查：wordformat 支持 3.10-3.13
        if (major === 3 && minor >= 14) {
          console.warn(`\n⚠️  警告: Python 3.${minor} 可能不被 wordformat 完全支持`);
          console.warn(`   wordformat 官方支持: Python 3.10 - 3.13`);
          console.warn(`   建议使用 Python 3.11 或 3.12\n`);
        }
        
        return cmd;
      }
    } catch {
      continue;
    }
  }
  console.error("❌ 未找到系统 Python！请安装 Python 3.10+");
  process.exit(1);
}

const pythonCmd = findSystemPython();

// ===== 步骤 2: 清理旧产物 =====
console.log("[2/5] 清理旧运行时...");
fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });

// ===== 步骤 3: 创建 venv (--copies 模式) =====
console.log("[3/5] 创建虚拟环境 (--copies, 可移植)...");
const venvResult = spawnSync(pythonCmd, ["-m", "venv", "--copies", RUNTIME_DIR], {
  stdio: "inherit",
});
if (venvResult.status !== 0) {
  console.error("❌ 创建 venv 失败");
  process.exit(1);
}

const pythonPath = path.join(RUNTIME_DIR, pythonBin);
const pipPath = path.join(RUNTIME_DIR, isWindows ? "Scripts" : "bin", isWindows ? "pip.exe" : "pip");

// ===== 步骤 4: 升级 pip =====
console.log("[4/5] 升级 pip...");
const upgradeResult = spawnSync(pythonPath, ["-m", "pip", "install", "--upgrade", "pip"], {
  stdio: "inherit",
  env: { ...process.env, PIP_NO_CACHE_DIR: "1" },
});

// ===== 步骤 5: pip install =====
console.log(`[5/5] pip install ${installTarget} ...`);

// 使用 shell 模式确保 [api] 正确传递
const installCmd = `"${pythonPath}" -m pip install ${installTarget}`;
console.log(`  执行: ${installCmd}`);

const installResult = spawnSync(pythonPath, [
  "-m", "pip", "install",
  // 不加引号，直接传递数组元素
  installTarget.replace(/"/g, ""),
], {
  stdio: "inherit",
  env: {
    ...process.env,
    PIP_NO_CACHE_DIR: "1",
  },
  shell: false,
});

if (installResult.status !== 0) {
  console.error("❌ pip install 失败");
  process.exit(1);
}

// ===== 验证 =====
// wordformat 没有 __version__ 属性，用 pip show 获取版本
const verResult = spawnSync(pythonPath, ["-m", "pip", "show", "wordformat"], { stdio: "pipe" });
const verOutput = verResult.stdout.toString();
const verMatch = verOutput.match(/^Version:\s*(.+)$/m);
const installedVer = verMatch ? `wordformat ${verMatch[1]}` : "wordformat (version unknown)";

console.log(`\n验证: ${installedVer}`);

if (verResult.status !== 0 || !verMatch) {
  console.error("❌ 运行时验证失败");
  console.error(verResult.stderr.toString());
  process.exit(1);
}

// ===== 自检：确保 fastapi 已安装 =====
console.log("\n自检依赖...");
const deps = ["fastapi", "uvicorn", "python-multipart"];
for (const dep of deps) {
  const depResult = spawnSync(pythonPath, ["-c", `import ${dep}; print("${dep} OK")`], { stdio: "pipe" });
  if (depResult.status !== 0) {
    console.error(`❌ ${dep} 未安装！正在补充安装...`);
    const fixResult = spawnSync(pythonPath, ["-m", "pip", "install", dep], { stdio: "inherit" });
    if (fixResult.status !== 0) {
      console.error(`❌ 无法安装 ${dep}`);
      process.exit(1);
    }
  } else {
    console.log(`  ✓ ${dep}`);
  }
}

// ===== 自检：确保能正常 import =====
const importResult = spawnSync(pythonPath, [
  "-c",
  "from wordformat.api import app; print('wordformat.api OK')",
], { stdio: "pipe" });

if (importResult.status !== 0) {
  console.error("❌ wordformat.api 自检失败:");
  console.error(importResult.stderr.toString());
  process.exit(1);
}
console.log("  ✓ wordformat.api");

// ===== 写入版本信息 =====
fs.writeFileSync(
  path.join(RUNTIME_DIR, "VERSION"),
  `${installedVer}\n来源: ${versionLabel}\n构建时间: ${new Date().toISOString()}\n`
);

// ===== 清理缓存减小体积 =====
console.log("\n清理 __pycache__...");
try {
  const cleanupDirs = findPyCacheDirs(RUNTIME_DIR);
  for (const d of cleanupDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`  清理了 ${cleanupDirs.length} 个 __pycache__ 目录`);
} catch {
  // 忽略
}

// ===== 计算体积 =====
const sizeMB = getDirSize(RUNTIME_DIR);
console.log(`\n✅ 构建完成! 运行时: ${(sizeMB / (1024 * 1024)).toFixed(1)} MB`);
console.log(`   版本:   ${installedVer}`);
console.log(`   来源:   ${versionLabel}`);
console.log(`   路径:   ${RUNTIME_DIR}`);
console.log("");
console.log("💡 npm run electron:dev    开发模式 (需系统 pip install wordformat[api])");
console.log("💡 npm run electron:build  打包分发版");
console.log("💡 node scripts/build-backend.cjs --ver github:v1.1.3  指定版本构建");

// ===== 辅助函数 =====

function findPyCacheDirs(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__pycache__") {
        results.push(path.join(dir, entry.name));
      } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
        results.push(...findPyCacheDirs(path.join(dir, entry.name)));
      }
    }
  } catch {
    // 忽略
  }
  return results;
}

function getDirSize(dir) {
  let size = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        size += getDirSize(fp);
      } else {
        try { size += fs.statSync(fp).size; } catch {}
      }
    }
  } catch {}
  return size;
}
