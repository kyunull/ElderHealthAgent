<template>
  <div>
    <h2>健康趋势分析</h2>

    <el-alert v-if="!profileOk" type="warning" title="请先完善个人基础档案" show-icon :closable="false" style="margin-bottom:16px">
      <template #default>
        健康趋势分析需要您的基础信息（身高、体重、出生日期等）作为参考基线。
        <el-button type="warning" size="small" text @click="$router.push('/profile')">去完善档案 →</el-button>
      </template>
    </el-alert>

    <el-card style="margin-bottom:16px">
      <el-form :inline="true">
        <el-form-item label="选择指标">
          <el-select v-model="selectedIndicator" placeholder="请选择检验指标" @change="onIndicatorChange" clearable style="width:280px">
            <el-option v-for="i in indicators" :key="i.code" :label="`${i.name} (${i.code})`" :value="i.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-select v-model="period" @change="loadTrend" style="width:140px">
            <el-option label="1 个月" value="1m" /><el-option label="3 个月" value="3m" />
            <el-option label="6 个月" value="6m" /><el-option label="1 年" value="1y" />
            <el-option label="全部" value="all" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="selectedIndicator">
          <el-tag type="primary" size="large" closable @close="clearIndicator">
            {{ indicatorLabel(selectedIndicator) }}
          </el-tag>
        </el-form-item>
      </el-form>
    </el-card>

    <el-empty v-if="!selectedIndicator" description="请在上方选择检验指标查看趋势" />
    <el-empty v-else-if="!trendData" description="正在加载..." />
    <template v-else-if="trendData.data_points?.length">
      <el-row :gutter="16" style="margin-bottom:16px">
        <el-col :span="6" v-for="s in stats" :key="s.label">
          <el-card shadow="hover">
            <div style="text-align:center">
              <div style="color:#909399;font-size:13px">{{ s.label }}</div>
              <div style="font-size:24px;font-weight:bold;color:#409eff">{{ s.value }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      <el-card>
        <div ref="chartRef" style="height:400px"></div>
      </el-card>
    </template>
    <el-empty v-else description="该指标暂无历史数据" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import api from '../api/index.js';

const selectedIndicator = ref('');
const period = ref('6m');
const trendData = ref(null);
const chartRef = ref(null);
const profileOk = ref(true);
let chart = null;

const indicators = ref([
  { name: '空腹血糖', code: 'GLU' }, { name: '糖化血红蛋白', code: 'HbA1c' },
  { name: '谷丙转氨酶', code: 'ALT' }, { name: '谷草转氨酶', code: 'AST' },
  { name: '肌酐', code: 'CREA' }, { name: '尿素氮', code: 'BUN' },
  { name: '总胆固醇', code: 'TC' }, { name: '甘油三酯', code: 'TG' },
  { name: '尿酸', code: 'UA' }, { name: '白细胞', code: 'WBC' },
  { name: '血红蛋白', code: 'HGB' }, { name: '血小板', code: 'PLT' }
]);

function indicatorLabel(code) {
  const found = indicators.value.find(i => i.code === code);
  return found ? `${found.name} (${found.code})` : code;
}

const directionMap = { increasing: '↑ 上升', decreasing: '↓ 下降', stable: '→ 稳定', fluctuating: '↗ 波动' };
const stats = computed(() => trendData.value ? [
  { label: '趋势方向', value: directionMap[trendData.value.trend_direction] || '—' },
  { label: '平均值', value: trendData.value.avg_value || '—' },
  { label: '最小值', value: trendData.value.min_value || '—' },
  { label: '最大值', value: trendData.value.max_value || '—' }
] : []);

function onIndicatorChange(val) {
  if (val) loadTrend();
}

function clearIndicator() {
  selectedIndicator.value = '';
  trendData.value = null;
  if (chart) { chart.clear(); }
}

async function loadTrend() {
  if (!selectedIndicator.value) return;
  try {
    const { data } = await api.get(`/trends/${selectedIndicator.value}`, { params: { period: period.value } });
    trendData.value = data;
    await nextTick();
    renderChart(data);
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '加载趋势数据失败');
  }
}

function renderChart(data) {
  if (!chartRef.value) return;
  if (!chart) chart = echarts.init(chartRef.value);
  else chart.clear();

  const indicator = indicators.value.find(i => i.code === selectedIndicator.value);
  const title = indicator ? `${indicator.name} (${selectedIndicator.value})` : selectedIndicator.value;

  const option = {
    title: { text: title, left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.data_points.map(p => p.date), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value', name: selectedIndicator.value },
    series: [{
      data: data.data_points.map(p => p.value), type: 'line', smooth: true,
      lineStyle: { color: '#409eff', width: 3 },
      itemStyle: { color: '#409eff' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(64,158,255,0.25)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }
      ]) },
      markLine: data.reference_range ? {
        silent: true, symbol: 'none',
        data: [
          { yAxis: data.reference_range.low, label: { formatter: `下限 ${data.reference_range.low}`, position: 'start' }, lineStyle: { color: '#e6a23c', type: 'dashed' } },
          { yAxis: data.reference_range.high, label: { formatter: `上限 ${data.reference_range.high}`, position: 'end' }, lineStyle: { color: '#e6a23c', type: 'dashed' } }
        ]
      } : undefined,
      markPoint: {
        data: [
          { type: 'max', name: '最大值', symbolSize: 50 },
          { type: 'min', name: '最小值', symbolSize: 50 }
        ]
      }
    }],
    grid: { left: 70, right: 40, top: 60, bottom: 60 }
  };
  chart.setOption(option);
}

onUnmounted(() => { chart?.dispose(); });

onMounted(async () => {
  try {
    const { data } = await api.get('/profile/check');
    profileOk.value = data.profile_complete || data.has_reports;
  } catch {}
});
</script>
