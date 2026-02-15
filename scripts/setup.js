#!/usr/bin/env node

import os from 'os';
import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import https from 'https';

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
    console.log(`✅ Executable ready: wordformat-${targetTriple}`);
    console.log('Backend ready for Tauri v2!');
}

// === 工具函数（保持不变）===
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const maxRedirects = 5;
        let redirects = 0;

        function get(url) {
            const protocol = url.startsWith('https') ? https : require('http');
            const req = protocol.get(url, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    if (redirects >= maxRedirects) {
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    redirects++;
                    get(response.headers.location);
                } else if (response.statusCode === 200) {
                    const file = fs.createWriteStream(dest);
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                    file.on('error', (err) => {
                        fs.unlink(dest, () => {
                        });
                        reject(err);
                    });
                } else {
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            });

            req.on('error', (err) => reject(err));
            req.setTimeout(30000, () => {
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