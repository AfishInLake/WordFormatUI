<template>
  <div class="config-section">
    <div class="section-header" @click="toggleSection">
      <h2>{{ title }}</h2>
      <span class="toggle-icon">{{ isExpanded ? '▼' : '▶' }}</span>
    </div>
    <div v-if="isExpanded" class="section-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  initialExpanded: {
    type: Boolean,
    default: true
  }
})

const isExpanded = ref(props.initialExpanded)

const toggleSection = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<style scoped>
.config-section {
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #f9f9f9;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #f0f0f0;
  cursor: pointer;
  transition: background-color 0.3s;
}

.section-header:hover {
  background-color: #e0e0e0;
}

.section-header h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.toggle-icon {
  font-size: 14px;
  color: #666;
}

.section-content {
  padding: 20px;
  border-top: 1px solid #e0e0e0;
}

.section-content h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #555;
}
</style>