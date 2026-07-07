<template>
  <div>
    <!-- Personalized greeting -->
    <div v-if="greeting.displayName" style="margin-bottom:20px;padding:20px 24px;background:linear-gradient(135deg,#e8f4fd 0%,#f0f7ff 100%);border-radius:12px;border-left:4px solid #409eff">
      <div style="font-size:22px;font-weight:600;color:#303133;margin-bottom:8px">
        你好，{{ greeting.displayName }} 👋
      </div>
      <div style="font-size:15px;color:#606266">
        这是<strong style="color:#409eff">颐年家庭医生</strong>陪伴你的第 <strong style="color:#409eff;font-size:18px">{{ greeting.days }}</strong> 天
      </div>
    </div>

    <h2>健康数据概览</h2>

    <!-- Guided Roadmap for new users -->
    <el-card v-if="showRoadmap" style="margin-bottom:20px;background:linear-gradient(135deg,#f0f9ff 0%,#ecf5ff 100%);border-left:4px solid #409eff">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:20px">🚀</span>
          <span style="font-weight:bold;font-size:16px">欢迎使用颐年家庭医生！请按以下步骤完成初始化</span>
        </div>
      </template>
      <el-steps :active="activeStep" finish-status="success" align-center style="margin:16px 0">
        <el-step title="完善档案" description="填写身高体重等基础信息" />
        <el-step title="配置 AI" description="加载 Claude Code API Key" />
        <el-step title="上传报告" description="上传第一份检查单" />
        <el-step title="探索功能" description="查看分析、趋势与评估" />
      </el-steps>
      <div style="display:flex;justify-content:center;gap:12px;margin-top:16px">
        <el-button v-if="!steps.profile.done" type="primary" @click="$router.push('/profile')">去完善个人档案</el-button>
        <el-button v-else-if="!steps.api_key.done" type="primary" @click="$router.push('/settings')">去配置 API Key</el-button>
        <el-button v-else-if="!steps.upload.done" type="primary" @click="$router.push('/reports/upload')">上传第一份检查单</el-button>
        <el-button v-else type="success" disabled>初始化完成，开始探索</el-button>
      </div>
    </el-card>

    <!-- Stats cards -->
    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="6" v-for="stat in stats" :key="stat.label">
        <el-card style="margin-bottom:16px;cursor:pointer" @click="$router.push(stat.link)" shadow="hover">
          <div style="text-align:center">
            <div style="font-size:32px;margin-bottom:8px">{{ stat.icon }}</div>
            <div style="font-size:28px;font-weight:bold;color:#409eff">{{ stat.value }}</div>
            <div style="color:#909399;margin-top:4px">{{ stat.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Health Trends (when setup complete) -->
    <template v-if="!showRoadmap">
      <h3 style="margin:20px 0 12px">健康趋势总览</h3>
      <el-row :gutter="16" style="margin-bottom:16px">
        <el-col :span="8" v-for="tc in trendCards" :key="tc.code">
          <el-card shadow="hover" style="cursor:pointer" @click="$router.push('/trends')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <span style="font-weight:bold">{{ tc.name }}</span>
              <el-tag :type="tc.direction === 'increasing' ? 'danger' : tc.direction === 'decreasing' ? 'success' : 'info'" size="small">
                {{ tc.direction === 'increasing' ? '↑ 上升' : tc.direction === 'decreasing' ? '↓ 下降' : '→ 稳定' }}
              </el-tag>
            </div>
            <div style="font-size:24px;font-weight:bold;color:#303133;margin:4px 0">
              {{ tc.latest }} <span style="font-size:14px;color:#909399">{{ tc.unit }}</span>
            </div>
            <div style="color:#909399;font-size:12px">参考范围: {{ tc.ref }}</div>
            <div :ref="el => { if (el) chartRefs[tc.code] = el }" style="height:100px;margin-top:4px"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- Medication Schedule -->
      <el-row :gutter="16" style="margin-bottom:16px">
        <el-col :span="24">
          <el-card v-if="medSchedule.length" shadow="hover">
            <template #header><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:bold">今日服药日程</span><el-button size="small" text @click="$router.push('/medications')">管理用药 →</el-button></div></template>
            <div style="display:flex;gap:12px;overflow-x:auto">
              <div v-for="slot in medSchedule" :key="slot.time" style="min-width:180px;flex:1;background:#fafafa;border-radius:8px;padding:12px">
                <div style="font-weight:bold;margin-bottom:8px;color:#409eff;display:flex;align-items:center;gap:4px">
                  <span>{{ slot.icon }}</span><span>{{ slot.label }}</span>
                  <span style="font-size:11px;color:#909399;font-weight:normal">{{ slot.time }}</span>
                </div>
                <div v-for="item in slot.items" :key="`${item.id}-${item.schedule_time}`" style="padding:6px 8px;margin-bottom:6px;background:#fff;border-radius:4px;border-left:3px solid #409eff;font-size:13px">
                  <div style="font-weight:500">{{ item.drug_name }}</div>
                  <div style="color:#909399;font-size:12px">
                    {{ item.dosage }}{{ item.dosage_unit }} {{ item.route_cn }}
                    <el-tag v-if="item.timing_cn && item.timing_cn !== '不限'" size="small" style="margin-left:4px" type="warning">{{ item.timing_cn }}</el-tag>
                  </div>
                  <div style="color:#c0c4cc;font-size:11px">⏰ {{ item.schedule_time }}</div>
                </div>
              </div>
            </div>
          </el-card>
          <el-empty v-else description="暂无活跃用药" :image-size="40" />
        </el-col>
      </el-row>

      <!-- CGA & Cognitive summary row -->
      <el-row :gutter="16" style="margin-bottom:16px">
        <el-col :span="12">
          <el-card shadow="hover" style="cursor:pointer" @click="$router.push('/cga')">
            <template #header><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:bold">老年综合评估 (CGA)</span><el-tag v-if="cgaSummary" :type="cgaSummary.frailty >= 3 ? 'warning' : 'success'" size="small">{{ cgaSummary.frailty >= 3 ? '需关注' : '良好' }}</el-tag></div></template>
            <div v-if="cgaSummary">
              <el-row :gutter="8">
                <el-col :span="8" style="text-align:center"><div style="color:#909399;font-size:12px">ADL</div><div style="font-size:20px;font-weight:bold;color:#409eff">{{ cgaSummary.adl }}/100</div></el-col>
                <el-col :span="8" style="text-align:center"><div style="color:#909399;font-size:12px">衰弱</div><div style="font-size:20px;font-weight:bold;color:#e6a23c">{{ cgaSummary.frailty }}/5</div></el-col>
                <el-col :span="8" style="text-align:center"><div style="color:#909399;font-size:12px">营养</div><div style="font-size:20px;font-weight:bold;color:#67c23a">{{ cgaSummary.nutrition }}/14</div></el-col>
              </el-row>
              <div style="margin-top:8px;color:#909399;font-size:13px;text-align:center">评估日期: {{ cgaSummary.date }}</div>
            </div>
            <el-empty v-else description="暂无评估" :image-size="40" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="hover" style="cursor:pointer" @click="$router.push('/cognitive')">
            <template #header><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:bold">认知筛查</span><el-tag v-if="cognitiveSummary" :type="cognitiveSummary.risk === 'high' || cognitiveSummary.risk === 'very_high' ? 'danger' : 'success'" size="small">{{ cognitiveSummary.risk === 'high' || cognitiveSummary.risk === 'very_high' ? '需关注' : '正常' }}</el-tag></div></template>
            <div v-if="cognitiveSummary">
              <div style="text-align:center">
                <div style="font-size:32px;font-weight:bold;color:#409eff">{{ cognitiveSummary.score }}/{{ cognitiveSummary.max }}</div>
                <div style="color:#909399;font-size:13px">{{ cognitiveSummary.type }} — {{ cognitiveSummary.date }}</div>
                <div style="color:#909399;font-size:12px;margin-top:4px">{{ cognitiveSummary.interp }}</div>
              </div>
            </div>
            <el-empty v-else description="暂无筛查" :image-size="40" />
          </el-card>
        </el-col>
      </el-row>
    </template>

    <el-row :gutter="20" style="margin-top:16px">
      <el-col :span="12">
        <el-card header="最近健康报告">
          <el-empty v-if="!recentReports.length" description="暂无健康报告">
            <el-button type="primary" @click="$router.push('/reports/upload')">上传第一份检查单</el-button>
          </el-empty>
          <el-timeline v-else>
            <el-timeline-item v-for="r in recentReports" :key="r.id" :timestamp="r.report_date" @click="$router.push(`/reports/${r.id}`)" style="cursor:pointer">
              {{ r.title }} <el-tag size="small" :type="r.status === 'confirmed' ? 'success' : 'warning'">{{ statusMap[r.status] || r.status }}</el-tag>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card header="活跃用药">
          <el-empty v-if="!activeMeds.length" description="无活跃用药">
            <el-button type="primary" @click="$router.push('/medications')">添加用药记录</el-button>
          </el-empty>
          <div v-else>
            <el-tag v-for="m in activeMeds" :key="m.id" style="margin:4px" type="warning" effect="plain">{{ m.drug_name }} {{ m.dosage }}{{ m.dosage_unit || '' }} {{ m.frequency }}</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import api from '../api/index.js';

const greeting = ref({ displayName: '', days: 0 });
const statusMap = { uploaded: '已上传', ai_processing: '识别中', processed: '已识别', review_needed: '待复核', confirmed: '已确认', failed: '失败' };
const stats = ref([
  { label: '健康报告', icon: '📋', value: 0, link: '/reports' },
  { label: '活跃用药', icon: '💊', value: 0, link: '/medications' },
  { label: '专家咨询', icon: '👨‍⚕️', value: 0, link: '/consultation' },
  { label: '异常指标', icon: '⚠️', value: 0, link: '/trends' }
]);
const recentReports = ref([]);
const activeMeds = ref([]);
const chartRefs = ref({});
const charts = {};
const steps = ref({ profile: { done: false }, api_key: { done: false }, upload: { done: false } });
const showRoadmap = computed(() => !steps.value.profile.done || !steps.value.api_key.done || !steps.value.upload.done);
const activeStep = computed(() => {
  if (!steps.value.profile.done) return 0;
  if (!steps.value.api_key.done) return 1;
  if (!steps.value.upload.done) return 2;
  return 3;
});

const trendCards = ref([
  { code: 'GLU', name: '空腹血糖', latest: '—', unit: 'mmol/L', ref: '3.9-6.1', direction: 'stable', rawData: [] },
  { code: 'HbA1c', name: '糖化血红蛋白', latest: '—', unit: '%', ref: '4.0-6.0', direction: 'stable', rawData: [] },
  { code: 'TC', name: '总胆固醇', latest: '—', unit: 'mmol/L', ref: '2.8-5.2', direction: 'stable', rawData: [] }
]);

const cgaSummary = ref(null);
const cognitiveSummary = ref(null);
const medSchedule = ref([]);

const interpMap = { normal: '正常', borderline: '临界', impaired: '受损', severely_impaired: '严重受损' };

function getDirection(data) {
  if (!data.length || data.length < 2) return 'stable';
  const first = data[0].value, last = data[data.length - 1].value;
  const pct = (last - first) / Math.abs(first) * 100;
  if (pct > 10) return 'increasing';
  if (pct < -10) return 'decreasing';
  return 'stable';
}

function renderMiniChart(code) {
  const el = chartRefs.value[code];
  if (!el) return;
  const card = trendCards.value.find(t => t.code === code);
  if (!card?.rawData?.length) return;
  if (charts[code]) charts[code].dispose();
  const c = echarts.init(el);
  charts[code] = c;
  c.setOption({
    tooltip: { trigger: 'axis', formatter: p => `${p[0].axisValue}<br/>${p[0].value} ${card.unit}` },
    xAxis: { type: 'category', data: card.rawData.map(d => d.date), show: false },
    yAxis: { type: 'value', show: false, min: v => v.min - 1 },
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    series: [{
      data: card.rawData.map(d => d.value), type: 'line', smooth: true,
      lineStyle: { color: '#409eff', width: 2 },
      itemStyle: { color: '#409eff' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(64,158,255,0.2)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }
      ]) },
      symbol: 'none'
    }]
  });
}

async function loadTrendData() {
  for (const card of trendCards.value) {
    try {
      const { data } = await api.get(`/trends/${card.code}`, { params: { period: '6m' } });
      if (data?.data_points?.length) {
        card.rawData = data.data_points;
        card.latest = data.data_points[data.data_points.length - 1].value;
        card.direction = getDirection(data.data_points);
        await nextTick();
        renderMiniChart(card.code);
      }
    } catch { /* no trend data */ }
  }
}

async function loadSummaryData() {
  try {
    const { data } = await api.get('/medications/schedule');
    medSchedule.value = data || [];
  } catch {}
  try {
    const { data } = await api.get('/cga-assessments');
    if (data?.length) {
      const latest = data[0];
      cgaSummary.value = {
        adl: latest.adl_score, frailty: latest.frailty_score, nutrition: latest.nutrition_score,
        date: latest.assessment_date
      };
    }
  } catch {}
  try {
    const { data } = await api.get('/cognitive-screenings', { params: { limit: 1 } });
    if (data?.length) {
      const latest = data[0];
      cognitiveSummary.value = {
        score: latest.total_score, max: latest.score_max, type: latest.screening_type,
        date: latest.screening_date, interp: interpMap[latest.score_interpretation] || latest.score_interpretation,
        risk: latest.risk_level
      };
    }
  } catch {}
}

async function loadUserGreeting() {
  try {
    const { data } = await api.get('/auth/me');
    greeting.value.displayName = data.display_name || data.username || '用户';
    if (data.created_at) {
      const created = new Date(data.created_at);
      const now = new Date();
      greeting.value.days = Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
    }
  } catch {}
}

onMounted(async () => {
  try {
    loadUserGreeting();
    const [checkRes, reportsRes, medsRes] = await Promise.all([
      api.get('/profile/check'),
      api.get('/reports', { params: { limit: 5 } }),
      api.get('/medications', { params: { status: 'active' } })
    ]);
    steps.value = checkRes.data.steps;
    stats.value[0].value = reportsRes.data.total || 0;
    recentReports.value = reportsRes.data.data || [];
    stats.value[1].value = medsRes.data.length || 0;
    activeMeds.value = medsRes.data || [];

    if (!showRoadmap.value) {
      loadTrendData();
      loadSummaryData();
    }
  } catch { /* empty dashboard */ }
});
</script>
