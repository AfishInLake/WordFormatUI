<template>
  <div class="app-container">

    <!-- 👇【新增部分】加载/错误 遮罩层 -->
    <!-- 当 isLoading 为 true 时显示，覆盖整个屏幕 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <h2>正在启动核心服务...</h2>
        <p class="status-text">{{ statusMessage }}</p>
      </div>
    </div>

    <!-- 当启动失败时显示 -->
    <div v-else-if="isError" class="error-overlay">
      <div class="error-content">
        <h2 style="color: #ef4444;">⚠️ 服务启动失败</h2>
        <p>{{ errorMessage }}</p>
        <div class="error-actions">
          <button class="btn primary-btn" @click="retryInit">🔄 重试启动</button>
          <button class="btn secondary-btn" @click="ignoreError">⚠️ 忽略并继续 (可能无法使用)</button>
        </div>
      </div>
    </div>
    <!-- 👆【新增部分结束】 -->

    <!-- 原有内容：只有当 !isLoading 且 !isError (或者用户选择忽略) 时才完全交互 -->
    <!-- 注意：即使 isError，如果用户选择忽略，我们也显示主界面，但你可能需要在子组件里禁用功能 -->
    <div class="nav-bar" :style="{ opacity: isLoading ? 0 : 1, pointerEvents: isLoading ? 'none' : 'auto' }">
      <div class="nav-content">
        <h1 class="app-title">WordFormat 工具</h1>
        <div class="nav-actions">
          <!-- 配置操作按钮 -->
          <div class="config-actions" v-if="activeTab === 'config'">
            <button class="btn secondary-btn" @click="saveConfig" :disabled="!generatedConfig">
              保存配置
            </button>
            <button class="btn secondary-btn" @click="loadConfig">
              加载配置
            </button>
          </div>

          <!-- 标签页切换 -->
          <div class="nav-tabs">
            <button class="nav-tab" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">
              配置生成器
            </button>
            <button class="nav-tab" :class="{ active: activeTab === 'checker' }" @click="activeTab = 'checker'">
              文档标签核对
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-area" :style="{ opacity: isLoading ? 0 : 1, pointerEvents: isLoading ? 'none' : 'auto' }">
      <!-- 配置生成器 -->
      <ConfigGenerator ref="configGeneratorRef" v-show="activeTab === 'config'" @config-updated="handleConfigUpdated"/>

      <!-- 文档标签核对工具 -->
      <DocTagChecker v-show="activeTab === 'checker'" :generated-config="generatedConfig"/>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue';
import DocTagChecker from "./components/DocTagChecker.vue";
import ConfigGenerator from "./config-generator/ConfigGenerator.vue";
import {save, open} from '@tauri-apps/plugin-dialog';
import {writeTextFile, readTextFile} from '@tauri-apps/plugin-fs';
import yaml from 'js-yaml';
import {defaultConfig} from "./config-generator/utils";

// 👇【修改点 1】引入 exe 管理工具
// 确保你的项目里有 src/utils/useExeManager.js 这个文件
import {useExeManager} from './utils/useExeManager.js';

const {ensureStarted} = useExeManager();

// 活动标签页
const activeTab = ref('config');

// 生成的配置
const generatedConfig = ref(JSON.parse(JSON.stringify(defaultConfig)));

// 配置生成器引用
const configGeneratorRef = ref(null);

// 👇【修改点 2】新增状态变量
const isLoading = ref(true);       // 是否正在加载
const isError = ref(false);        // 是否发生错误
const statusMessage = ref('初始化中...'); // 加载提示文字
const errorMessage = ref('');      // 错误提示文字
const isIgnored = ref(false);      // 用户是否选择忽略错误

// 处理配置更新
const handleConfigUpdated = (config) => {
  generatedConfig.value = config;
};

// 👇【修改点 3】核心启动逻辑
const initApp = async () => {
  isLoading.value = true;
  isError.value = false;
  isIgnored.value = false;
  statusMessage.value = '正在清理旧进程...';

  try {
    // 调用 Rust: 先 close 再 start
    const success = await ensureStarted();

    if (success) {
      statusMessage.value = '服务启动成功！即将进入...';
      // 延迟一点点让用户体验到“成功”的感觉，然后隐藏遮罩
      setTimeout(() => {
        isLoading.value = false;
      }, 800);
    } else {
      throw new Error('后端返回启动失败，请检查 Rust 日志');
    }
  } catch (err) {
    console.error(err);
    isError.value = true;
    errorMessage.value = err.message || '无法启动 wordformat.exe，请检查是否被杀毒软件拦截。';
    isLoading.value = false; // 停止 loading，显示错误界面
  }
};

// 重试按钮
const retryInit = () => {
  initApp();
};

// 忽略错误按钮 (让用户强行进入界面，虽然功能可能不可用)
const ignoreError = () => {
  isError.value = false;
  isIgnored.value = true;
  // 这里可以加一个提示：部分功能可能无法使用
};

// 生命周期：组件挂载后自动执行
onMounted(() => {
  // 初始化默认配置
  generatedConfig.value = JSON.parse(JSON.stringify(defaultConfig));

  // 👇 启动 exe
  initApp();
});

// 保存配置 (原有逻辑保持不变)
const saveConfig = async () => {
  if (!generatedConfig.value) return;
  try {
    const filePath = await save({
      title: '保存配置',
      defaultPath: 'wordformat-config.yaml',
      filters: [{name: 'YAML 配置文件', extensions: ['yaml', 'yml']}]
    });
    if (filePath) {
      const yamlContent = yaml.dump(generatedConfig.value, {indent: 2, skipInvalid: true});
      await writeTextFile(filePath, yamlContent);
      alert('配置保存成功！');
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    alert('保存配置失败：' + error.message);
  }
};

// 加载配置 (原有逻辑保持不变)
const loadConfig = async () => {
  try {
    const selected = await open({
      title: '加载配置',
      multiple: false,
      filters: [{name: 'YAML 配置文件', extensions: ['yaml', 'yml']}]
    });
    if (selected) {
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      const yamlContent = await readTextFile(filePath);
      const config = yaml.load(yamlContent);
      generatedConfig.value = config;
      if (configGeneratorRef.value) {
        configGeneratorRef.value.importConfig(config);
      }
      alert('配置加载成功！');
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    alert('加载配置失败：' + error.message);
  }
};

</script>
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: #f9fafb;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.nav-bar {
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  padding: 0 2rem;
}

.nav-content {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e40af;
  margin: 0;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.config-actions {
  display: flex;
  gap: 0.5rem;
}

.nav-tabs {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary-btn {
  background-color: #3b82f6;
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.secondary-btn {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.secondary-btn:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.nav-tab {
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-tab:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.nav-tab.active {
  background-color: #3b82f6;
  color: white;
}

.content-area {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 768px) {
  .nav-content {
    flex-direction: column;
    height: auto;
    padding: 1rem 0;
    gap: 1rem;
  }

  .nav-tabs {
    width: 100%;
    justify-content: center;
  }

  .content-area {
    padding: 1rem;
  }
}
</style>