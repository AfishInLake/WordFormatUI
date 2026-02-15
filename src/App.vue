<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <div class="nav-bar">
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
    <div class="content-area">
      <!-- 配置生成器 -->
      <ConfigGenerator ref="configGeneratorRef" v-show="activeTab === 'config'" @config-updated="handleConfigUpdated" />

      <!-- 文档标签核对工具 -->
      <DocTagChecker v-show="activeTab === 'checker'" :generated-config="generatedConfig" />
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import DocTagChecker from "./components/DocTagChecker.vue";
import ConfigGenerator from "./config-generator/ConfigGenerator.vue";
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import yaml from 'js-yaml';
import { defaultConfig } from "./config-generator/utils";

// 活动标签页
const activeTab = ref('config');

// 生成的配置
const generatedConfig = ref(JSON.parse(JSON.stringify(defaultConfig)));

// 配置生成器引用
const configGeneratorRef = ref(null);

// 处理配置更新
const handleConfigUpdated = (config) => {
  generatedConfig.value = config;
};

// 组件挂载时初始化
onMounted(() => {
  // 初始化生成的配置为默认配置
  generatedConfig.value = JSON.parse(JSON.stringify(defaultConfig));
});

// 保存配置
const saveConfig = async () => {
  if (!generatedConfig.value) return;

  try {
    // 弹出保存对话框
    const filePath = await save({
      title: '保存配置',
      defaultPath: 'wordformat-config.yaml',
      filters: [
        {
          name: 'YAML 配置文件',
          extensions: ['yaml', 'yml']
        }
      ]
    });

    if (filePath) {
      // 将配置转换为YAML字符串
      const yamlContent = yaml.dump(generatedConfig.value, { indent: 2, skipInvalid: true });
      // 写入文件
      await writeTextFile(filePath, yamlContent);
      alert('配置保存成功！');
    }
  } catch (error) {
    console.error('保存配置失败:', error);
    alert('保存配置失败：' + error.message);
  }
};

// 加载配置
const loadConfig = async () => {
  try {
    // 弹出打开对话框
    const selected = await open({
      title: '加载配置',
      multiple: false,
      filters: [
        {
          name: 'YAML 配置文件',
          extensions: ['yaml', 'yml']
        }
      ]
    });

    if (selected) {
      const filePath = Array.isArray(selected) ? selected[0] : selected;
      // 读取文件内容
      const yamlContent = await readTextFile(filePath);
      // 解析YAML
      const config = yaml.load(yamlContent);
      // 更新配置
      generatedConfig.value = config;
      // 通知配置生成器更新
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