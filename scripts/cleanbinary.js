import fs from 'fs';
import path from 'path';

const binariesDir = path.resolve('src-tauri', 'binaries');

if (fs.existsSync(binariesDir)) {
    fs.rmSync(binariesDir, { recursive: true, force: true });
}
fs.mkdirSync(binariesDir, { recursive: true });
console.log('Cleaned binaries directory.');