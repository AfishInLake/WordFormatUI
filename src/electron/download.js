/**
 * 文件下载
 *
 * 从后端拉取文件 → 弹出 Electron 保存对话框（默认「下载」文件夹） → 保存
 */
const BACKEND_URL = 'http://127.0.0.1:8000';

/**
 * 将 Blob 转为 base64 字符串
 */
function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result 格式: "data:...;base64,xxxx"
      resolve(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * 下载文件到用户选择的路径
 *
 * @param {string} downloadUrl - 相对后端的下载路径（如 /download/xxx.docx）
 * @param {string} filename - 建议文件名
 */
export async function downloadFile(downloadUrl, filename) {
  // 1. 从后端拉取文件
  const response = await fetch(`${BACKEND_URL}${downloadUrl}`);
  if (!response.ok) throw new Error(`下载失败: ${response.status}`);

  const blob = await response.blob();
  const base64 = await blobToBase64(blob);

  // 2. 弹出保存对话框（默认定位到下载文件夹）
  const downloadDir = await window.electronAPI.invoke('get-download-dir');
  const filePath = await window.electronAPI.invoke('save-dialog', {
    title: '保存文件',
    defaultPath: `${downloadDir}/${filename}`,
    filters: [{ name: 'Word 文档', extensions: ['docx'] }],
  });

  if (!filePath) return null; // 用户取消

  // 3. 写入文件
  await window.electronAPI.invoke('save-file', filePath, base64);

  return filePath;
}
