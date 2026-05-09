<!-- src/components/DocTagChecker.vue -->
<template>
  <div class="doc-tag-check-container">
    <!-- 顶部工具栏 -->
    <div class="header-bar">
      <div class="header-content">
        <div class="header-left">
          <h1 class="tool-title">文档标签核对工具</h1>
          <div class="stats-info" v-if="isFileLoaded">
            共 <span>{{ nodeCount }}</span> 个节点 |
            疑似错误 <span>{{ errorCount }}</span> 个 |
            标记跳过 <span>{{ otherCount }}</span> 个
          </div>
        </div>

        <div class="header-right">
          <!-- 文件上传面板 -->
          <FileUploadPanel
              v-model:docx-file="docxFile"
              v-model:yaml-file="yamlFile"
              :generated-config="generatedConfig"
              :is-loading="isLoading"
              @generate-json="callGenerateJsonApi"
          />

          <!-- 格式操作面板（仅在加载后显示） -->
          <FormatActionPanel
              v-if="isFileLoaded"
              :is-loading="isLoading"
              @check-format="callCheckFormatApi"
              @apply-format="callApplyFormatApi"
          />

          <!-- 搜索框 -->
          <div class="search-box">
            <input
                type="text"
                v-model="searchTerm"
                placeholder="搜索段落内容..."
                class="search-input"
            />
            <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>

          <!-- 辅助按钮 -->
          <button class="btn secondary-btn" @click="checkAllTags" :disabled="!isFileLoaded || isLoading">
            核对所有标签
          </button>
          <button class="btn primary-btn" @click="exportModifiedJson" :disabled="!isFileLoaded">
            导出修改后JSON
          </button>
        </div>
      </div>
    </div>

    <!-- 主体内容区 -->
    <div class="main-content">
      <!-- 节点列表 -->
      <NodeListPanel
          :node-data="filteredNodeData"
          :selected-index="selectedNodeIndex"
          :is-file-loaded="isFileLoaded"
          :is-loading="isLoading"
          :loading-text="loadingText"
          :global-search-term="searchTerm"
          @select-node="selectNode"
      />

      <!-- 节点详情 -->
      <NodeDetailPanel
          :current-node="currentNode"
          :category-config="CATEGORY_CONFIG"
          :score-threshold="SCORE_THRESHOLD"
          :total-nodes="nodeData.length"
          :node-index="selectedNodeIndex + 1"
          @update-category="handleCategoryChange"
      />
    </div>
  </div>
</template>

<script setup>
import {ref, computed, watch} from 'vue'
import FileUploadPanel from './FileUploadPanel.vue'
import FormatActionPanel from './FormatActionPanel.vue'
import NodeListPanel from './NodeListPanel.vue'
import NodeDetailPanel from './NodeDetailPanel.vue'
import { confirm as tauriConfirm } from '@electron/dialog';
import { downloadFile } from '@electron/download';
import {
  CATEGORY_CONFIG,
  SCORE_THRESHOLD,
  checkTagError
} from '../composables/useTagHelpers'

import request from "../utils/request.js";

// ====== Props ======
const props = defineProps({
  generatedConfig: {
    type: Object,
    default: null
  }
});

// 创建响应式引用，确保能够使用最新的props值
const currentConfig = ref(props.generatedConfig);

// 监听props变化，更新响应式引用
watch(
  () => props.generatedConfig,
  (newConfig) => {
    currentConfig.value = newConfig;
  },
  { deep: true }
);

// ====== 响应式状态 ======
const docxFile = ref(null)
const yamlFile = ref(null)
const nodeData = ref([]) // 原始节点数据（可修改）
const isFileLoaded = ref(false)
const isLoading = ref(false)
const loadingText = ref('')
const selectedNodeIndex = ref(-1)
const searchTerm = ref('')

// ====== 计算属性 ======
const currentNode = computed(() => {
  return selectedNodeIndex.value >= 0 ? nodeData.value[selectedNodeIndex.value] : null
})

const nodeCount = computed(() => nodeData.value.length)

const errorCount = computed(() =>
    nodeData.value.filter(node => checkTagError(node, SCORE_THRESHOLD)).length
)

const otherCount = computed(() =>
    nodeData.value.filter(node => node.category === 'other').length
)

const filteredNodeData = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return nodeData.value
  return nodeData.value.filter(node =>
      node.paragraph.toLowerCase().includes(term)
  )
})

// ====== 方法 ======
// 选择节点
const selectNode = (index) => {
  selectedNodeIndex.value = index
}

// 修改当前节点的分类标签
const handleCategoryChange = (newCategory) => {
  if (currentNode.value) {
    nodeData.value[selectedNodeIndex.value].category = newCategory
    // 自动重新计算置信度？这里保留原始 score（因无模型），仅改标签
    // 若需重新打分，需调用后端接口
  }
}

// 生成节点 JSON（上传文件）
const callGenerateJsonApi = async () => {
  if (!docxFile.value) return

  const formData = new FormData()
  formData.append('docx_file', docxFile.value)
  
  // 优先使用生成的配置，否则使用选择的yaml文件
  if (currentConfig.value) {
    // 将生成的配置转换为YAML字符串
    const yaml = await import('js-yaml');
    const yamlContent = yaml.dump(currentConfig.value, { indent: 2, skipInvalid: true });
    const blob = new Blob([yamlContent], { type: 'application/yaml' });
    const configFile = new File([blob], 'generated-config.yaml', { type: 'application/yaml' });
    formData.append('config_file', configFile);
  } else if (yamlFile.value) {
    formData.append('config_file', yamlFile.value)
  } else {
    return
  }

  isLoading.value = true
  loadingText.value = '正在解析文档并生成节点...'

  try {
    const res = await request.post(
        '/generate-json',
        formData,
        {
          timeout: 300_000,
          headers: {'Content-Type': 'multipart/form-data'}
        }
    )

    if (res.data && Array.isArray(res.data.json_data)) {
      nodeData.value = res.data.json_data.map((node, idx) => ({
        ...node,
        id: idx // 用于追踪（非必须）
      }))
      isFileLoaded.value = true
      selectedNodeIndex.value = -1
    } else {
      alert('❌ 后端返回数据格式异常')
    }
  } catch (error) {
    console.error('生成JSON失败:', error)
    alert('❌ 生成节点失败：' + (error.response?.data?.detail || error.message))
  } finally {
    isLoading.value = false
  }
}

// 执行格式校验
const callCheckFormatApi = async () => {
  if (!isFileLoaded.value) return

  isLoading.value = true
  loadingText.value = '正在执行格式校验...'
  if (!docxFile.value) return

  const formData = new FormData()
  formData.append('docx_file', docxFile.value)
  
  // 优先使用生成的配置，否则使用选择的yaml文件
  if (currentConfig.value) {
    // 将生成的配置转换为YAML字符串
    const yaml = await import('js-yaml');
    const yamlContent = yaml.dump(currentConfig.value, { indent: 2, skipInvalid: true });
    const blob = new Blob([yamlContent], { type: 'application/yaml' });
    const configFile = new File([blob], 'generated-config.yaml', { type: 'application/yaml' });
    formData.append('config_file', configFile);
  } else if (yamlFile.value) {
    formData.append('config_file', yamlFile.value)
  } else {
    isLoading.value = false
    return
  }
  
  formData.append('json_data', JSON.stringify(nodeData.value))
  
  try {
    const res = await request.post(
        '/check-format',
        formData,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': undefined
          }
        }
    )
    downloadFileFromResponse(res)
  } catch (error) {
    console.error('格式校验失败:', error)
    alert('❌ 格式校验失败：' + (error.response?.data?.detail || error.message))
  } finally {
    isLoading.value = false
  }
}

// 执行自动格式化
const callApplyFormatApi = async () => {
  if (!isFileLoaded.value) return

  const ok = await tauriConfirm('⚠️ 此操作将根据当前标签生成新文档，是否继续？', {
    title: '确认操作',
    type: 'warning',
  });
  if (!ok) return;

  isLoading.value = true
  loadingText.value = '正在生成格式化后的文档...'
  if (!docxFile.value) return

  const formData = new FormData()
  formData.append('docx_file', docxFile.value)
  
  // 优先使用生成的配置，否则使用选择的yaml文件
  if (currentConfig.value) {
    // 将生成的配置转换为YAML字符串
    const yaml = await import('js-yaml');
    const yamlContent = yaml.dump(currentConfig.value, { indent: 2, skipInvalid: true });
    const blob = new Blob([yamlContent], { type: 'application/yaml' });
    const configFile = new File([blob], 'generated-config.yaml', { type: 'application/yaml' });
    formData.append('config_file', configFile);
  } else if (yamlFile.value) {
    formData.append('config_file', yamlFile.value)
  } else {
    isLoading.value = false
    return
  }
  
  formData.append('json_data', JSON.stringify(nodeData.value))
  
  try {
    const res = await request.post(
        '/apply-format',
        formData,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': undefined
          }
        })

    // 触发下载
    downloadFileFromResponse(res)
  } catch (error) {
    console.error('格式化失败:', error)
    alert('❌ 文档格式化失败：' + (error.response?.data?.detail || error.message))
  } finally {
    isLoading.value = false
  }
}

// 下载文件
async function downloadFileFromResponse(response) {
  try {
    isLoading.value = false;

    if (!response?.data?.download_url) {
      alert("✅ 操作完成！");
      return;
    }

    const { download_url, final_filename } = response.data;
    await downloadFile(download_url, final_filename || "document.docx");
    alert("✅ 文件下载成功！");
  } catch (err) {
    console.error("下载失败", err);
    alert("✅ 处理完成！文件下载失败：" + err.message);
  }
}
// 核对所有标签（前端模拟：高亮低分+other）
const checkAllTags = () => {
  if (!isFileLoaded.value) return

  const errors = nodeData.value
      .map((node, idx) => ({...node, idx}))
      .filter(n => checkTagError(n, SCORE_THRESHOLD) || n.category === 'other')

  if (errors.length === 0) {
    alert('✅ 所有节点标签均通过阈值校验！')
  } else {
    let msg = `🔍 发现 ${errors.length} 个需关注的节点：\n\n`
    msg += errors.slice(0, 10).map(e => `• [${e.idx + 1}] ${e.category}: ${e.paragraph.substring(0, 50)}...`).join('\n')
    if (errors.length > 10) msg += `\n... 还有 ${errors.length - 10} 个`
    alert(msg)
  }
}

// 导出修改后的 JSON
const exportModifiedJson = () => {
  if (!isFileLoaded.value) return

  const dataStr = JSON.stringify(nodeData.value, null, 2)
  const blob = new Blob([dataStr], {type: 'application/json;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modified_nodes.json'
  document.body.appendChild(a)
  a.click()
  URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

// 清除选中当数据重置
watch(isFileLoaded, (loaded) => {
  if (!loaded) selectedNodeIndex.value = -1
})
</script>

<style scoped>
.doc-tag-check-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f9fafb;
}

.header-bar {
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.75rem 1.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tool-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e40af;
  margin: 0;
}

.stats-info {
  font-size: 0.875rem;
  color: #64748b;
}

.stats-info span {
  font-weight: 600;
  color: #1e40af;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  padding: 6px 28px 6px 8px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  width: 180px;
  outline: none;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.search-icon {
  position: absolute;
  right: 8px;
  width: 16px;
  height: 16px;
  color: #9ca3af;
  pointer-events: none;
}

.btn {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary-btn {
  background-color: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.primary-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.secondary-btn {
  background-color: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.secondary-btn:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.main-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1.5rem;
  padding: 1.5rem;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

@media (max-width: 992px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}
</style>