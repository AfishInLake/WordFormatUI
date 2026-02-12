import fs from 'fs';
import path from 'path';

const dirs = ['src-tauri/target', 'dist'];

for (const dir of dirs) {
    const fullPath = path.resolve(dir);
    if (fs.existsSync(fullPath)) {
        console.log(`Removing ${fullPath}`);
        fs.rmSync(fullPath, {recursive: true, force: true});
    }
}

console.log('Clean complete.');