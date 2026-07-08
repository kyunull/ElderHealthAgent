<template>
  <span class="voice-input-wrapper">
    <el-button
      v-if="supported"
      :type="isRecording ? 'danger' : ''"
      size="small"
      @click="toggleRecording"
      class="voice-btn"
      :class="{ recording: isRecording }"
    >
      <span v-if="!isRecording">🎤 语音输入</span>
      <span v-else class="recording-text">🔴 点击停止</span>
    </el-button>
  </span>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

const emit = defineEmits(['update:modelValue', 'recognized']);
const props = defineProps({
  modelValue: { type: String, default: '' },
  lang: { type: String, default: 'zh-CN' },
  continuous: { type: Boolean, default: false }
});

const supported = ref(false);
const isRecording = ref(false);

let recognition = null;

onMounted(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    supported.value = true;
    recognition = new SpeechRecognition();
    recognition.lang = props.lang;
    recognition.interimResults = true;
    recognition.continuous = props.continuous;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        const newValue = props.modelValue
          ? props.modelValue + finalTranscript
          : finalTranscript;
        emit('update:modelValue', newValue);
        emit('recognized', finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        ElMessage.warning('请授权麦克风访问以使用语音输入');
      } else if (event.error !== 'aborted') {
        ElMessage.error(`语音识别出错: ${event.error}`);
      }
      isRecording.value = false;
    };

    recognition.onend = () => {
      isRecording.value = false;
    };
  }
});

onUnmounted(() => {
  if (recognition) {
    try { recognition.abort(); } catch {}
  }
});

function toggleRecording() {
  if (!recognition) return;
  if (isRecording.value) {
    recognition.stop();
    isRecording.value = false;
  } else {
    try {
      recognition.start();
      isRecording.value = true;
    } catch {
      isRecording.value = false;
    }
  }
}
</script>

<style scoped>
.voice-input-wrapper {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  flex-shrink: 0;
}
.voice-btn {
  border-radius: 8px;
  border-color: #d3d9de;
  font-size: 13px;
  padding: 5px 12px;
  white-space: nowrap;
}
.voice-btn.recording {
  animation: voice-pulse 1.2s infinite;
  border-color: #f56c6c;
}
.recording-text {
  font-weight: 600;
}
@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(245, 108, 108, 0); }
}
</style>
