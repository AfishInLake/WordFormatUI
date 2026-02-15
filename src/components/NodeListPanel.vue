<!-- src/components/NodeListPanel.vue -->
<template>
  <div class="node-list-section">
    <div class="card">
      <div v-if="isLoading" class="loading-tip">
        <div class="loading-spinner"></div>
        <p>{{ loadingText }}</p>
      </div>

      <div v-else-if="!isFileLoaded" class="init-tip">
        <svg class="init-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9m-5 13h14a2 2 0 002-2V9a2 2 0 00-2-2h-2.586a1 1 0 01-.707-.293l-2.414-2.414a1 1 0 00-.707-.293H11a2 2 0 00-2 2v1m2 13a2 2 0 01-2-2V7m2 13c3.314 0 6-2.686 6-6V9a6 6 0 00-6-6H9a6 6 0 00-6 6v8a6 6 0 006 6z"></path>
        </svg>
        <p>请上传docx+yaml配置文件，点击「生成节点JSON」获取节点数据</p>
        <p class="init-sub-tip">生成后可修改标签，再执行「格式校验」或「自动格式化」，支持直接下载结果文件</p>
      </div>

      <div v-else class="node-list">
        <div v-if="nodeData.length === 0" class="empty-tip">无匹配的节点</div>
        <div
            v-for="(node, index) in nodeData"
            :key="index"
            class="node-item"
            :class="{
            error: checkTagError(node),
            other: node.category === 'other',
            selected: selectedIndex === index
          }"
            :style="{ marginLeft: getNodeIndent(node) }"
            @click="$emit('select-node', index)"
        >
          <div class="level-dot" :style="{ backgroundColor: getLevelColor(node) }"></div>
          <div class="node-tag" :class="node.category">
            {{ node.category.replace(/_/g, ' ') }}
          </div>
          <div class="node-score">{{ node.score.toFixed(4) }}</div>
          <div class="node-content" v-html="highlightSearchText(node.paragraph, globalSearchTerm)"></div>
          <div class="node-meta">
            <span class="node-comment">{{ node.comment || '无注释' }}</span>
            <span class="node-fingerprint">{{ node.fingerprint?.slice(0, 8) || '无' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { checkTagError, getNodeIndent, getLevelColor, highlightSearchText } from '@/composables/useTagHelpers'

defineProps({
  nodeData: Array,
  selectedIndex: Number,
  isFileLoaded: Boolean,
  isLoading: Boolean,
  loadingText: String,
  globalSearchTerm: String
})

defineEmits(['select-node'])
</script>

<style scoped>
.node-list-section { width: 100%; flex: 1; }
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
.node-list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  overflow-y: auto;
  flex: 1;
  min-height: calc(100vh - 110px);
}
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
.node-item:hover { background-color: #f1f5f9; }
.node-item.error { background-color: #fef2f2; border-left: 3px solid #ef4444; }
.node-item.other { background-color: #f5f5f5; border-left: 3px solid #9ca3af; opacity: 0.8; }
.node-item.selected { background-color: #dbeafe; border-left: 3px solid #3b82f6; opacity: 1; }
.level-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.node-tag {
  min-width: 140px;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
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
.init-tip, .loading-tip, .empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #6b7280;
  gap: 0.75rem;
  padding: 6rem 0;
}
.init-icon { width: 48px; height: 48px; color: #d1d5db; }
.init-sub-tip { font-size: 12px; color: #9ca3af; margin-top: 0.25rem; text-align: center; line-height: 1.5; }
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #e5e7eb;
  border-radius: 50%;
  border-top-color: #3b82f6;
  animation: spin 1s ease-in-out infinite;
}
.empty-tip { font-size: 13px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 标签背景色 */
.node-tag.other { background: #d1d5db; color: #4b5563; font-weight: 500; }
.node-tag.abstract_chinese_title { background: #f0fdf4; }
.node-tag.abstract_chinese_title_content { background: #f0f9ff; }
.node-tag.abstract_english_title { background: #fdf2f8; }
.node-tag.abstract_english_title_content { background: #fef7fb; }
.node-tag.keywords_chinese { background: #fef3c7; }
.node-tag.keywords_english { background: #fee7e6; }
.node-tag.chinese_title { background: #e0f2fe; }
.node-tag.english_title { background: #e6f7ef; }
.node-tag.heading_level_1 { background: #e8e4fb; }
.node-tag.heading_level_2 { background: #f3e8ff; }
.node-tag.heading_level_3 { background: #f5e7ff; }
.node-tag.heading_fulu { background: #e2e8f0; }
.node-tag.references_title { background: #cffafe; }
.node-tag.acknowledgements_title { background: #dcfce7; }
.node-tag.caption_figure { background: #f1f5f9; }
.node-tag.caption_table { background: #e2e8f0; }
.node-tag.body_text { background: #f8fafc; }

.search-highlight {
  background-color: #fef3c7;
  color: #92400e;
  padding: 0 2px;
  border-radius: 2px;
}
</style>