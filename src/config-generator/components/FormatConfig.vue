<template>
  <div class="format-config">
    <div class="grid grid-cols-2 gap-4">
      <div class="form-item">
        <label>对齐方式:</label>
        <select v-model="config.alignment">
          <option v-for="option in alignmentOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="form-item">
        <label>段前间距:</label>
        <input type="text" v-model="config.space_before">
      </div>
      <div class="form-item">
        <label>段后间距:</label>
        <input type="text" v-model="config.space_after">
      </div>
      <div class="form-item">
        <label>行距类型:</label>
        <select v-model="config.line_spacingrule">
          <option v-for="option in lineSpacingRuleOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="form-item">
        <label>行距参数:</label>
        <input type="text" v-model="config.line_spacing">
      </div>
      <div class="form-item">
        <label>文本之前:</label>
        <input type="text" v-model="config.left_indent">
      </div>
      <div class="form-item">
        <label>文本之后:</label>
        <input type="text" v-model="config.right_indent">
      </div>
      <div class="form-item">
        <label>段落首行缩进:</label>
        <input type="text" v-model="config.first_line_indent">
      </div>
      <div class="form-item">
        <label>内置样式名称:</label>
        <input type="text" v-model="config.builtin_style_name">
      </div>
      <div class="form-item">
        <label>中文字体名称:</label>
        <select v-model="config.chinese_font_name">
          <option v-for="option in chineseFontOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="form-item">
        <label>英文字体名称:</label>
        <select v-model="config.english_font_name">
          <option v-for="option in englishFontOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="form-item">
        <label>字号:</label>
        <select v-model="config.font_size">
          <option v-for="option in fontSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="form-item">
        <label>字体颜色:</label>
        <input type="text" v-model="config.font_color">
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.bold"> 加粗</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.italic"> 斜体</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.underline"> 下划线</label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { 
  alignmentOptions, 
  lineSpacingRuleOptions, 
  chineseFontOptions, 
  englishFontOptions, 
  fontSizeOptions 
} from '../utils'

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.form-item {
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-item label {
  font-weight: 500;
  color: #555;
  font-size: 13px;
  white-space: nowrap;
  min-width: 80px;
}

.form-item input[type="text"],
.form-item input[type="number"],
.form-item select {
  width: 90px;
  min-width: 80px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

/* 复选框项特殊处理 */
.form-item:has(input[type="checkbox"]) {
  width: auto;
}

.form-item:has(input[type="checkbox"]) label {
  min-width: auto;
}

.form-item input[type="checkbox"] {
  margin-right: 5px;
}

.grid {
  display: grid;
}

.grid-cols-2 {
  grid-template-columns: repeat(4, 1fr);
}

/* 大屏幕显示更多列 */
@media (min-width: 1200px) {
  .grid-cols-2 {
    grid-template-columns: repeat(5, 1fr);
  }
}

@media (min-width: 1600px) {
  .grid-cols-2 {
    grid-template-columns: repeat(6, 1fr);
  }
}

.gap-4 {
  gap: 10px;
}

@media (max-width: 768px) {
  .grid-cols-2 {
    grid-template-columns: 1fr;
  }
  
  .form-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .form-item label {
    min-width: auto;
  }
  
  .form-item input[type="text"],
  .form-item input[type="number"],
  .form-item select {
    width: 120px;
  }
}
</style>