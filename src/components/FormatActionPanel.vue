<!-- src/components/FormatActionPanel.vue -->
<template>
  <div class="format-btn-group">
    <button
        class="btn warning-btn"
        :disabled="isLoading"
        @click="$emit('check-format')"
    >
      执行格式校验
    </button>
    <button
        class="btn success-btn"
        :disabled="isLoading"
        @click="$emit('apply-format')"
    >
      执行自动格式化
    </button>
  </div>
</template>

<script setup>
defineProps({ isLoading: Boolean })
defineEmits(['check-format', 'apply-format'])
</script>

<style scoped>
.format-btn-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.warning-btn {
  background-color: #f59e0b;
  color: #ffffff;
  border-color: #f59e0b;
}
.warning-btn:hover {
  background-color: #d97706;
}
.success-btn {
  background-color: #10b981;
  color: #ffffff;
  border-color: #10b981;
}
.success-btn:hover {
  background-color: #059669;
}
</style>