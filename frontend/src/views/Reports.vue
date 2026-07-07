<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>健康报告</h2>
      <el-button type="primary" @click="$router.push('/reports/upload')">上传检查单</el-button>
    </div>
    <el-card>
      <el-table :data="reports" stripe v-loading="loading">
        <el-table-column label="预览" width="90">
          <template #default="{ row }">
            <el-image v-if="row.image_url" :src="row.image_url" fit="cover"
              style="width:60px;height:80px;border-radius:4px;cursor:pointer"
              :preview-src-list="[row.image_url]" preview-teleported
              :initial-index="0" />
            <div v-else style="width:60px;height:80px;background:#f5f7fa;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#c0c4cc">
              <el-icon size="28"><Picture /></el-icon>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="report_date" label="检查日期" width="120" />
        <el-table-column prop="report_type" label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="row.report_type === 'biochemical' ? 'primary' : 'success'">{{ row.report_type === 'biochemical' ? '生化' : '影像' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hospital_name" label="医院" min-width="130" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusMap[row.status] || row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" @click="$router.push(`/reports/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top:16px;text-align:right">
        <el-pagination v-model:current-page="page" :total="total" :page-size="20" layout="prev, pager, next" @current-change="loadReports" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../api/index.js';

const reports = ref([]), loading = ref(false), page = ref(1), total = ref(0);
const statusMap = { uploaded: '已上传', ai_processing: 'AI识别中', processed: '已识别', review_needed: '待复核', confirmed: '已确认', failed: '失败' };
const statusType = s => s === 'confirmed' ? 'success' : s === 'failed' ? 'danger' : s === 'ai_processing' ? 'warning' : 'info';

async function loadReports() {
  loading.value = true;
  try {
    const { data } = await api.get('/reports', { params: { page: page.value, limit: 20 } });
    reports.value = data.data; total.value = data.total;
  } finally { loading.value = false; }
}

onMounted(loadReports);
</script>
