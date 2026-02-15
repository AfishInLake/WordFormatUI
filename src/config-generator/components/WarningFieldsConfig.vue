<template>
  <div class="warning-fields-config">
    <div class="grid grid-cols-3 gap-2">
      <div class="form-item">
        <label><input type="checkbox" v-model="config.bold"> 加粗</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.italic"> 斜体</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.underline"> 下划线</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.font_size"> 字号</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.font_name"> 字体名称</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.font_color"> 字体颜色</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.alignment"> 对齐方式</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.space_before"> 段前间距</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.space_after"> 段后间距</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.line_spacing"> 行距</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.line_spacingrule"> 行距类型</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.left_indent"> 文本之前</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.right_indent"> 文本之后</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.first_line_indent"> 段落首行缩进</label>
      </div>
      <div class="form-item">
        <label><input type="checkbox" v-model="config.builtin_style_name"> 内置样式名称</label>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.form-item {
  margin-bottom: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}

.form-item label {
  font-weight: 500;
  color: #555;
  font-size: 13px;
  white-space: nowrap;
}

.form-item input[type="checkbox"] {
  margin-right: 5px;
}

.grid {
  display: grid;
}

.grid-cols-3 {
  grid-template-columns: repeat(6, 1fr);
}

/* 大屏幕显示更多列 */
@media (min-width: 1024px) {
  .grid-cols-3 {
    grid-template-columns: repeat(7, 1fr);
  }
}

@media (min-width: 1200px) {
  .grid-cols-3 {
    grid-template-columns: repeat(8, 1fr);
  }
}

@media (min-width: 1600px) {
  .grid-cols-3 {
    grid-template-columns: repeat(9, 1fr);
  }
}

.gap-2 {
  gap: 8px;
}

.form-item {
  margin-bottom: 5px;
}

@media (max-width: 768px) {
  .grid-cols-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>