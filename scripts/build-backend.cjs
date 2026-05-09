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
 *   0. 检查已有运行时是否版本一致 → 是则跳过
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
let forceRebuild = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ver" || args[i] === "--version") {
    versionSpec = args[i + 1];
    i++;
  } else if (args[i] === "--force" || args[i] === "-f") {
    forceRebuild = true;
  }
}

// 从 .backend-version 读取默认版本
if (!versionSpec && !forceRebuild) {
  const versionFile = path.join(__dirname, "..", ".backend-version");
  if (fs.existsSync(versionFile)) {
    versionSpec = fs.readFileSync(versionFile, "utf-8").trim();
  }
}

if (!versionSpec) {
  versionSpec = "latest";
}

// ===== 解析版本 → pip install 参数 =====
function resolveInstallTarget(spec) {
  // GitHub 源码
  if (spec.startsWith("github:")) {
    const ref = spec.slice("github:".length);
    if (ref.includes("/")) {
      return {
        source: "github",
        label: `GitHub 源码 ${ref}`,
        pkg: `"git+https://github.com/${ref}#egg=wordformat[api]"`,
        // 只用 tag/ref 部分作为比较标识
        compareKey: `github:${ref}`,
      };
    }
    const tag = ref.startsWith("v") ? ref : `v${ref}`;
    return {
      source: "github",
      label: `GitHub 源码 AfishInLake/WordFormat@${tag}`,
      pkg: `"git+https://github.com/AfishInLake/WordFormat.git@${tag}#egg=wordformat[api]"`,
      compareKey: `github:AfishInLake/WordFormat@${tag}`,
    };
  }

  // PyPI 显式版本
  if (spec.startsWith("pypi:")) {
    const ver = spec.slice("pypi:".length);
    return {
      source: "pypi",
      label: `PyPI wordformat[api]==${ver}`,
      pkg: `"wordformat[api]==${ver}"`,
      compareKey: `pypi:${ver}`,
    };
  }

  // latest — 永远不跳过
  if (spec === "latest") {
    return {
      source: "pypi",
      label: "PyPI 最新版",
      pkg: `"wordformat[api]"`,
      compareKey: null, // latest 永不匹配
    };
  }

  // 默认 PyPI 版本
  const ver = spec.startsWith("v") ? spec.slice(1) : spec;
  return {
    source: "pypi",
    label: `PyPI wordformat[api]==${ver}`,
    pkg: `"wordformat[api]==${ver}"`,
    compareKey: `pypi:${ver}`,
  };
}

// ===== 常量 =====
const RUNTIME_DIR = path.join(__dirname, "..", "electron", "python-runtime");
const VERSION_FILE = path.join(RUNTIME_DIR, "VERSION");
const platform = os.platform();
const isWindows = platform === "win32";

const pythonBin = isWindows
  ? path.join("Scripts", "python.exe")
  : path.join("bin", "python3");

const { source, label: versionLabel, pkg: installTarget, compareKey } = resolveInstallTarget(versionSpec);

console.log("=========================================");
console.log("  构建可移植 Python 运行时");
console.log("=========================================");
console.log(`  平台:    ${platform}`);
console.log(`  版本:    ${versionLabel}`);
console.log(`  输出:    ${RUNTIME_DIR}`);
console.log("");

// ===== 步骤 0: 版本检查，跳过重复构建 =====
function getInstalledVersion() {
  if (!fs.existsSync(VERSION_FILE)) return null;
  try {
    const content = fs.readFileSync(VERSION_FILE, "utf-8");
    // VERSION 文件格式: "wordformat X.Y.Z\n来源: ...\n构建时间: ..."
    const verMatch = content.match(/^wordformat (.+)$/m);
    const keyMatch = content.match(/^compareKey: (.+)$/m);
    return {
      version: verMatch ? verMatch[1] : null,
      compareKey: keyMatch ? keyMatch[1] : null,
    };
  } catch {
    return null;
  }
}

function pythonExists() {
  const exePath = path.join(RUNTIME_DIR, pythonBin);
  return fs.existsSync(exePath);
}

const installed = getInstalledVersion();

if (!forceRebuild && pythonExists() && installed) {
  if (compareKey && installed.compareKey === compareKey) {
    console.log(`✅ 已安装 ${installed.version}（${compareKey}），版本一致，跳过构建。`);
    console.log(`   ${RUNTIME_DIR}`);
    console.log("");
    console.log("💡 如需强制重新构建: node scripts/build-backend.cjs --force");
    process.exit(0);
  }

  if (compareKey === null) {
    // latest — 永远重建
    console.log(`⚠️  目标版本为 "latest"，将重新构建（当前: ${installed.version}）。`);
  } else {
    console.log(`⚠️  版本不一致: 目标 ${compareKey} ≠ 当前 ${installed.compareKey}，重新构建。`);
  }
} else if (pythonExists()) {
  console.log("⚠️  运行时存在但无版本信息，重新构建。");
}

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

// ===== 步骤 4: 升级 pip =====
console.log("[4/5] 升级 pip...");
spawnSync(pythonPath, ["-m", "pip", "install", "--upgrade", "pip"], {
  stdio: "inherit",
  env: { ...process.env, PIP_NO_CACHE_DIR: "1" },
});

// ===== 步骤 5: pip install =====
console.log(`[5/5] pip install ${installTarget} ...`);

const installResult = spawnSync(pythonPath, [
  "-m", "pip", "install",
  installTarget.replace(/"/g, ""),
], {
  stdio: "inherit",
  env: {
    ...process.env,
    PIP_NO_CACHE_DIR: "1",
  },
});

if (installResult.status !== 0) {
  console.error("❌ pip install 失败");
  process.exit(1);
}

// ===== 验证 =====
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

// ===== 自检 =====
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

const importResult = spawnSync(pythonPath, [
  "-c", "from wordformat.api import app; print('wordformat.api OK')",
], { stdio: "pipe" });

if (importResult.status !== 0) {
  console.error("❌ wordformat.api 自检失败:");
  console.error(importResult.stderr.toString());
  process.exit(1);
}
console.log("  ✓ wordformat.api");

// ===== 写入版本信息（含 compareKey 用于下次跳过检查） =====
fs.writeFileSync(
  VERSION_FILE,
  `${installedVer}\n来源: ${versionLabel}\ncompareKey: ${compareKey}\n构建时间: ${new Date().toISOString()}\n`
);

// ===== 清理无用文件 =====
console.log("\n清理无用文件...");
let cleanedCount = 0;

for (const d of findPyCacheDirs(RUNTIME_DIR)) {
  fs.rmSync(d, { recursive: true, force: true });
  cleanedCount++;
}
console.log(`  清理了 ${cleanedCount} 个 __pycache__ 目录`);

const distInfoDirs = findDirs(RUNTIME_DIR, (name) => name.endsWith(".dist-info"));
for (const d of distInfoDirs) {
  fs.rmSync(d, { recursive: true, force: true });
  cleanedCount++;
}
console.log(`  清理了 ${distInfoDirs.length} 个 .dist-info 目录`);

const testDirs = findDirs(RUNTIME_DIR, (name) => name === "tests" || name === "test" || name === "testing");
for (const d of testDirs) {
  fs.rmSync(d, { recursive: true, force: true });
  cleanedCount++;
}
console.log(`  清理了 ${testDirs.length} 个 test 目录`);

const pycFiles = findFiles(RUNTIME_DIR, (name) => name.endsWith(".pyc") || name.endsWith(".pyo"));
for (const f of pycFiles) {
  fs.rmSync(f, { force: true });
  cleanedCount++;
}
console.log(`  清理了 ${pycFiles.length} 个 .pyc/.pyo 文件`);
console.log(`  共清理 ${cleanedCount} 项`);

// ===== 计算体积 =====
const sizeMB = getDirSize(RUNTIME_DIR);
console.log(`\n✅ 构建完成! 运行时: ${(sizeMB / (1024 * 1024)).toFixed(1)} MB`);
console.log(`   版本:   ${installedVer}`);
console.log(`   来源:   ${versionLabel}`);
console.log(`   路径:   ${RUNTIME_DIR}`);
console.log("");
console.log("💡 npm run electron:dev    开发模式");
console.log("💡 npm run electron:build  打包分发版");
console.log("💡 node scripts/build-backend.cjs --force  强制重新构建");

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
  } catch {}
  return results;
}

function findDirs(dir, matchFn) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (matchFn(entry.name)) {
          results.push(path.join(dir, entry.name));
        } else if (!entry.name.startsWith(".")) {
          results.push(...findDirs(path.join(dir, entry.name), matchFn));
        }
      }
    }
  } catch {}
  return results;
}

function findFiles(dir, matchFn) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        results.push(...findFiles(fp, matchFn));
      } else if (entry.isFile() && matchFn(entry.name)) {
        results.push(fp);
      }
    }
  } catch {}
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
