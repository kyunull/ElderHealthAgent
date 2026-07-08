<template>
  <div class="dashboard">
    <!-- Personalized greeting -->
    <div v-if="greeting.displayName" class="greeting-banner">
      <div class="greeting-content">
        <div class="greeting-wave">👋</div>
        <div>
          <div class="greeting-title">您好，{{ greeting.displayName }}</div>
          <div class="greeting-subtitle">
            颐年家庭医生已经陪伴您 <strong class="days-num">{{ greeting.days }}</strong> 天了
          </div>
        </div>
      </div>
    </div>

    <!-- Guided Roadmap for new users -->
    <el-card v-if="showRoadmap" class="roadmap-card">
      <template #header>
        <div class="roadmap-header">
          <span class="roadmap-icon">🚀</span>
          <span class="roadmap-title">欢迎使用颐年家庭医生！请按以下步骤开始</span>
        </div>
      </template>

      <el-steps :active="activeStep" finish-status="success" align-center class="roadmap-steps">
        <el-step title="完善档案" description="填写身高体重等基础信息" />
        <el-step title="配置 AI" description="设置 API Key 解锁智能分析" />
        <el-step title="上传报告" description="上传第一份检查报告" />
        <el-step title="开始使用" description="查看分析、趋势与评估" />
      </el-steps>

      <div class="roadmap-actions">
        <el-button v-if="!steps.profile.done" type="primary" size="large" round @click="$router.push('/profile')">
          去完善个人档案
        </el-button>
        <el-button v-else-if="!steps.api_key.done" type="primary" size="large" round @click="$router.push('/settings')">
          去设置 API Key
        </el-button>
        <el-button v-else-if="!steps.upload.done" type="primary" size="large" round @click="$router.push('/reports/upload')">
          上传第一份检查单
        </el-button>
        <el-tag v-else type="success" size="large">初始化完成，开始探索</el-tag>
      </div>
    </el-card>

    <h2 class="section-title">健康数据概览</h2>

    <!-- Stats cards -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6" v-for="stat in stats" :key="stat.label">
        <div class="stat-card" @click="$router.push(stat.link)">
          <div class="stat-icon">{{ stat.icon }}</div>
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- Health Trends (when setup complete) -->
    <template v-if="!showRoadmap">
      <h3 class="section-title sub-title">健康趋势</h3>

      <el-row :gutter="16" class="trend-row">
        <el-col :span="8" v-for="tc in trendCards" :key="tc.code">
          <div class="trend-card" @click="$router.push('/trends')">
            <div class="trend-header">
              <span class="trend-name">{{ tc.name }}</span>
              <el-tag
                :type="tc.direction === 'increasing' ? 'danger' : tc.direction === 'decreasing' ? 'success' : 'info'"
                size="small"
              >
                {{ tc.direction === 'increasing' ? '↑ 上升' : tc.direction === 'decreasing' ? '↓ 下降' : '→ 稳定' }}
              </el-tag>
            </div>
            <div class="trend-value">
              {{ tc.latest }} <span class="trend-unit">{{ tc.unit }}</span>
            </div>
            <div class="trend-ref">参考范围：{{ tc.ref }}</div>
            <div :ref="el => { if (el) chartRefs[tc.code] = el }" class="mini-chart"></div>
          </div>
        </el-col>
      </el-row>

      <!-- Medication Schedule -->
      <el-card v-if="medSchedule.length" class="schedule-card">
        <template #header>
          <div class="schedule-header">
            <span class="schedule-title">今日服药安排</span>
            <el-button size="small" text type="primary" @click="$router.push('/medications')">
              管理用药 →
            </el-button>
          </div>
        </template>
        <div class="schedule-slots">
          <div v-for="slot in medSchedule" :key="slot.time" class="schedule-slot">
            <div class="slot-header">
              <span class="slot-icon">{{ slot.icon }}</span>
              <span class="slot-label">{{ slot.label }}</span>
              <span class="slot-time">{{ slot.time }}</span>
            </div>
            <div
              v-for="item in slot.items"
              :key="`${item.id}-${item.schedule_time}`"
              class="slot-drug"
            >
              <div class="drug-name">{{ item.drug_name }}</div>
              <div class="drug-meta">
                {{ item.dosage }}{{ item.dosage_unit }} · {{ item.route_cn }}
                <el-tag v-if="item.timing_cn && item.timing_cn !== '不限'" size="small" type="warning">
                  {{ item.timing_cn }}
                </el-tag>
              </div>
              <div class="drug-time">⏰ {{ item.schedule_time }}</div>
            </div>
          </div>
        </div>
      </el-card>
      <el-empty v-else description="暂无活跃用药" :image-size="56" />

      <!-- CGA & Cognitive summary -->
      <el-row :gutter="16" class="assessment-row">
        <el-col :span="12">
          <div class="assessment-card" @click="$router.push('/cga')">
            <div class="assessment-header">
              <span class="assessment-title">老年综合评估</span>
              <el-tag v-if="cgaSummary" :type="cgaSummary.frailty >= 3 ? 'warning' : 'success'" size="small">
                {{ cgaSummary.frailty >= 3 ? '需要关注' : '情况良好' }}
              </el-tag>
            </div>
            <div v-if="cgaSummary" class="assessment-body">
              <el-row :gutter="8">
                <el-col :span="8" class="assessment-metric">
                  <div class="metric-label">日常生活</div>
                  <div class="metric-value primary">{{ cgaSummary.adl }}/100</div>
                </el-col>
                <el-col :span="8" class="assessment-metric">
                  <div class="metric-label">衰弱程度</div>
                  <div class="metric-value warning">{{ cgaSummary.frailty }}/5</div>
                </el-col>
                <el-col :span="8" class="assessment-metric">
                  <div class="metric-label">营养状况</div>
                  <div class="metric-value success">{{ cgaSummary.nutrition }}/14</div>
                </el-col>
              </el-row>
              <div class="assessment-date">评估日期：{{ cgaSummary.date }}</div>
            </div>
            <el-empty v-else description="还没有评估记录" :image-size="48" />
          </div>
        </el-col>

        <el-col :span="12">
          <div class="assessment-card" @click="$router.push('/cognitive')">
            <div class="assessment-header">
              <span class="assessment-title">认知筛查</span>
              <el-tag v-if="cognitiveSummary"
                :type="cognitiveSummary.risk === 'high' || cognitiveSummary.risk === 'very_high' ? 'danger' : 'success'"
                size="small"
              >
                {{ cognitiveSummary.risk === 'high' || cognitiveSummary.risk === 'very_high' ? '需要关注' : '认知正常' }}
              </el-tag>
            </div>
            <div v-if="cognitiveSummary" class="assessment-body">
              <div class="cognitive-score">
                <div class="score-big">{{ cognitiveSummary.score }}/{{ cognitiveSummary.max }}</div>
                <div class="score-meta">{{ cognitiveSummary.type }} · {{ cognitiveSummary.date }}</div>
                <div class="score-interp">{{ cognitiveSummary.interp }}</div>
              </div>
            </div>
            <el-empty v-else description="还没有筛查记录" :image-size="48" />
          </div>
        </el-col>
      </el-row>
    </template>

    <!-- Bottom section: reports & meds -->
    <el-row :gutter="20" class="bottom-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-title-row">
              <span>最近健康报告</span>
            </div>
          </template>
          <el-empty v-if="!recentReports.length" description="还没有上传健康报告">
            <el-button type="primary" size="large" @click="$router.push('/reports/upload')">
              上传第一份检查单
            </el-button>
          </el-empty>
          <el-timeline v-else>
            <el-timeline-item
              v-for="r in recentReports"
              :key="r.id"
              :timestamp="r.report_date"
              class="report-item"
              @click="$router.push(`/reports/${r.id}`)"
            >
              <span class="report-title">{{ r.title }}</span>
              <el-tag size="small" :type="r.status === 'confirmed' ? 'success' : 'warning'" class="report-tag">
                {{ statusMap[r.status] || r.status }}
              </el-tag>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-title-row">
              <span>正在服用的药品</span>
            </div>
          </template>
          <el-empty v-if="!activeMeds.length" description="还没有添加用药记录">
            <el-button type="primary" size="large" @click="$router.push('/medications')">
              添加用药记录
            </el-button>
          </el-empty>
          <div v-else class="active-meds-list">
            <div v-for="m in activeMeds" :key="m.id" class="active-med-tag">
              <span class="med-name">{{ m.drug_name }}</span>
              <span class="med-dose">{{ m.dosage }}{{ m.dosage_unit || '' }} · {{ m.frequency }}</span>
            </div>
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
const statusMap = {
  uploaded: '已上传', ai_processing: '识别中', processed: '已识别',
  review_needed: '待复核', confirmed: '已确认', failed: '失败'
};
const stats = ref([
  { label: '健康报告', icon: '📋', value: 0, link: '/reports' },
  { label: '正在用药', icon: '💊', value: 0, link: '/medications' },
  { label: '专家咨询', icon: '👨‍⚕️', value: 0, link: '/consultation' },
  { label: '需关注指标', icon: '🔍', value: 0, link: '/trends' }
]);
const recentReports = ref([]);
const activeMeds = ref([]);
const chartRefs = ref({});
const charts = {};
const steps = ref({
  profile: { done: false }, api_key: { done: false }, upload: { done: false }
});
const showRoadmap = computed(
  () => !steps.value.profile.done || !steps.value.api_key.done || !steps.value.upload.done
);
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
      lineStyle: { color: '#5B8BA0', width: 2 },
      itemStyle: { color: '#5B8BA0' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(91,139,160,0.22)' },
          { offset: 1, color: 'rgba(91,139,160,0.02)' }
        ])
      },
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
  try { const { data } = await api.get('/medications/schedule'); medSchedule.value = data || []; } catch {}
  try {
    const { data } = await api.get('/cga-assessments');
    if (data?.length) {
      const latest = data[0];
      cgaSummary.value = {
        adl: latest.adl_score, frailty: latest.frailty_score,
        nutrition: latest.nutrition_score, date: latest.assessment_date
      };
    }
  } catch {}
  try {
    const { data } = await api.get('/cognitive-screenings', { params: { limit: 1 } });
    if (data?.length) {
      const latest = data[0];
      cognitiveSummary.value = {
        score: latest.total_score, max: latest.score_max,
        type: latest.screening_type, date: latest.screening_date,
        interp: interpMap[latest.score_interpretation] || latest.score_interpretation,
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

<style scoped>
.dashboard {
  max-width: 1200px;
}

/* ===== Greeting Banner ===== */
.greeting-banner {
  background: linear-gradient(135deg, #EFF7FA 0%, #F0F5ED 100%);
  border-radius: 16px;
  border-left: 6px solid #5B8BA0;
  padding: 24px 28px;
  margin-bottom: 24px;
}

.greeting-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.greeting-wave {
  font-size: 40px;
  line-height: 1;
  animation: wave 2s ease-in-out infinite;
}

@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(15deg); }
  75% { transform: rotate(-10deg); }
}

.greeting-title {
  font-size: 24px;
  font-weight: 700;
  color: #2C3E50;
  margin-bottom: 6px;
}

.greeting-subtitle {
  font-size: 16px;
  color: #5D6D7E;
}

.days-num {
  color: #5B8BA0;
  font-size: 22px;
  font-weight: 700;
}

/* ===== Section Titles ===== */
.section-title {
  font-size: 22px;
  font-weight: 700;
  color: #2C3E50;
  margin: 0 0 20px;
}

.sub-title {
  font-size: 18px;
  margin: 28px 0 16px;
}

/* ===== Roadmap ===== */
.roadmap-card {
  margin-bottom: 24px;
  background: linear-gradient(135deg, #F8FBFD 0%, #F5FAF6 100%);
  border-left: 5px solid #5B8BA0;
}

.roadmap-card :deep(.el-card__header) {
  padding: 18px 24px;
}

.roadmap-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.roadmap-icon {
  font-size: 24px;
}

.roadmap-title {
  font-size: 17px;
  font-weight: 700;
  color: #2C3E50;
}

.roadmap-steps {
  margin: 20px 0;
}

.roadmap-actions {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

/* ===== Stats Cards ===== */
.stats-row {
  margin-bottom: 8px;
}

.stat-card {
  background: #fff;
  border-radius: 14px;
  padding: 28px 16px 24px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  border: 1px solid #EDE8E0;
  margin-bottom: 16px;
  transition: all 0.3s;
}

.stat-card:hover {
  box-shadow: 0 6px 24px rgba(91,139,160,0.12);
  border-color: #B8CFDA;
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 40px;
  margin-bottom: 12px;
  line-height: 1;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #5B8BA0;
  line-height: 1.2;
}

.stat-label {
  font-size: 16px;
  color: #5D6D7E;
  margin-top: 8px;
  font-weight: 500;
}

/* ===== Trend Cards ===== */
.trend-row {
  margin-bottom: 16px;
}

.trend-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  border: 1px solid #EDE8E0;
  transition: all 0.3s;
}

.trend-card:hover {
  box-shadow: 0 6px 24px rgba(91,139,160,0.12);
  border-color: #B8CFDA;
}

.trend-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.trend-name {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
}

.trend-value {
  font-size: 28px;
  font-weight: 700;
  color: #2C3E50;
  line-height: 1.2;
}

.trend-unit {
  font-size: 15px;
  font-weight: 400;
  color: #7B8D9E;
}

.trend-ref {
  font-size: 13px;
  color: #909399;
  margin-top: 2px;
}

.mini-chart {
  height: 100px;
  margin-top: 4px;
}

/* ===== Medication Schedule ===== */
.schedule-card {
  margin-bottom: 20px;
}

.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.schedule-title {
  font-size: 17px;
  font-weight: 700;
  color: #2C3E50;
}

.schedule-slots {
  display: flex;
  gap: 12px;
  overflow-x: auto;
}

.schedule-slot {
  min-width: 180px;
  flex: 1;
  background: #FAF9F7;
  border-radius: 12px;
  padding: 14px;
}

.slot-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.slot-icon {
  font-size: 18px;
}

.slot-label {
  font-size: 15px;
  font-weight: 600;
  color: #5B8BA0;
}

.slot-time {
  font-size: 12px;
  color: #909399;
}

.slot-drug {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  border-left: 4px solid #5B8BA0;
}

.drug-name {
  font-size: 15px;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 4px;
}

.drug-meta {
  font-size: 13px;
  color: #7B8D9E;
}

.drug-time {
  font-size: 12px;
  color: #B0BEC5;
  margin-top: 4px;
}

/* ===== Assessment Cards ===== */
.assessment-row {
  margin-bottom: 20px;
}

.assessment-card {
  background: #fff;
  border-radius: 14px;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  border: 1px solid #EDE8E0;
  transition: all 0.3s;
}

.assessment-card:hover {
  box-shadow: 0 6px 24px rgba(91,139,160,0.12);
  border-color: #B8CFDA;
}

.assessment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px 0;
}

.assessment-title {
  font-size: 16px;
  font-weight: 700;
  color: #2C3E50;
}

.assessment-body {
  padding: 16px 20px 20px;
}

.assessment-metric {
  text-align: center;
  padding: 8px 4px;
}

.metric-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
}

.metric-value.primary { color: #5B8BA0; }
.metric-value.warning { color: #D4A76A; }
.metric-value.success { color: #6BA368; }

.assessment-date {
  font-size: 13px;
  color: #909399;
  text-align: center;
  margin-top: 10px;
}

.cognitive-score {
  text-align: center;
  padding: 8px 0;
}

.score-big {
  font-size: 36px;
  font-weight: 700;
  color: #5B8BA0;
}

.score-meta {
  font-size: 14px;
  color: #7B8D9E;
  margin-top: 4px;
}

.score-interp {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

/* ===== Bottom Section ===== */
.bottom-row {
  margin-top: 8px;
}

.card-title-row {
  font-size: 17px;
  font-weight: 700;
  color: #2C3E50;
}

.report-item {
  cursor: pointer;
  padding: 4px 0;
}

.report-title {
  font-size: 15px;
  color: #2C3E50;
}

.report-tag {
  margin-left: 8px;
}

.active-meds-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.active-med-tag {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #FEF9F0;
  border: 1px solid #F0E0C8;
  border-radius: 10px;
  padding: 10px 16px;
}

.med-name {
  font-size: 15px;
  font-weight: 600;
  color: #2C3E50;
}

.med-dose {
  font-size: 13px;
  color: #7B8D9E;
}
</style>
