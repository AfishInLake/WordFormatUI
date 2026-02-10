<template>
  <div class="doc-tag-check-container">
    <!-- 顶部导航栏 -->
    <div class="header-bar">
      <div class="header-content">
        <div class="header-left">
          <h1 class="tool-title">文档标签核对工具</h1>
          <div class="stats-info">
            共 <span>{{ nodeCount }}</span> 个节点 | 疑似错误 <span>{{ errorCount }}</span> 个 | 标记跳过 <span>{{ otherCount }}</span> 个
          </div>
        </div>
        <div class="header-right">
          <!-- 接口上传docx+yaml控件 -->
          <div class="api-upload-group">
            <label for="docx-file" class="btn file-btn cursor-pointer">
              选择docx
            </label>
            <input
                type="file"
                id="docx-file"
                accept=".docx"
                class="file-input-hidden"
                @change="handleDocxChange"
            />
            <span class="file-tip">{{ docxTipText }}</span>

            <label for="yaml-file" class="btn file-btn cursor-pointer ml-2">
              选择yaml
            </label>
            <input
                type="file"
                id="yaml-file"
                accept=".yaml,.yml"
                class="file-input-hidden"
                @change="handleYamlChange"
            />
            <span class="file-tip">{{ yamlTipText }}</span>

            <button
                class="btn primary-btn"
                :disabled="!docxFile || !yamlFile || isLoading"
                @click="callGenerateJsonApi"
            >
              生成节点JSON
            </button>
          </div>

          <!-- 新增：格式校验/格式化按钮组（仅加载JSON后启用） -->
          <div class="format-btn-group" v-if="isFileLoaded">
            <button
                class="btn warning-btn"
                :disabled="isLoading"
                @click="callCheckFormatApi"
            >
              执行格式校验
            </button>
            <button
                class="btn success-btn"
                :disabled="isLoading"
                @click="callApplyFormatApi"
            >
              执行自动格式化
            </button>
          </div>

          <div class="search-box">
            <input
                type="text"
                v-model="searchTerm"
                placeholder="搜索内容/标签/注释..."
                class="search-input"
                :disabled="!isFileLoaded"
            />
            <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <button class="btn" :disabled="!isFileLoaded" @click="checkAllTags">核对所有标签</button>
          <button class="btn primary-btn" :disabled="!isFileLoaded" @click="exportModifiedJson">导出修改后JSON</button>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 节点列表区 -->
      <div class="node-list-section">
        <div class="card">
          <!-- 节点列表 -->
          <div class="node-list" v-if="isFileLoaded">
            <div v-if="filteredNodeData.length === 0" class="empty-tip">无匹配的节点</div>
            <div
                v-for="(node, index) in filteredNodeData"
                :key="index"
                class="node-item"
                :class="{
                error: checkTagError(node) && node.category !== 'other',
                other: node.category === 'other',
                selected: selectedNodeIndex === index
              }"
                :style="{ marginLeft: getNodeIndent(node) }"
                @click="selectNode(index)"
            >
              <div
                  class="level-dot"
                  :style="{ backgroundColor: getLevelColor(node) }"
                  :title="node.category === 'other' ? '标记跳过' : `层级${LEVEL_MAP[node.category] || 6}`"
              ></div>
              <div
                  class="node-tag"
                  :class="node.category"
                  :title="CATEGORY_CONFIG[node.category]"
              >
                {{ node.category.replace(/_/g, ' ') }}
              </div>
              <div class="node-score" title="置信度得分">
                {{ node.score.toFixed(4) }}
              </div>
              <div class="node-content" v-html="highlightSearchText(node.paragraph)"></div>
              <div class="node-meta">
                <span class="node-comment" title="节点注释">{{ node.comment || '无注释' }}</span>
                <span class="node-fingerprint" title="节点指纹">{{ node.fingerprint?.slice(0, 8) || '无' }}</span>
              </div>
            </div>
          </div>

          <!-- 初始提示 -->
          <div v-else-if="!isLoading" class="init-tip">
            <svg class="init-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9m-5 13h14a2 2 0 002-2V9a2 2 0 00-2-2h-2.586a1 1 0 01-.707-.293l-2.414-2.414a1 1 0 00-.707-.293H11a2 2 0 00-2 2v1m2 13a2 2 0 01-2-2V7m2 13c3.314 0 6-2.686 6-6V9a6 6 0 00-6-6H9a6 6 0 00-6 6v8a6 6 0 006 6z"></path>
            </svg>
            <p>请上传docx+yaml配置文件，点击「生成节点JSON」获取节点数据</p>
            <p class="init-sub-tip">生成后可修改标签，再执行「格式校验」或「自动格式化」，支持直接下载结果文件</p>
          </div>

          <!-- 加载中 -->
          <div v-if="isLoading" class="loading-tip">
            <div class="loading-spinner"></div>
            <p>{{ loadingText }}</p>
          </div>
        </div>
      </div>

      <!-- 节点详情区 -->
      <div class="node-detail-section">
        <div class="card detail-card">
          <h2 class="detail-title">节点详情</h2>
          <!-- 未选择节点提示 -->
          <div v-if="selectedNodeIndex === -1" class="no-select-tip">
            <svg class="no-select-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p>生成节点数据后，点击左侧节点查看/修改详情</p>
          </div>

          <!-- 节点详情内容 -->
          <div v-else v-if="currentNode" class="node-detail-content">
            <!-- 固定信息 -->
            <div class="property-card">
              <div class="property-card-header">固定信息（不可修改）</div>
              <div class="property-card-body">
                <div class="property-item">
                  <div class="property-label">节点序号</div>
                  <div class="property-value">{{ selectedNodeIndex + 1 }}/{{ nodeData.length }}</div>
                </div>
                <div class="property-item">
                  <div class="property-label">节点状态</div>
                  <div
                      class="property-value status-value"
                      :class="{
                      'status-other': currentNode.category === 'other',
                      'status-error': checkTagError(currentNode) && currentNode.category !== 'other',
                      'status-normal': !checkTagError(currentNode) && currentNode.category !== 'other'
                    }"
                  >
                    <template v-if="currentNode.category === 'other'">🔖 标记跳过（后端将忽略）</template>
                    <template v-else-if="checkTagError(currentNode)">❌ 疑似标签错误（得分低于阈值）</template>
                    <template v-else>✅ 正常节点（得分高于阈值）</template>
                  </div>
                </div>
                <div class="property-item">
                  <div class="property-label">节点层级</div>
                  <div class="property-value flex items-center">
                    <div class="level-dot mr-2" :style="{ backgroundColor: getLevelColor(currentNode) }"></div>
                    {{ currentNode.category === 'other' ? '标记层级（无缩进）' : `层级 ${LEVEL_MAP[currentNode.category] || 6} (配置映射)` }}
                  </div>
                </div>
                <div class="property-item">
                  <div class="property-label">节点内容</div>
                  <div class="property-value content-value">{{ currentNode.paragraph }}</div>
                </div>
                <div class="property-item">
                  <div class="property-label">置信度得分</div>
                  <div class="property-value">{{ currentNode.score.toFixed(4) }}（判定阈值：{{ SCORE_THRESHOLD }}）</div>
                </div>
                <div class="property-item">
                  <div class="property-label">节点指纹</div>
                  <div class="property-value fingerprint-value">{{ currentNode.fingerprint || '[无指纹]' }}</div>
                </div>
                <div class="property-item">
                  <div class="property-label">节点注释</div>
                  <div class="property-value">{{ currentNode.comment || '[无注释]' }}</div>
                </div>
              </div>
            </div>

            <!-- 可变信息 -->
            <div class="property-card mt-4">
              <div class="property-card-header">可变信息（仅标签可修改）</div>
              <div class="property-card-body">
                <div class="property-item">
                  <div class="property-label">
                    当前分类标签
                    <span class="label-tip">(hover查看标签说明)</span>
                  </div>
                  <select
                      class="category-select"
                      v-model="currentNode.category"
                      @change="handleCategoryChange"
                  >
                    <option
                        v-for="(desc, key) in CATEGORY_CONFIG"
                        :key="key"
                        :value="key"
                        :title="desc"
                    >
                      {{ key.replace(/_/g, ' ') }}
                    </option>
                  </select>
                </div>
                <div
                    class="check-result"
                    :class="{
                    'result-other': currentNode.category === 'other',
                    'result-error': checkTagError(currentNode) && currentNode.category !== 'other',
                    'result-normal': !checkTagError(currentNode) && currentNode.category !== 'other'
                  }"
                >
                  <template v-if="currentNode.category === 'other'">📌 已标记为跳过：后端处理时直接忽略该节点（防止误删）</template>
                  <template v-else-if="checkTagError(currentNode)">❌ 疑似标签错误：得分({{ currentNode.score.toFixed(4) }}) ＜ 阈值({{ SCORE_THRESHOLD }})</template>
                  <template v-else>✅ 标签匹配正常：得分({{ currentNode.score.toFixed(4) }}) ≥ 阈值({{ SCORE_THRESHOLD }})</template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, computed, watch} from 'vue'
// import axios from "axios";
import {save} from '@tauri-apps/plugin-dialog'; // 对话框插件
import {writeFile} from '@tauri-apps/plugin-fs'; // 文件系统插件（写入二进制文件）

/************************** 核心配置区 **************************/
const CATEGORY_CONFIG = {
  "abstract_chinese_title": "仅当段落是“摘要”或“摘 要”（允许尾随空格或冒号）",
  "abstract_chinese_title_content": "当且仅当摘要和正文在一个段落中",
  "abstract_english_title": "仅当段落是“Abstract”（大小写不敏感，允许尾随空格或冒号）",
  "abstract_english_title_content": "当且仅当摘要和正文在一个段落中",
  "keywords_chinese": "包含“关键词”或“关键字”，后面跟着术语列表",
  "keywords_english": "包含“Keywords”（大小写不敏感），后面跟着英文术语",
  "chinese_title": "论文中文题目（通常简短且无编号）",
  "english_title": "论文英文题目（通常简短且无编号）",
  "heading_level_1": "段落必须以“第X章”或单个阿拉伯数字（如“1”“2”）开头，后接空格和标题文字；仅为名词短语",
  "heading_level_2": "段落必须以“X.Y”格式开头（如“1.1”），仅含一个“.”；后接标题文字无完整句子",
  "heading_level_3": "段落必须以“X.Y.Z”格式开头（如“1.1.1”），仅含两个“.”；后接标题文字无完整句子",
  "heading_fulu": "段落等于“附录”",
  "references_title": "段落等于“参考文献”或“References”",
  "acknowledgements_title": "段落和“致谢”或“Acknowledgements”等词意思相近",
  "caption_figure": "以“图 X.Y”或“Figure X.Y”开头的图注",
  "caption_table": "以“表 X.Y”或“Table X.Y”开头的表注",
  "body_text": "包含完整句子、谓语动词/句号；或含“本章/本文”等明确论述的内容",
  "other": "标记跳过：后端处理时直接忽略该节点（防止误删，仅标记）"
};

const LEVEL_MAP = {
  "chinese_title": 1,
  "english_title": 1,
  "abstract_chinese_title": 1,
  "abstract_english_title": 1,
  "keywords_chinese": 2,
  "keywords_english": 2,
  "references_title": 1,
  "acknowledgements_title": 1,
  "heading_fulu": 1,
  "heading_level_1": 1,
  "heading_level_2": 2,
  "heading_level_3": 3,
  "abstract_chinese_title_content": 1,
  "abstract_english_title_content": 1,
  "caption_figure": 5,
  "caption_table": 5,
  "body_text": 5,
  "other": 5
};

const LEVEL_COLORS = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#9ca3af'];
const SCORE_THRESHOLD = 0.8;
// 后端接口地址（与后端SERVER_HOST保持一致）
const API_BASE_URL = 'http://127.0.0.1:8000';
/************************** 配置区结束 **************************/

/************************** 响应式数据 **************************/
const nodeData = ref([])
const selectedNodeIndex = ref(-1)
const searchTerm = ref('')
const isLoading = ref(false)
const isFileLoaded = ref(false)
// 接口上传相关
const docxFile = ref(null)
const yamlFile = ref(null)
const docxTipText = ref('未选择docx')
const yamlTipText = ref('未选择yaml')
const loadingText = ref('正在解析数据...')
/************************** 计算属性 **************************/
const currentNode = computed(() => {
  if (selectedNodeIndex.value === -1 || !nodeData.value.length) return null
  return nodeData.value[selectedNodeIndex.value]
})

const filteredNodeData = computed(() => {
  if (!nodeData.value.length || !searchTerm.value.trim()) return nodeData.value
  const term = searchTerm.value.trim().toLowerCase()
  return nodeData.value.filter(node =>
      node.paragraph.toLowerCase().includes(term) ||
      node.category.toLowerCase().includes(term) ||
      (node.comment && node.comment.toLowerCase().includes(term))
  )
})

const nodeCount = computed(() => nodeData.value.length)
const errorCount = computed(() => nodeData.value.filter(checkTagError).length)
const otherCount = computed(() => nodeData.value.filter(item => item.category === 'other').length)

// 格式化当前nodeData为后端需要的json字符串
const nodeDataToJson = computed(() => {
  return JSON.stringify(nodeData.value, null, 2)
})
/************************** 核心方法 **************************/
// 处理docx/yaml文件选择
const handleDocxChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  docxFile.value = file
  docxTipText.value = `已选择：${file.name}`
}
const handleYamlChange = (e) => {
  const file = e.target.files[0]
  if (!file) return
  yamlFile.value = file
  yamlTipText.value = `已选择：${file.name}`
}

// 1. 调用/generate-json：生成节点JSON
const callGenerateJsonApi = async () => {
  isLoading.value = true
  loadingText.value = '正在上传文件并生成节点JSON...（生成较慢，请勿刷新）'
  isFileLoaded.value = false
  selectedNodeIndex.value = -1
  const currentDocx = docxFile.value
  const currentYaml = yamlFile.value

  try {
    const formData = new FormData();
    formData.append('docx_file', currentDocx);
    formData.append('config_file', currentYaml);

    const response = await fetch(`${API_BASE_URL}/generate-json`, {
      method: 'POST',
      body: formData,
      timeout: 300_000,
      headers: {
        'Accept': 'application/json',
      }
    });

    let result = await response.json();
    console.log('接口返回数据：', result)
    if (result.code !== 200) throw new Error(result.msg || '接口返回异常');
    validateNodeData(result.data.json_data);
    nodeData.value = JSON.parse(JSON.stringify(result.data.json_data));
    isFileLoaded.value = true;

    alert(`✅ 节点JSON生成成功！
📁 生成文件名：${result.data.json_filename}
📊 共${nodeCount.value}个节点，可开始修改标签后执行校验/格式化`);
  } catch (err) {
    handleApiError(err, currentDocx, currentYaml);
  } finally {
    isLoading.value = false;
  }
}

// 2. 调用/check-format：仅执行格式校验（生成标注版docx）
const callCheckFormatApi = async () => {
  await callFormatRelatedApi('check-format', '格式校验', '生成标注版文档');
}

// 3. 调用/apply-format：执行自动格式化（生成修改版docx）
const callApplyFormatApi = async () => {
  await callFormatRelatedApi('apply-format', '自动格式化', '生成修改版文档');
}

// 通用格式操作接口（复用校验/格式化逻辑，减少冗余）
const callFormatRelatedApi = async (apiPath, apiName, desc) => {
  if (!confirm(`⚠️ 确认执行【${apiName}】？
当前修改后的标签将同步传给后端，生成${desc}。
执行过程中请勿刷新页面！`)) return;

  isLoading.value = true
  loadingText.value = `正在执行${apiName}...请稍候（生成文件较慢）`
  const currentDocx = docxFile.value
  const currentYaml = yamlFile.value

  try {
    // 1. 调用后端接口生成文件
    const formData = new FormData();
    formData.append('docx_file', currentDocx);
    formData.append('config_file', currentYaml);
    formData.append('json_data', nodeDataToJson.value);

    // 注意：Tauri 2.x 中也可直接用原生 fetch，或插件版 fetch，效果一致
    const response = await fetch(`${API_BASE_URL}/${apiPath}`, {
      method: 'POST',
      body: formData,
      timeout: 300000,
    });

    const result = await response.json();
    if (result.code !== 200) throw new Error(result.msg || `${apiName}失败`);

    // 2. 解构后端返回的下载链接和文件名
    const {download_url, final_filename} = result.data;

    // 3. Tauri 2.x 核心：弹出“另存为”对话框，让用户选择保存路径
    const filePath = await save({
      title: `保存${apiName === '格式校验' ? '标注版' : '修改版'}文档`,
      defaultPath: final_filename, // 默认文件名（比如“论文--标注版.docx”）
      filters: [
        {
          name: 'Word 文档',
          extensions: ['docx'] // 只允许选择/保存 docx 文件
        }
      ]
    });

    // 如果用户取消选择路径，返回并提示
    if (!filePath) {
      alert(`✅ ${apiName}执行成功！
📌 你已取消保存，可手动访问以下链接下载：
${download_url}`);
      isLoading.value = false;
      return;
    }

    // 4. Tauri 2.x：通过 HTTP 插件获取文件二进制流
    loadingText.value = '正在下载文件并保存到指定位置...';
    const fileResponse = await fetch(download_url, {
      method: 'GET',
      responseType: 'arraybuffer' // 直接获取二进制数组（适配 2.x）
    });

    // 5. Tauri 2.x：将二进制流写入用户指定的路径
    const arrayBuffer = await fileResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    await writeFile(filePath, uint8Array);

    // 6. 保存成功提示
    alert(`✅ ${apiName}并保存成功！
📁 保存路径：${filePath}
💡 可直接打开该文件查看结果`);

  } catch (err) {
    // 原有错误处理逻辑不变
    handleApiError(err, currentDocx, currentYaml);
  } finally {
    isLoading.value = false;
  }
}

// 通用API错误处理（复用所有接口的错误提示和文件状态保留）
const handleApiError = (err, currentDocx, currentYaml) => {
  // 1. 先对 err 本身做空值保护
  if (!err) {
    alert('执行失败：未知错误');
    console.error('handleApiError 接收的 err 为 undefined');
    return;
  }

  // 2. 对 err.message 做空值保护，避免调用 includes 时报错
  const errorMsg = err.message || '未知错误';

  // 3. 安全调用 includes 方法
  if (errorMsg.includes('超时')) {
    alert('请求超时，请检查网络或重试！');
  } else if (errorMsg.includes('404') || errorMsg.includes('500')) {
    alert(`接口请求失败：${errorMsg}\n请检查后端服务是否正常运行`);
  } else if (errorMsg.includes('取消')) {
    alert('操作已取消');
  } else {
    alert(`执行失败：${errorMsg}`);
  }

  // 4. 可选：重置 loading 状态（避免异常后 loading 一直显示）
  isLoading.value = false;
  loadingText.value = '';

  // 5. 可选：打印详细错误日志，方便排查
  console.error('API 错误详情：', err);

  // 保留文件选择状态，无需重新上传
  docxFile.value = currentDocx;
  yamlFile.value = currentYaml;
  docxTipText.value = currentDocx ? `已选择：${currentDocx.name}` : '未选择docx';
  yamlTipText.value = currentYaml ? `已选择：${currentYaml.name}` : '未选择yaml';
}

// 节点操作相关
const selectNode = (index) => {
  selectedNodeIndex.value = index
}
const handleCategoryChange = () => {
}
const checkAllTags = () => {
  alert(`标签核对完成！
✅ 总节点数：${nodeCount.value}
❌ 疑似错误节点：${errorCount.value} 个（得分＜${SCORE_THRESHOLD}）
📌 标记跳过节点：${otherCount.value} 个（后端忽略）
请修改错误标签后，执行【格式校验】或【自动格式化】！`)
}

// 导出修改后的JSON
const exportModifiedJson = () => {
  try {
    const jsonStr = JSON.stringify(nodeData.value, null, 2)
    const blob = new Blob([jsonStr], {type: 'application/json; charset=utf-8'})
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    const date = new Date().toLocaleDateString().replace(/\//g, '-')
    a.download = `修改后节点数据_${date}.json`
    a.click()
    URL.revokeObjectURL(blobUrl)

    alert(`✅ 导出成功！
📁 文件名：修改后节点数据_${date}.json
📊 总节点${nodeCount.value}个，${otherCount.value}个标记为跳过
💡 保留所有原始字段，仅更新category字段！`)
  } catch (e) {
    alert(`❌ 导出失败：${e.message}`)
  }
}

/************************** 工具方法 **************************/
const validateNodeData = (data) => {
  if (!Array.isArray(data)) throw new Error('数据必须是JSON数组')
  if (data.length === 0) throw new Error('JSON数组不能为空')

  const validCategories = Object.keys(CATEGORY_CONFIG)
  data.forEach((item, index) => {
    const idx = index + 1
    if (!item.hasOwnProperty('category')) throw new Error(`第${idx}个节点缺失「category」字段`)
    if (!item.hasOwnProperty('paragraph')) throw new Error(`第${idx}个节点缺失「paragraph」字段`)
    if (!item.hasOwnProperty('score')) throw new Error(`第${idx}个节点缺失「score」字段`)
    if (typeof item.category !== 'string' || item.category.trim() === '') throw new Error(`第${idx}个节点「category」必须为非空字符串`)
    if (typeof item.score !== 'number' || item.score < 0 || item.score > 1) throw new Error(`第${idx}个节点「score」必须为0-1之间的数字`)
    if (!validCategories.includes(item.category.trim())) throw new Error(`第${idx}个节点「category」为非法值：${item.category}`)
  })
}

const checkTagError = (node) => {
  return node.score < SCORE_THRESHOLD
}
const getNodeIndent = (node) => {
  const nodeLevel = LEVEL_MAP[node.category] || 6
  return nodeLevel === 6 ? '0px' : `${(nodeLevel - 1) * 24}px`
}
const getLevelColor = (node) => {
  const nodeLevel = LEVEL_MAP[node.category] || 6
  return LEVEL_COLORS[Math.min(nodeLevel - 1, 5)]
}
const highlightSearchText = (text) => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return text
  const regex = new RegExp(`(${term})`, 'gi')
  return text.split(regex).map(part =>
      part.toLowerCase() === term ? `<span class="search-highlight">${part}</span>` : part
  ).join('')
}

/************************** 监听事件 **************************/
let searchTimeout = null
watch(searchTerm, (newVal) => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
  }, 300)
}, {immediate: false})
</script>

<!-- 样式：新增校验/格式化按钮样式，其余保留 -->
<style>
/* 引入Tailwind CSS */
@import url('https://cdn.tailwindcss.com');

/* 基础重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f9fafb;
  min-height: 100vh;
}

/* 组件容器 */
.doc-tag-check-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 顶部导航栏 */
.header-bar {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  z-index: 20;
  padding: 0.5rem 1rem;
  height: 70px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.tool-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.stats-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* 接口上传组样式 */
.api-upload-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* 新增：格式操作按钮组 */
.format-btn-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* 按钮样式：新增警告/成功按钮，匹配校验/格式化场景 */
.btn {
  padding: 3px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn:hover {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
}

.primary-btn {
  background-color: #3b82f6;
  color: #ffffff;
  border-color: #3b82f6;
}

.primary-btn:hover {
  background-color: #2563eb;
}

/* 格式校验按钮（警告色） */
.warning-btn {
  background-color: #f59e0b;
  color: #ffffff;
  border-color: #f59e0b;
}

.warning-btn:hover {
  background-color: #d97706;
}

/* 自动格式化按钮（成功色） */
.success-btn {
  background-color: #10b981;
  color: #ffffff;
  border-color: #10b981;
}

.success-btn:hover {
  background-color: #059669;
}

.file-btn {
  background-color: #f8fafc;
  border-color: #cbd5e1;
}

.file-btn:hover {
  background-color: #f1f5f9;
}

.file-input-hidden {
  display: none;
}

.file-tip {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
}

/* 搜索框 */
.search-box {
  position: relative;
  width: 18rem;
  max-width: 100%;
}

.search-input {
  width: 100%;
  padding: 6px 8px 6px 28px;
  font-size: 13px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  outline: none;
  transition: all 0.2s ease;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.search-input:disabled {
  background-color: #f9fafb;
  cursor: not-allowed;
}

.search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: #9ca3af;
}

/* 主内容区 */
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

/* 卡片通用样式 */
.card {
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 节点详情区 */
.node-detail-section {
  margin-left: auto;
}

.detail-card {
  position: sticky;
  top: 70px;
  max-height: calc(100vh - 110px);
  min-height: auto;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 节点列表区 */
.node-list-section {
  width: 100%;
  flex: 1;
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  overflow-y: auto;
  flex: 1;
  min-height: calc(100vh - 110px);
}

/* 节点项样式 */
.node-item {
  position: relative;
  margin: 2px 0;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 4px 8px;
  cursor: pointer;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.node-item:hover {
  background-color: #f1f5f9;
}

.node-item.error {
  background-color: #fef2f2;
  border-left: 3px solid #ef4444;
}

.node-item.other {
  background-color: #f5f5f5;
  border-left: 3px solid #9ca3af;
  opacity: 0.8;
}

.node-item.selected {
  background-color: #dbeafe;
  border-left: 3px solid #3b82f6;
  opacity: 1;
}

.level-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.node-tag {
  min-width: 140px;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  color: #1f2937;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.node-score {
  min-width: 60px;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  background: #dcfce7;
  color: #166534;
  text-align: center;
  flex-shrink: 0;
}

.node-content {
  flex: 1;
  font-size: 13px;
  color: #1f2937;
  word-break: break-all;
  line-height: 1.4;
}

.node-meta {
  font-size: 11px;
  color: #64748b;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
  white-space: nowrap;
}

.node-fingerprint {
  font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
}

/* 提示样式 */
.init-tip, .loading-tip, .empty-tip, .no-select-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #6b7280;
  gap: 0.75rem;
  padding: 6rem 0;
}

.init-icon, .no-select-icon {
  width: 48px;
  height: 48px;
  color: #d1d5db;
}

.init-sub-tip {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 0.25rem;
  text-align: center;
  line-height: 1.5;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #e5e7eb;
  border-radius: 50%;
  border-top-color: #3b82f6;
  animation: spin 1s ease-in-out infinite;
}

.empty-tip {
  font-size: 13px;
}

/* 节点详情内部样式 */
.detail-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1rem;
}

.node-detail-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
}

.property-card {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.property-card-header {
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 500;
  background-color: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  color: #1f2937;
}

.property-card-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.property-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.property-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
}

.label-tip {
  font-size: 11px;
  font-weight: 400;
  color: #9ca3af;
}

.property-value {
  font-size: 13px;
  color: #1f2937;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  line-height: 1.4;
  word-break: break-all;
}

.content-value {
  max-height: 8rem;
  overflow-y: auto;
  word-break: break-all;
}

.fingerprint-value {
  font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}

.status-value {
  border: none;
  padding: 6px 8px;
}

.status-normal {
  background-color: #dcfce7;
  color: #166534;
}

.status-error {
  background-color: #fee2e2;
  color: #dc2626;
}

.status-other {
  background-color: #e5e7eb;
  color: #4b5563;
}

.category-select {
  width: 100%;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  margin: 4px 0;
  min-width: 100%;
  box-sizing: border-box;
}

.category-select:focus {
  outline: 1px solid #3b82f6;
  border-color: #3b82f6;
}

.check-result {
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
  margin-top: 8px;
}

.result-normal {
  background-color: #dcfce7;
  color: #166534;
}

.result-error {
  background-color: #fee2e2;
  color: #dc2626;
}

.result-other {
  background-color: #e5e7eb;
  color: #4b5563;
}

/* 搜索高亮 */
.search-highlight {
  background-color: #fef3c7;
  color: #92400e;
  padding: 0 2px;
  border-radius: 2px;
}

/* 动画 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 标签专属背景色 */
.node-tag.other {
  background: #d1d5db;
  color: #4b5563;
  font-weight: 500;
}

.node-tag.abstract_chinese_title {
  background: #f0fdf4;
}

.node-tag.abstract_chinese_title_content {
  background: #f0f9ff;
}

.node-tag.abstract_english_title {
  background: #fdf2f8;
}

.node-tag.abstract_english_title_content {
  background: #fef7fb;
}

.node-tag.keywords_chinese {
  background: #fef3c7;
}

.node-tag.keywords_english {
  background: #fee7e6;
}

.node-tag.chinese_title {
  background: #e0f2fe;
}

.node-tag.english_title {
  background: #e6f7ef;
}

.node-tag.heading_level_1 {
  background: #e8e4fb;
}

.node-tag.heading_level_2 {
  background: #f3e8ff;
}

.node-tag.heading_level_3 {
  background: #f5e7ff;
}

.node-tag.heading_fulu {
  background: #e2e8f0;
}

.node-tag.references_title {
  background: #cffafe;
}

.node-tag.acknowledgements_title {
  background: #dcfce7;
}

.node-tag.caption_figure {
  background: #f1f5f9;
}

.node-tag.caption_table {
  background: #e2e8f0;
}

.node-tag.body_text {
  background: #f8fafc;
}

/* 响应式适配 */
@media (max-width: 992px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .detail-card {
    position: static;
    max-height: none;
    min-height: 300px;
  }

  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .search-box {
    width: 100%;
  }

  .api-upload-group, .format-btn-group {
    width: 100%;
  }
}
</style>