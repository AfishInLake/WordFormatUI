<!-- src/components/FileUploadPanel.vue -->
<template>
  <div class="api-upload-group">
    <label for="docx-file" class="btn file-btn cursor-pointer">选择docx</label>
    <input type="file" id="docx-file" accept=".docx" class="file-input-hidden" @change="onDocxChange" />
    <span class="file-tip">{{ docxTip }}</span>

    <!-- 只有在没有生成配置时才显示yaml文件选择 -->
    <template v-if="!generatedConfig">
      <label for="yaml-file" class="btn file-btn cursor-pointer ml-2">选择yaml</label>
      <input type="file" id="yaml-file" accept=".yaml,.yml" class="file-input-hidden" @change="onYamlChange" />
      <span class="file-tip">{{ yamlTip }}</span>
    </template>



    <button class="btn primary-btn" :disabled="!docxFile || (!yamlFile && !generatedConfig) || isLoading"
      @click="$emit('generate-json')">
      生成节点JSON
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import yaml from 'js-yaml';

const props = defineProps({
  docxFile: File,
  yamlFile: File,
  generatedConfig: Object,
  isLoading: Boolean
})

const emit = defineEmits(['update:docxFile', 'update:yamlFile', 'generate-json'])

const docxTip = computed(() => props.docxFile ? `已选择：${props.docxFile.name}` : '未选择docx')
const yamlTip = computed(() => props.yamlFile ? `已选择：${props.yamlFile.name}` : '未选择yaml')

const onDocxChange = (e) => emit('update:docxFile', e.target.files[0])
const onYamlChange = (e) => emit('update:yamlFile', e.target.files[0])
</script>

<style scoped>
.api-upload-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
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
</style>