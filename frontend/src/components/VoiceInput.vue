<template>
  <span class="voice-input-wrapper">
    <el-button
      :type="isRecording ? 'danger' : 'default'"
      :disabled="!supported"
      circle
      size="small"
      @click="toggleRecording"
      :title="supported ? '语音输入' : '当前浏览器不支持语音识别'"
    >
      <span v-if="!isRecording">🎤</span>
      <span v-else class="recording-pulse">🔴</span>
    </el-button>
    <span v-if="isRecording" class="recording-hint">正在聆听...</span>
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
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
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
  gap: 4px;
  vertical-align: middle;
}
.recording-pulse {
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.recording-hint {
  font-size: 12px;
  color: #f56c6c;
  font-weight: 500;
}
</style>
