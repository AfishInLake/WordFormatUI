#!/usr/bin/env node

import os from 'os';
import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

// === 解析命令行参数（可选）===
function parseArgs() {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--version' && args[i + 1]) {
            return args[i + 1];
        }
    }
    return null;
}

const cliVersion = parseArgs();

// === 如果没提供 --version，则自动获取 latest tag ===
async function getLatestTag(repo) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            `https://api.github.com/repos/${repo}/releases/latest`,
            {
                headers: {
                    'User-Agent': 'WordFormat-Installer/1.0', // 必填：GitHub API 要求的用户代理
                    'Accept': 'application/vnd.github.v3+json' // 指定接收 JSON 格式响应
                }
            },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.tag_name) {
                            resolve(json.tag_name);
                        } else {
                            reject(new Error('No tag_name in response'));
                        }
                    } catch (e) {
                        reject(new Error('Failed to parse GitHub API response'));
                    }
                });
            }
        );
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('GitHub API timeout'));
        });
    });
}

// === 主逻辑 ===
async function main() {
    // 确定版本
    let VERSION;
    if (cliVersion) {
        VERSION = cliVersion;
        console.log(`Using specified version: ${VERSION}`);
    } else if (fs.existsSync('.backend-version')) {
        VERSION = fs.readFileSync('.backend-version', 'utf8').trim();
        console.log(`Using version from .backend-version: ${VERSION}`);
    } else {
        console.log('No version specified. Fetching latest release tag...');
        try {
            VERSION = await getLatestTag('AfishInLake/WordFormat');
            console.log(`Latest version: ${VERSION}`);
        } catch (err) {
            console.error('ERROR: Failed to fetch latest release:', err.message);
            console.error('Please specify a version with --version <tag>');
            process.exit(1);
        }
    }

    // 平台信息
    const platform = os.platform();
    const arch = os.arch();

    let assetName, targetTriple, executableName;

    if (platform === 'win32') {
        assetName = 'wordformat-Windows.zip';
        targetTriple = 'x86_64-pc-windows-msvc';
        executableName = 'wordformat.exe';
    } else if (platform === 'linux') {
        assetName = 'wordformat-Linux.zip';
        targetTriple = 'x86_64-unknown-linux-gnu';
        executableName = 'wordformat';
    } else if (platform === 'darwin') {
        assetName = 'wordformat-macOS.zip';
        targetTriple = arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
        executableName = 'wordformat';
    } else {
        console.error(`ERROR: Unsupported OS: ${platform}`);
        process.exit(1);
    }

    const binariesDir = path.resolve('src-tauri', 'binaries');
    const wordformatSubdir = path.join(binariesDir, 'wordformat');
    const zipPath = path.resolve('wordformat.zip');

    fs.mkdirSync(binariesDir, {recursive: true});

    console.log(`Detected OS: ${platform}, Arch: ${arch}`);
    console.log(`Fetching WordFormat core: ${VERSION}`);

    const downloadUrl = `https://github.com/AfishInLake/WordFormat/releases/download/${VERSION}/${assetName}`;

    // 下载
    await downloadFile(downloadUrl, zipPath);

    // 解压
    extractZip(zipPath, binariesDir);

    // 整理目录结构
    if (!fs.existsSync(wordformatSubdir)) {
        fs.mkdirSync(wordformatSubdir, {recursive: true});
        for (const file of fs.readdirSync(binariesDir)) {
            if (file !== 'wordformat') {
                fs.renameSync(path.join(binariesDir, file), path.join(wordformatSubdir, file));
            }
        }
    }

    const oldExePath = path.join(wordformatSubdir, executableName);
    const newExePath = path.join(wordformatSubdir, `wordformat-${targetTriple}${platform === 'win32' ? '.exe' : ''}`);

    if (fs.existsSync(oldExePath)) {
        fs.renameSync(oldExePath, newExePath);
    } else if (!fs.existsSync(newExePath)) {
        console.error('ERROR: No wordformat executable found!');
        process.exit(1);
    }

    fs.unlinkSync(zipPath);
    console.log(`Executable ready: wordformat-${targetTriple}`);
    console.log('Backend ready for Tauri v2!');
}

// === 工具函数（保持不变）===
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`准备下载: ${url}`);

        const maxRedirects = 5;
        let redirects = 0;

        function get(currentUrl) {
            const protocol = currentUrl.startsWith('https') ? https : http;

            // 👇 2. 构建请求选项
            const options = {
                timeout: 120000, // 2 分钟超时
                headers: { 'User-Agent': 'WordFormat-Setup' }
            };

            // 👇 3. 关键：检测环境变量并注入 Agent
            const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;

            if (proxyUrl) {
                console.log(`检测到代理配置，强制使用 Agent: ${proxyUrl}`);
                try {
                    options.agent = new HttpsProxyAgent(proxyUrl);
                } catch (e) {
                    console.error('代理配置解析失败:', e.message);
                    reject(e);
                    return;
                }
            } else {
                console.log('未检测到代理，尝试直连...\r\nPS:如果下载失败，请点击上述链接手动下载，把文件解压在src-tauri/binaries目录下，并修改可执行文件名称\n具体参考官方文档:https://tauri.app/zh-cn/develop/sidecar/\n');
            }

            const req = protocol.get(currentUrl, options, (response) => {
                // ... (重定向逻辑不变) ...
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    if (redirects >= maxRedirects) {
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    redirects++;
                    console.log(`重定向到: ${response.headers.location}`);
                    get(response.headers.location);
                }
                // ... (成功逻辑不变) ...
                else if (response.statusCode === 200) {
                    const file = fs.createWriteStream(dest);
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log('下载完成');
                        resolve();
                    });
                    file.on('error', (err) => {
                        fs.unlink(dest, () => {});
                        reject(err);
                    });

                    // 打印进度
                    const total = parseInt(response.headers['content-length'], 10) || 0;
                    let current = 0;
                    response.on('data', chunk => {
                        current += chunk.length;
                        if (total > 0) {
                            process.stdout.write(`\r下载进度: ${((current/total)*100).toFixed(1)}%`);
                        }
                    });
                }
                // ... (错误逻辑不变) ...
                else {
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            });

            req.on('error', (err) => {
                console.error('\n请求失败:', err.message);
                reject(err);
            });

            req.on('timeout', () => {
                console.error('\n请求超时');
                req.destroy();
                reject(new Error('Request timeout'));
            });
        }

        get(url);
    });
}

function extractZip(zipPath, destDir) {
    if (os.platform() === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, {stdio: 'inherit'});
    } else {
        execSync(`unzip -o "${zipPath}" -d "${destDir}"`, {stdio: 'inherit'});
    }
}

// === 启动 ===
main().catch(err => {
    console.error(err);
    process.exit(1);
});