<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h2>老年综合评估 (CGA)</h2>
      <el-button type="primary" @click="createNew" :loading="creating">新建评估</el-button>
    </div>
    <!-- Educational Introduction -->
    <el-collapse v-if="!currentId" v-model="cgaCollapse" style="margin-bottom:16px">
      <el-collapse-item name="intro">
        <template #title>
          <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600">
            <el-tag type="primary" size="small">指南</el-tag> 关于老年综合评估 (CGA) — 学术简介与操作指南
          </div>
        </template>
        <el-tabs v-model="cgaEduTab">
          <el-tab-pane label="学术简介" name="academic">
            <div style="padding:4px 0">
              <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:10px;padding:24px;color:#fff;margin-bottom:24px">
                <h3 style="margin:0 0 8px;font-size:18px">什么是老年综合评估（CGA）？</h3>
                <p style="margin:0;opacity:0.92;line-height:1.8">老年综合评估（Comprehensive Geriatric Assessment, CGA）是一项<strong>多维度健康评估工具</strong>，由英国老年医学会于 20 世纪 70 年代首次系统化提出。它不同于传统单一器官/疾病的诊疗思路，而是从<strong>生物—心理—社会—功能</strong>四个维度全面评估老年人的整体健康状况。</p>
              </div>

              <el-row :gutter="16" style="margin-bottom:24px">
                <el-col :span="8" v-for="item in cgaBenefits" :key="item.title">
                  <div style="background:#f5f7fa;border-radius:8px;padding:18px;text-align:center;height:100%">
                    <div style="font-size:28px;margin-bottom:8px">{{ item.icon }}</div>
                    <div style="font-weight:600;margin-bottom:6px">{{ item.title }}</div>
                    <div style="font-size:13px;color:#909399;line-height:1.6">{{ item.desc }}</div>
                  </div>
                </el-col>
              </el-row>

              <h4 style="margin-top:24px;margin-bottom:16px;padding-top:8px;color:#303133">本系统包含的 8 个评估维度</h4>
              <el-table :data="eduDims" size="small" stripe :header-cell-style="{background:'#f5f7fa',fontWeight:'600'}">
                <el-table-column prop="label" label="评估维度" width="180" />
                <el-table-column prop="tool" label="使用量表" width="180" />
                <el-table-column prop="meaning" label="评估意义" />
              </el-table>
            </div>
          </el-tab-pane>
          <el-tab-pane label="操作指南" name="guide">
            <div class="edu-content">
              <h4 style="margin-bottom:16px">如何使用本系统的 CGA 功能？</h4>
              <div v-for="(step, idx) in cgaSteps" :key="idx" style="display:flex;gap:16px;margin-bottom:20px;align-items:flex-start">
                <div style="min-width:40px;height:40px;border-radius:50%;background:#409eff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;flex-shrink:0">{{ idx + 1 }}</div>
                <div style="flex:1;background:#f5f7fa;border-radius:8px;padding:16px">
                  <div style="font-weight:600;margin-bottom:4px;font-size:15px">{{ step.title }}</div>
                  <div style="color:#606266;font-size:13px;line-height:1.7">{{ step.desc }}</div>
                </div>
              </div>
              <el-alert type="info" :closable="false" show-icon style="margin-top:16px">
                <template #title>家属协助提示</template>
                部分老人可能不熟悉电子设备操作，建议家属陪同填写，或由家属代为操作。认知筛查和抑郁筛查维度需客观如实作答。
              </el-alert>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-collapse-item>
    </el-collapse>

    <el-alert v-if="!profileOk" type="warning" title="请先完善个人基础档案" show-icon :closable="false" style="margin-bottom:16px">
      <template #default>
        老年综合评估需要您的基础信息（年龄、身高、体重等）作为评估基线。
        <el-button type="warning" size="small" text @click="$router.push('/profile')">去完善档案 →</el-button>
      </template>
    </el-alert>

    <!-- Assessment editing view -->
    <template v-if="currentId">
      <el-tabs v-model="activeTab">
        <el-tab-pane v-for="dim in dimensions" :key="dim.key" :label="dim.label" :name="dim.key">
          <el-card>
            <h3>{{ dim.label }} ({{ dim.key.toUpperCase() }})</h3>
            <p style="color:#909399;margin-bottom:16px">{{ dim.desc }}</p>
            <el-form label-width="240px">
              <el-form-item v-for="item in dim.items" :key="item.key" :label="item.label">
                <el-select v-if="item.options" v-model="formData[dim.key][item.key]" :placeholder="`选择${item.label}`" style="width:260px">
                  <el-option v-for="o in item.options" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <el-input-number v-else v-model="formData[dim.key][item.key]" :min="0" :max="item.max || 25" />
              </el-form-item>
              <el-form-item><el-button type="primary" @click="saveDimension(dim.key)" :loading="saving === dim.key">保存 {{ dim.label }}</el-button></el-form-item>
            </el-form>
          </el-card>
        </el-tab-pane>
      </el-tabs>

      <el-card style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>已完成 {{ completedDims }} / {{ dimensions.length }} 个维度</div>
          <el-button type="success" :disabled="!allDone" @click="analyze" :loading="analyzing">提交 AI 综合分析</el-button>
        </div>
        <el-progress :percentage="Math.round(completedDims / dimensions.length * 100)" style="margin-top:8px" />
      </el-card>

      <div style="margin-top:12px;text-align:right">
        <el-button @click="currentId = null; assessments = []; loadAssessments()">返回列表</el-button>
      </div>
    </template>

    <!-- Empty state -->
    <el-empty v-if="!currentId && !assessments.length" description="暂无评估记录，点击「新建评估」开始">
      <el-button type="primary" @click="createNew">新建评估</el-button>
    </el-empty>

    <!-- Assessment List -->
    <el-card v-if="assessments.length && !currentId">
      <el-table :data="assessments" stripe v-loading="loading">
        <el-table-column prop="assessment_date" label="评估日期" width="120" />
        <el-table-column label="ADL 评分" width="100">
          <template #default="{row}">{{ row.adl_score != null ? `${row.adl_score}/100` : '—' }}</template>
        </el-table-column>
        <el-table-column label="衰弱" width="80">
          <template #default="{row}">{{ row.frailty_score != null ? `${row.frailty_score}/5` : '—' }}</template>
        </el-table-column>
        <el-table-column label="营养" width="80">
          <template #default="{row}">{{ row.nutrition_score != null ? `${row.nutrition_score}/14` : '—' }}</template>
        </el-table-column>
        <el-table-column label="抑郁" width="80">
          <template #default="{row}">{{ row.depression_score != null ? `${row.depression_score}/15` : '—' }}</template>
        </el-table-column>
        <el-table-column label="跌倒" width="80">
          <template #default="{row}">{{ row.fall_risk_score != null ? `${row.fall_risk_score}/125` : '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{row}"><el-tag :type="row.status === 'completed' ? 'success' : row.status === 'in_progress' ? 'warning' : 'info'">{{ statusMap[row.status] || row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{row}"><el-button size="small" @click="openAssessment(row)">查看</el-button></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const assessments = ref([]), currentId = ref(null), activeTab = ref('adl');
const analyzing = ref(false), creating = ref(false), saving = ref(null), loading = ref(false);
const profileOk = ref(true);
const statusMap = { draft: '草稿', in_progress: '评估中', completed: '已完成', reviewed: '已复核' };
const cgaCollapse = ref(['intro']);
const cgaEduTab = ref('academic');

const cgaBenefits = [
  { icon: '🔍', title: '发现隐匿问题', desc: '轻度认知下降、营养不良、跌倒风险等在单一就诊中难以发现' },
  { icon: '🎯', title: '制定个体化方案', desc: '综合多维度信息，为老人量身定制干预和照护计划' },
  { icon: '📊', title: '循证证据充分', desc: '研究表明可降低住院率17%、减少跌倒风险24%、延缓功能衰退' }
];

const cgaSteps = [
  { title: '新建评估', desc: '点击右上角「新建评估」按钮，系统自动创建以当天日期为基准的评估记录。评估前请确保已完成个人档案。' },
  { title: '逐维度填写', desc: '系统提供 8 个评估维度标签页，每维配有对应量表和评分说明。家属可协助老人逐项作答，完成后点击「保存」。' },
  { title: '提交综合分析', desc: '全部维度填写完毕后，点击「提交 AI 综合分析」。系统基于各项评分自动生成综合结论和个性化建议。分析基于国际标准量表阈值，仅供参考。' },
  { title: '查看与追踪', desc: '分析完成后可在评估列表查看所有历史评估。建议每 3-6 个月重新评估一次，以追踪功能变化趋势。' }
];

const eduDims = [
  { label: '日常生活能力 (ADL)', tool: 'Barthel 指数', meaning: '评估进食、洗澡、穿衣、行走等基本自理能力，总分越低依赖性越强' },
  { label: '工具性日常能力 (IADL)', tool: 'Lawton IADL', meaning: '评估购物、烹饪、管药等复杂生活技能，反映社区独立生活能力' },
  { label: '衰弱评估', tool: 'Fried 衰弱表型', meaning: '通过5项指标识别衰弱综合征，≥3项为衰弱，是失能和死亡的重要预测因子' },
  { label: '营养评估', tool: 'MNA-SF', meaning: '筛查老年营养不良风险，营养不良与免疫功能下降、伤口愈合延迟密切相关' },
  { label: '抑郁筛查', tool: 'GDS-15', meaning: '老年抑郁专用量表，≥5分提示可能存在抑郁，老年抑郁常表现为躯体不适而非情绪低落' },
  { label: '跌倒风险评估', tool: 'Morse 量表', meaning: '综合评估跌倒风险因素，>45分为高风险，需启动防跌倒干预' },
  { label: '认知快速筛查', tool: 'Mini-Cog', meaning: '3分钟简易认知筛查，结合词语回忆和画钟测试，敏感度高于 MMSE' },
  { label: '社会支持', tool: '社会支持评估', meaning: '评估老人的社会支持网络和居住安排，社会隔离是老年健康的重要风险因素' }
];

const dimensions = [
  { key: 'adl', label: '日常生活能力', desc: 'Barthel 指数 (0-10每题，总分100，分越高越独立)',
    items: ['进食','洗澡','修饰','穿衣','大便控制','小便控制','如厕','床椅转移','平地行走','上下楼梯'].map(k => ({ key: k, label: k, max: 10 })) },
  { key: 'iadl', label: '工具性日常能力', desc: 'Lawton IADL (0-1每题，总分8)',
    items: ['购物','烹饪','家务','洗衣','交通方式','药物管理','财务管理','电话使用'].map(k => ({ key: k, label: k, max: 1, options: [{label:'独立完成(1)', value:1},{label:'需要帮助(0)', value:0}] })) },
  { key: 'frailty', label: '衰弱评估', desc: 'Fried 衰弱表型 (0-1每题，≥3=衰弱)',
    items: ['体重下降','疲乏感','握力下降','步速减慢','活动减少'].map(k => ({ key: k, label: k, max: 1, options: [{label:'是(1)', value:1},{label:'否(0)', value:0}] })) },
  { key: 'nutrition', label: '营养评估', desc: 'MNA-SF 简易营养评估 (总分14)',
    items: [
      { key: '进食量变化', label: '进食量变化', max: 2, options: [{label:'严重减少(0)', value:0},{label:'中度减少(1)', value:1},{label:'无变化(2)', value:2}] },
      { key: '体重下降', label: '体重下降', max: 2, options: [{label:'>3kg(0)', value:0},{label:'不知道(1)', value:1},{label:'1-3kg(2)', value:2},{label:'无(3)', value:3}] },
      { key: '活动能力', label: '活动能力', max: 1, options: [{label:'卧床(0)', value:0},{label:'可下床(1)', value:1},{label:'可外出(2)', value:2}] },
      { key: '应激/急性疾病', label: '应激/急性疾病', max: 1, options: [{label:'是(0)', value:0},{label:'否(2)', value:2}] },
      { key: '神经心理问题', label: '神经心理问题', max: 1, options: [{label:'严重(0)', value:0},{label:'轻度(1)', value:1},{label:'无(2)', value:2}] },
      { key: 'BMI', label: 'BMI', max: 3, options: [{label:'<19(0)', value:0},{label:'19-21(1)', value:1},{label:'21-23(2)', value:2},{label:'≥23(3)', value:3}] }
    ] },
  { key: 'depression', label: '抑郁筛查', desc: 'GDS-15 老年抑郁量表 (0-1每题，≥5=疑似抑郁)',
    items: ['对生活满意','放弃兴趣爱好','感到空虚','经常无聊','大部分时间精神好','害怕坏事发生','感到快乐','感到无助','宁愿待在家里','记忆问题','活着是美好的','感到无用','充满精力','感到无望','觉得别人过得更好'].map((k,i) => ({ key: `q${i+1}`, label: `${i+1}. ${k}`, max: 1, options: [{label:'是(1)', value:1},{label:'否(0)', value:0}] })) },
  { key: 'fall_risk', label: '跌倒风险评估', desc: 'Morse 跌倒评估量表',
    items: [
      { key: '跌倒史', label: '跌倒史', max: 25, options: [{label:'无(0)', value:0},{label:'有(25)', value:25}] },
      { key: '二次诊断', label: '二次诊断(≥2个)', max: 15, options: [{label:'无(0)', value:0},{label:'有(15)', value:15}] },
      { key: '助行器具', label: '助行器具', max: 30, options: [{label:'无/卧床(0)', value:0},{label:'拐杖(15)', value:15},{label:'扶家具(30)', value:30}] },
      { key: '静脉输液', label: '静脉输液', max: 20, options: [{label:'无(0)', value:0},{label:'有(20)', value:20}] },
      { key: '步态', label: '步态', max: 20, options: [{label:'正常(0)', value:0},{label:'虚弱(10)', value:10},{label:'异常(20)', value:20}] },
      { key: '精神状态', label: '精神状态', max: 15, options: [{label:'正常(0)', value:0},{label:'高估能力(15)', value:15}] }
    ] },
  { key: 'cognitive_quick', label: '认知快速筛查', desc: 'Mini-Cog 简易筛查',
    items: [
      { key: '词语回忆(0-3)', label: '词语回忆', max: 3, options: [{label:'0个', value:0},{label:'1个', value:1},{label:'2个', value:2},{label:'3个', value:3}] },
      { key: '画钟测试(0/2)', label: '画钟测试', max: 2, options: [{label:'异常(0)', value:0},{label:'正常(2)', value:2}] }
    ] },
  { key: 'social', label: '社会支持', desc: '社会支持与居住安排',
    items: [
      { key: 'support', label: '社会支持', options: [{label:'良好', value:'good'},{label:'一般', value:'fair'},{label:'差', value:'poor'},{label:'无', value:'none'}] },
      { key: 'living', label: '居住安排', options: [{label:'独居', value:'alone'},{label:'与配偶', value:'spouse'},{label:'与子女', value:'family'},{label:'辅助生活', value:'assisted_living'},{label:'护理院', value:'nursing_home'}] }
    ] }
];

const formData = ref({});

function initFormData() {
  const fd = {};
  for (const dim of dimensions) {
    fd[dim.key] = {};
    for (const item of dim.items) {
      fd[dim.key][item.key] = item.options ? null : 0;
    }
  }
  formData.value = fd;
}

const completedDims = computed(() => {
  if (!currentId.value) return 0;
  return dimensions.filter(d => {
    const data = formData.value[d.key];
    if (!data) return false;
    const vals = Object.values(data).filter(v => v !== null && v !== undefined && v !== '');
    return vals.length >= d.items.length;
  }).length;
});
const allDone = computed(() => completedDims.value >= dimensions.length);

async function loadAssessments() {
  loading.value = true;
  try { const { data } = await api.get('/cga-assessments'); assessments.value = data; }
  finally { loading.value = false; }
}

async function createNew() {
  creating.value = true;
  try {
    const date = new Date().toISOString().slice(0, 10);
    const { data } = await api.post('/cga-assessments', { assessment_date: date });
    currentId.value = data.id;
    initFormData();
    activeTab.value = 'adl';
    ElMessage.success('评估已创建');
    loadAssessments();
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '创建评估失败');
  } finally { creating.value = false; }
}

async function openAssessment(assessment) {
  currentId.value = assessment.id;
  initFormData();
  for (const dim of dimensions) {
    const colName = `${dim.key}_data`;
    if (assessment[colName]) {
      try {
        const parsed = JSON.parse(assessment[colName]);
        for (const [k, v] of Object.entries(parsed)) {
          if (formData.value[dim.key] && k in formData.value[dim.key]) {
            formData.value[dim.key][k] = v;
          }
        }
      } catch {}
    }
  }
  activeTab.value = 'adl';
}

async function saveDimension(key) {
  if (!currentId.value || !formData.value[key]) return;
  saving.value = key;
  try {
    await api.put(`/cga-assessments/${currentId.value}`, { dimension: key, data: formData.value[key] });
    ElMessage.success(`${dimensions.find(d => d.key === key)?.label} 已保存`);
    loadAssessments();
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '保存失败');
  } finally { saving.value = null; }
}

async function analyze() {
  analyzing.value = true;
  try {
    const { data } = await api.post(`/cga-assessments/${currentId.value}/analyze`);
    ElMessage.success('AI 综合分析完成');
    currentId.value = null;
    loadAssessments();
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '分析失败');
  } finally { analyzing.value = false; }
}

onMounted(async () => {
  try { const { data } = await api.get('/profile/check'); profileOk.value = data.profile_complete; } catch {}
  loadAssessments();
});
</script>
