<template>
  <div>
    <h2>上传检查单</h2>
    <el-card style="max-width:600px">
      <el-form label-width="100px">
        <el-form-item label="检查单图片" required>
          <el-upload :auto-upload="false" :on-change="handleFileChange" :limit="1" accept="image/jpeg,image/png,application/pdf"
            :before-upload="beforeUpload" drag>
            <el-icon style="font-size:48px"><UploadFilled /></el-icon>
            <div>将检查单图片拖到此处或点击上传</div>
            <template #tip><div style="font-size:12px;color:#999">支持 JPG/PNG/PDF，最大 20MB</div></template>
          </el-upload>
        </el-form-item>
        <el-form-item label="检查日期" required>
          <el-date-picker v-model="reportDate" type="date" placeholder="选择检查日期" value-format="YYYY-MM-DD" style="width:100%" />
        </el-form-item>
        <el-form-item label="检查类型" required>
          <el-select v-model="reportType" placeholder="选择检查类型" style="width:100%">
            <el-option label="生化检查" value="biochemical" />
            <el-option label="影像检查" value="imaging" />
          </el-select>
        </el-form-item>
        <el-form-item label="医院名称">
          <el-input v-model="hospitalName" placeholder="可选" />
        </el-form-item>
        <el-form-item label="科室">
          <el-input v-model="department" placeholder="可选" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleUpload" :loading="uploading" :disabled="!canUpload">
            {{ uploading ? '上传中...' : '开始识别' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="resultVisible" title="AI 识别中" width="500px">
      <el-result v-if="uploadResult" icon="success" title="上传成功">
        <template #sub-title>AI 正在识别检查单内容，请稍后在报告列表中查看结果</template>
        <template #extra>
          <el-button type="primary" @click="$router.push('/reports')">查看报告列表</el-button>
        </template>
      </el-result>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const file = ref(null);
const reportDate = ref('');
const reportType = ref('');
const hospitalName = ref('');
const department = ref('');
const uploading = ref(false);
const resultVisible = ref(false);
const uploadResult = ref(null);

const canUpload = computed(() => file.value && reportDate.value && reportType.value);

function beforeUpload(f) {
  const isLt20M = f.size / 1024 / 1024 < 20;
  if (!isLt20M) ElMessage.error('图片大小不能超过 20MB');
  return isLt20M;
}

function handleFileChange(f) { file.value = f.raw; }

async function handleUpload() {
  if (!canUpload.value) return;
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('image', file.value);
    formData.append('report_date', reportDate.value);
    formData.append('report_type', reportType.value);
    if (hospitalName.value) formData.append('hospital_name', hospitalName.value);
    if (department.value) formData.append('department', department.value);

    const { data } = await api.post('/reports/upload', formData);
    uploadResult.value = data;
    resultVisible.value = true;
  } catch { /* handled by interceptor */ }
  finally { uploading.value = false; }
}
</script>
