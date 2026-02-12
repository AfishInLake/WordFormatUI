import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import https from 'https';

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const maxRedirects = 5;
        let redirects = 0;

        function get(url) {
            const protocol = url.startsWith('https') ? https : require('http');
            const req = protocol.get(url, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    // Handle redirect
                    if (redirects >= maxRedirects) {
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    redirects++;
                    get(response.headers.location); // Follow redirect
                } else if (response.statusCode === 200) {
                    const file = fs.createWriteStream(dest);
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                    file.on('error', (err) => {
                        fs.unlink(dest, () => {});
                        reject(err);
                    });
                } else {
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            });

            req.on('error', (err) => {
                reject(err);
            });

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
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
    } else {
        execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
    }
}

async function main() {
    const platform = os.platform(); // 'win32', 'darwin', 'linux'
    const arch = os.arch();         // 'x64', 'arm64'

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

    // 确保目录存在
    fs.mkdirSync(binariesDir, { recursive: true });

    console.log(`Detected OS: ${platform}, Arch: ${arch}`);
    console.log('Fetching WordFormat core');

    const downloadUrl = `https://github.com/AfishInLake/WordFormat/releases/latest/download/${assetName}`;
    try {
        await downloadFile(downloadUrl, zipPath);
    } catch (err) {
        console.error('ERROR: Failed to download backend!', err.message);
        process.exit(1);
    }

    // 解压
    try {
        extractZip(zipPath, binariesDir);
    } catch (err) {
        console.error('ERROR: Failed to extract archive!');
        process.exit(1);
    }

    // 如果解压后没有 wordformat 子目录，则创建并移动内容
    if (!fs.existsSync(wordformatSubdir)) {
        fs.mkdirSync(wordformatSubdir, { recursive: true });
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
    console.log(`Executable renamed to match target triple: wordformat-${targetTriple}`);
    console.log('Backend ready for Tauri v2!');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});