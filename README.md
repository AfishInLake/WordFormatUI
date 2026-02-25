# WordFormatUI

![License](https://img.shields.io/github/license/AfishInLake/WordFormatUI?color=blue)
![tauri](https://img.shields.io/badge/tauri-2.0-blue)
![Status](https://img.shields.io/badge/status-开发中-orange)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

---

一个基于 **Vue + Tauri + JavaScript + Rust** 构建的跨平台桌面应用，为 [WordFormat](https://github.com/AfishInLake/WordFormat) 提供图形化操作界面，帮助用户轻松完成学术论文格式自动化检查与修正。

> 💡 **为什么选择 Tauri？**  
> 相比 Electron，Tauri 应用体积更小（通常 < 5MB）、内存占用更低、启动更快，且安全性更高。

---

## 🔗 原始项目

- 后端核心：[WordFormat](https://github.com/AfishInLake/WordFormat)（Python + bert 驱动的 Word 格式处理引擎）

---

## 📥 下载安装（普通用户）

✅ **无需编译，直接使用！**  
前往 [Releases 页面](https://github.com/AfishInLake/WordFormatUI/releases) 下载对应操作系统的安装包：

- **Windows**：`.msi` 安装程序
- **macOS**：`.dmg` 磁盘镜像

---

## 👨‍💻 开发者指南

### 📦 先决条件

请确保已安装以下工具：

| 平台 | 要求 |
|------|------|
| **通用** | - Node.js ≥ v18- npm（随 Node.js 自带）- Rust（[通过 rustup 安装](https://rust-lang.org/tools/install/)） |
| **Windows** | Visual Studio 2022 生成工具（含 C++ 桌面开发 workload） |
| **macOS** | Xcode 命令行工具（终端运行 `xcode-select --install`） |

> ⚠️ Linux 暂未提供官方构建支持，但可本地编译运行。

---

### 🚀 快速启动

```bash
# 1. 安装前端依赖
make install

# 2. 下载后端二进制（自动匹配平台）
#终端可能需要设置代理，如：
#windows
#$env:HTTPS_PROXY="http://127.0.0.1:7890"
#$env:HTTP_PROXY="http://127.0.0.1:7890"
#macOS/linux
#export http_proxy=http://127.0.0.1:7890
#export https_proxy=http://127.0.0.1:7890
make setup

# 3. 启动开发服务器（热重载）
make dev
```

> ✅ `make setup` 会从 [WordFormat 最新 Release](https://github.com/AfishInLake/WordFormat/releases/latest) 下载适配你系统的 `wordformat` 可执行文件，并放入 `src-tauri/binaries/`。**此步骤不可跳过！**

---

### 🏗️ 构建生产版本

```bash
make build
```

输出路径：
```
src-tauri/target/release/bundle/
```

- **Windows** → `.msi`
- **macOS** → `.app`

---

## 🛠️ 常用命令

| 命令 | 说明 |
|------|------|
| `make dev` | 启动开发模式（带热重载） |
| `make build` | 构建生产安装包 |
| `make install` | 安装 npm 依赖 |
| `make setup` | 下载并配置后端二进制 |
| `make clean` | 清理 `node_modules`、Rust 缓存及二进制 |
| `make clean-binaries` | 仅清理 `binaries/` 目录 |
| `make help` | 查看所有可用命令 |

---

## 📂 项目结构

```
WordFormatUI/
├── src/                  # Vue 前端源码
├── src-tauri/            # Tauri 配置与资源
│   └── binaries/         # ← 自动生成，存放 wordformat 可执行文件
├── scripts/              # 自动化脚本（setup.js, clean.js 等）
├── Makefile              # 统一命令入口
├── package.json          # 前端依赖与脚本
└── tauri.conf.json       # Tauri 应用配置
```

---

## 💡 注意事项

- **平台绑定**：构建产物仅适用于当前操作系统（Windows 构建不能在 macOS 运行）。
- **后端更新**：若 WordFormat 发布新版本，请重新运行 `make setup` 获取最新功能。
- **CI/CD**：项目已配置 GitHub Actions，支持 PR 构建验证与 Tag 触发的多平台自动发布。

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)，欢迎自由使用、修改与分发。

--- 

> 🌟 **欢迎贡献！**  
> 如发现 Bug 或有功能建议，请提交 [Issue](https://github.com/AfishInLake/WordFormatUI/issues) 或 Pull Request。