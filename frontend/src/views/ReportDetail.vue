<template>
  <div>
    <el-page-header @back="$router.push('/reports')" title="返回检查列表" :content="report?.title || '报告详情'" style="margin-bottom:16px" />
    <el-card v-if="report" v-loading="loading">
      <!-- Status banner -->
      <el-alert v-if="report.status === 'ai_processing'" type="warning" title="AI 正在识别检查单内容，请稍候..." :closable="false" style="margin-bottom:16px">
        <template #default>数据将在识别完成后自动展示，您可以刷新页面查看最新状态。</template>
      </el-alert>
      <el-alert v-if="report.status === 'review_needed'" type="info" title="AI 识别完成，请复核并确认数据" :closable="false" style="margin-bottom:16px" />
      <el-alert v-if="report.status === 'failed'" type="error" title="AI 识别失败" :closable="false" style="margin-bottom:16px" />

      <!-- Image + Metadata row -->
      <el-row :gutter="20" style="margin-bottom:20px">
        <el-col :span="8">
          <el-image v-if="report.image_url" :src="report.image_url" fit="contain"
            style="width:100%;max-height:400px;border-radius:8px;border:1px solid #e4e7ed;cursor:pointer"
            :preview-src-list="[report.image_url]" preview-teleported />
          <div v-else style="width:100%;height:300px;background:#f5f7fa;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#c0c4cc">
            <div style="text-align:center"><el-icon size="48"><Picture /></el-icon><div style="margin-top:8px">无原始图片</div></div>
          </div>
        </el-col>
        <el-col :span="16">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="检查日期">{{ report.report_date }}</el-descriptions-item>
            <el-descriptions-item label="检查类型">
              <el-tag :type="report.report_type === 'biochemical' ? 'primary' : 'success'">{{ report.report_type === 'biochemical' ? '生化检查' : '影像检查' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="医院">{{ report.hospital_name || '—' }}</el-descriptions-item>
            <el-descriptions-item label="科室">{{ report.department || '—' }}</el-descriptions-item>
            <el-descriptions-item label="识别状态">
              <el-tag :type="statusTagType(report.status)">{{ statusMap[report.status] || report.status }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="上传时间">{{ report.created_at || '—' }}</el-descriptions-item>
          </el-descriptions>
        </el-col>
      </el-row>

      <el-divider />

      <!-- Biochemical Indicators -->
      <div v-if="report.report_type === 'biochemical'">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="margin:0">生化指标 ({{ report.indicators?.length || 0 }} 项)</h3>
          <el-button v-if="report.indicators?.length && report.status !== 'confirmed'" type="primary" size="small" @click="confirmReport">
            确认数据
          </el-button>
        </div>
        <el-table v-if="report.indicators?.length" :data="report.indicators" stripe border>
          <el-table-column prop="indicator_name" label="指标名称" min-width="150" />
          <el-table-column prop="indicator_code" label="代码" width="80">
            <template #default="{row}"><el-tag v-if="row.indicator_code" size="small" type="info">{{ row.indicator_code }}</el-tag><span v-else>—</span></template>
          </el-table-column>
          <el-table-column prop="value" label="数值" width="100" align="right">
            <template #default="{row}"><span :style="{ color: row.is_abnormal ? '#f56c6c' : '#303133', fontWeight: row.is_abnormal ? 'bold' : 'normal' }">{{ row.value }}</span></template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="80" />
          <el-table-column label="参考范围" min-width="170">
            <template #default="{row}">
              {{ row.reference_range_text || (row.reference_range_low != null ? `${row.reference_range_low} — ${row.reference_range_high}` : '—') }}
            </template>
          </el-table-column>
          <el-table-column label="异常" width="70" align="center">
            <template #default="{row}">
              <el-tag v-if="row.is_abnormal" :type="row.abnormality_direction === 'high' ? 'danger' : 'warning'" size="small">
                {{ row.abnormality_direction === 'high' ? '↑ 偏高' : '↓ 偏低' }}
              </el-tag>
              <span v-else style="color:#67c23a">正常</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else-if="report.status === 'uploaded' || report.status === 'ai_processing'"
          description="AI 正在识别中，请稍后刷新页面查看结果" />
        <el-empty v-else description="未识别到生化指标数据" />
      </div>

      <!-- Imaging Findings -->
      <div v-if="report.report_type === 'imaging'">
        <h3>影像发现 ({{ report.findings?.length || 0 }} 项)</h3>
        <el-card v-for="f in report.findings" :key="f.id" style="margin-bottom:12px;border-left:4px solid #409eff">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div><strong>{{ f.body_part }}</strong></div>
            <el-tag size="small">{{ f.modality }}</el-tag>
          </div>
          <div style="color:#303133;margin-bottom:8px;line-height:1.8;white-space:pre-wrap">{{ f.finding }}</div>
          <div v-if="f.impression" style="padding:12px;background:#f0f9ff;border-radius:4px;border-left:3px solid #409eff">
            <span style="color:#909399;font-size:12px">印象/诊断：</span>
            <span style="color:#303133;font-weight:500">{{ f.impression }}</span>
          </div>
        </el-card>
        <el-empty v-if="!report.findings?.length && report.status !== 'uploaded' && report.status !== 'ai_processing'"
          description="未识别到影像发现数据" />
        <el-empty v-if="report.status === 'uploaded' || report.status === 'ai_processing'"
          description="AI 正在识别中，请稍后刷新页面查看结果" />
      </div>

      <div v-if="report.status === 'failed'" style="margin-top:16px">
        <el-result icon="error" title="AI 识别失败" sub-title="请重新上传检查单图片">
          <template #extra>
            <el-button type="primary" @click="$router.push('/reports/upload')">重新上传</el-button>
            <el-button @click="loadReport">刷新状态</el-button>
          </template>
        </el-result>
      </div>
      <div v-if="report.status === 'ai_processing'" style="margin-top:16px;text-align:center">
        <el-button @click="loadReport" :loading="loading">🔄 刷新查看识别结果</el-button>
        <div style="color:#909399;font-size:12px;margin-top:4px">AI 正在分析中，点击刷新查看最新状态</div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const route = useRoute();
const report = ref(null), loading = ref(false);
const statusMap = { uploaded: '已上传', ai_processing: 'AI正在识别...', processed: '已识别', review_needed: '待复核', confirmed: '已确认', failed: '识别失败' };

function statusTagType(s) {
  return s === 'confirmed' ? 'success' : s === 'failed' ? 'danger' : s === 'ai_processing' ? 'warning' : s === 'processed' ? 'primary' : 'info';
}

async function loadReport() {
  loading.value = true;
  try {
    const { data } = await api.get(`/reports/${route.params.id}`);
    report.value = data;
  } finally { loading.value = false; }
}

async function confirmReport() {
  try {
    await api.put(`/reports/${route.params.id}`, {});
    ElMessage.success('数据已确认');
    loadReport();
  } catch {}
}

onMounted(loadReport);
</script>
