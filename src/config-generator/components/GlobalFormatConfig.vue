<template>
  <div class="global-format-config">
    <FormatConfig :config="config" />
    <div v-if="showApplyButton" class="mt-4">
      <button @click="$emit('apply-to-all')" class="btn btn-primary">应用到所有配置</button>
    </div>
  </div>
</template>

<script setup>
import FormatConfig from './FormatConfig.vue'

const props = defineProps({
  config: {
    type: Object,
    required: true
  },
  showApplyButton: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['apply-to-all'])
</script>

<style scoped>
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

.mt-4 {
  margin-top: 16px;
}
</style>