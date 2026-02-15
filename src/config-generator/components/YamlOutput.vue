<template>
  <div class="yaml-output">
    <h2>生成的YAML配置</h2>
    <div class="yaml-content">
      <pre>{{ yamlContent }}</pre>
    </div>
    <div class="yaml-actions">
      <button @click="copyToClipboard" class="btn btn-primary">复制到剪贴板</button>
      <button @click="importFromFile" class="btn btn-secondary">导入配置文件</button>
      <button @click="$emit('reset-to-default')" class="btn btn-secondary">重置为默认配置</button>
    </div>
    <input type="file" ref="fileInput" style="display: none" accept=".yaml,.yml" @change="handleFileImport" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import yaml from 'js-yaml'

const props = defineProps({
  yamlContent: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['reset-to-default', 'import-yaml'])

const fileInput = ref(null)

const copyToClipboard = () => {
  navigator.clipboard.writeText(props.yamlContent)
    .then(() => {
      alert('YAML已复制到剪贴板')
    })
    .catch(err => {
      console.error('复制失败:', err)
    })
}

const importFromFile = () => {
  fileInput.value.click()
}

const handleFileImport = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      const parsedConfig = yaml.load(content)
      emit('import-yaml', parsedConfig)
      alert('配置文件导入成功')
    } catch (err) {
      console.error('导入失败:', err)
      alert('导入失败: ' + err.message)
    }
  }
  reader.onerror = () => {
    alert('文件读取失败')
  }
  reader.readAsText(file, 'utf-8')

  // 重置文件输入，以便可以重复选择同一个文件
  event.target.value = ''
}
</script>

<style scoped>
.yaml-output {
  margin-top: 40px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.yaml-output h2 {
  margin: 0;
  padding: 15px 20px;
  background-color: #f0f0f0;
  font-size: 18px;
  color: #333;
}

.yaml-content {
  padding: 20px;
  background-color: #f9f9f9;
  max-height: 400px;
  overflow-y: auto;
}

.yaml-content pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  white-space: pre;
  word-wrap: break-word;
  tab-size: 2;
  -moz-tab-size: 2;
  -o-tab-size: 2;
  text-align: left;
  display: block;
  width: 100%;
}

.yaml-actions {
  padding: 15px 20px;
  background-color: #f0f0f0;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
}

.btn-primary:hover {
  background-color: #45a049;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background-color: #e0e0e0;
}
</style>