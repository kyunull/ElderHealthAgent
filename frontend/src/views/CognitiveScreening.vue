<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h2>认知筛查</h2>
      <el-button type="primary" @click="showNewDialog = true">新建筛查</el-button>
    </div>

    <el-card v-if="currentScreening" style="margin-bottom:16px">
      <template #header>
        <div style="display:flex;justify-content:space-between">
          <span>当前筛查: {{ currentScreening.screening_type }} — {{ currentScreening.screening_date }}</span>
          <el-button size="small" @click="currentScreening = null">返回列表</el-button>
        </div>
      </template>

      <el-alert v-if="currentScreening.status === 'tool_selection'" title="请填写量表" type="info" style="margin-bottom:16px" />
      <div v-if="currentScreening.total_score != null" style="margin-bottom:16px;padding:16px;background:#f0f9eb;border-radius:8px">
        <el-row :gutter="16">
          <el-col :span="8"><div style="text-align:center"><div style="color:#909399">总分</div><div style="font-size:28px;font-weight:bold;color:#409eff">{{ currentScreening.total_score }}/{{ currentScreening.score_max }}</div></div></el-col>
          <el-col :span="8"><div style="text-align:center"><div style="color:#909399">解读</div><div style="font-size:16px;color:#303133;margin-top:8px">{{ interpretationMap[currentScreening.score_interpretation] }}</div></div></el-col>
          <el-col :span="8"><div style="text-align:center"><div style="color:#909399">趋势</div><div style="font-size:16px;margin-top:8px;color:#e6a23c" v-if="currentScreening.score_change != null">{{ currentScreening.score_change > 0 ? '↑' : '↓' }} {{ Math.abs(currentScreening.score_change) }} 分</div><div v-else style="margin-top:8px;color:#909399">首次筛查</div></div></el-col>
        </el-row>
        <div v-if="currentScreening.ai_analysis" style="margin-top:12px;padding:12px;background:#fff;border-radius:4px">
          <div style="font-weight:bold;margin-bottom:4px">AI 分析：</div>
          <div>{{ currentScreening.ai_analysis }}</div>
          <el-tag v-if="currentScreening.risk_level" style="margin-top:8px" :type="riskType(currentScreening.risk_level)">风险等级: {{ riskMap[currentScreening.risk_level] }}</el-tag>
        </div>
      </div>

      <!-- Questionnaire -->
      <div v-if="currentScreening.status === 'tool_selection' || !currentScreening.total_score">
        <p style="color:#909399">请根据 {{ currentScreening.screening_type }} 量表逐项作答：</p>
        <el-form label-width="280px">
          <el-form-item v-for="(q, i) in getQuestions(currentScreening.screening_type)" :key="i" :label="`${i+1}. ${q}`">
            <el-select v-model="answers[i]" placeholder="选择" style="width:200px">
              <el-option v-for="o in qOptions(currentScreening.screening_type, i)" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item><el-button type="primary" @click="submitAnswers" :loading="submitting">提交答案</el-button></el-form-item>
        </el-form>
      </div>

      <div v-if="currentScreening.status === 'scored' || currentScreening.status === 'completed'">
        <el-button type="success" @click="requestAnalysis" :loading="analyzing" :disabled="currentScreening.ai_analysis">AI 综合解读</el-button>
      </div>
    </el-card>

    <!-- Educational Introduction -->
    <el-collapse v-if="!currentScreening" v-model="cogCollapse" style="margin-bottom:16px">
      <el-collapse-item name="intro">
        <template #title>
          <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600">
            <el-tag type="success" size="small">指南</el-tag> 关于认知筛查 — 学术简介与操作指南
          </div>
        </template>
        <el-tabs v-model="cogEduTab">
          <el-tab-pane label="学术简介" name="academic">
            <div style="padding:4px 0">
              <div style="background:linear-gradient(135deg, #11998e 0%, #38ef7d 100%);border-radius:10px;padding:24px;color:#fff;margin-bottom:24px">
                <h3 style="margin:0 0 8px;font-size:18px">什么是认知筛查？</h3>
                <p style="margin:0;opacity:0.92;line-height:1.8">认知筛查是一系列<strong>标准化神经心理学评估工具</strong>，用于快速识别认知功能下降的早期征象。它是区分<strong>正常老化</strong>、<strong>轻度认知障碍（MCI）</strong>和<strong>痴呆</strong>的第一道关口。全球约 5500 万人患有痴呆，每年新增约 1000 万例，早期筛查可显著延缓病程。</p>
              </div>

              <h4 style="margin-bottom:16px;color:#303133">本系统使用的筛查工具</h4>
              <el-table :data="toolIntro" size="small" stripe :header-cell-style="{background:'#f5f7fa',fontWeight:'600'}">
                <el-table-column prop="name" label="工具" width="90">
                  <template #default="{row}"><el-tag size="small" type="primary">{{ row.name }}</el-tag></template>
                </el-table-column>
                <el-table-column prop="fullName" label="全称" width="200" />
                <el-table-column prop="scope" label="评估范围" width="110">
                  <template #default="{row}"><el-tag size="small" type="info">{{ row.scope }}</el-tag></template>
                </el-table-column>
                <el-table-column prop="time" label="耗时" width="80" />
                <el-table-column prop="desc" label="说明" min-width="220" />
              </el-table>

              <el-alert type="warning" :closable="false" show-icon style="margin-top:20px">
                <template #title>重要提示</template>
                <ul style="margin:4px 0 0;padding-left:16px">
                  <li style="line-height:1.8">筛查结果<strong>不能</strong>直接等同于临床诊断，阳性结果需转诊神经内科进一步评估</li>
                  <li style="line-height:1.8">受教育年限对 MMSE、MoCA 结果有显著影响，本系统已提供教育水平校正</li>
                  <li style="line-height:1.8">建议<strong>每 6-12 个月</strong>纵向追踪，分数变化趋势比单次绝对值更有临床意义</li>
                </ul>
              </el-alert>
            </div>
          </el-tab-pane>
          <el-tab-pane label="操作指南" name="guide">
            <div style="line-height:1.7">
              <h4 style="margin-bottom:16px">如何使用本系统的认知筛查功能？</h4>
              <div v-for="(step, idx) in cogSteps" :key="idx" style="display:flex;gap:16px;margin-bottom:20px;align-items:flex-start">
                <div style="min-width:40px;height:40px;border-radius:50%;background:#67c23a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;flex-shrink:0">{{ idx + 1 }}</div>
                <div style="flex:1;background:#f5f7fa;border-radius:8px;padding:16px">
                  <div style="font-weight:600;margin-bottom:4px;font-size:15px">{{ step.title }}</div>
                  <div style="color:#606266;font-size:13px;line-height:1.7">{{ step.desc }}</div>
                </div>
              </div>
              <el-alert type="warning" :closable="false" show-icon style="margin-top:12px">
                <template #title>特别提醒</template>
                AD8 量表由<strong>知情者</strong>（家属/照护者）填写，评估与过去几年相比的变化。MMSE 和 MoCA 由受检者本人作答，请勿代答。
              </el-alert>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-collapse-item>
    </el-collapse>

    <!-- Screening List -->
    <el-card v-if="!currentScreening">
      <el-table :data="screenings" stripe v-loading="loading">
        <el-table-column prop="screening_date" label="日期" width="120" />
        <el-table-column prop="screening_type" label="工具" width="80" />
        <el-table-column label="评分" width="100"><template #default="{row}">{{ row.total_score != null ? `${row.total_score}/${row.score_max}` : '—' }}</template></el-table-column>
        <el-table-column label="解读" min-width="120"><template #default="{row}">{{ interpretationMap[row.score_interpretation] || '—' }}</template></el-table-column>
        <el-table-column label="操作" width="100"><template #default="{row}"><el-button size="small" @click="openScreening(row)">查看</el-button></template></el-table-column>
      </el-table>
    </el-card>

    <!-- New Screening Dialog -->
    <el-dialog v-model="showNewDialog" title="新建认知筛查" width="400px">
      <el-form>
        <el-form-item label="筛查工具" required>
          <el-select v-model="newForm.screening_type" style="width:100%">
            <el-option v-for="t in tools" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="筛查日期" required><el-date-picker v-model="newForm.screening_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="受教育年限"><el-input-number v-model="newForm.education_years" :min="0" :max="25" style="width:100%" /></el-form-item>
        <el-form-item label="有知情者"><el-switch v-model="newForm.informant_available" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showNewDialog=false">取消</el-button><el-button type="primary" @click="createScreening">创建</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const tools = ['AD8', 'MMSE', 'MoCA', 'CDR', 'Mini_Cog', 'GPCOG'];
const screenings = ref([]), currentScreening = ref(null), loading = ref(false), submitting = ref(false), analyzing = ref(false);
const showNewDialog = ref(false), answers = ref({});
const interpretationMap = { normal: '正常', borderline: '临界', impaired: '受损', severely_impaired: '严重受损' };
const riskMap = { low: '低', moderate: '中', high: '高', very_high: '极高' };
const riskType = r => r === 'very_high' ? 'danger' : r === 'high' ? 'warning' : r === 'moderate' ? 'warning' : 'info';
const cogCollapse = ref(['intro']);
const cogEduTab = ref('academic');

const newForm = ref({ screening_type: 'MMSE', screening_date: new Date().toISOString().slice(0, 10), education_years: null, informant_available: false });

const cogSteps = [
  { title: '选择筛查工具', desc: '点击「新建筛查」，从下拉菜单选择合适的量表：AD8（知情者问卷约3分钟）、MMSE（全面筛查约10分钟）、MoCA（MCI筛查约10分钟）、CDR（痴呆分级）。' },
  { title: '填写背景信息', desc: '输入受教育年限（MMSE/MoCA 阈值因教育水平而异）和是否有知情者陪同。此项直接影响评分结果的解读准确性。' },
  { title: '逐题作答', desc: '系统展示量表所有题目。家属可协助老人作答，确保环境安静、老人情绪平稳。逐题选择后点击「提交答案」。' },
  { title: '查看评分与解读', desc: '提交后系统自动计算总分并与历史数据对比（显示趋势）。点击「AI 综合解读」获取基于评分和受教育校正的专业分析。' },
  { title: '追踪变化', desc: '建议固定使用同一量表定期筛查，系统自动关联历史记录计算分数变化，帮助及早发现认知功能加速下降的信号。' }
];

const toolIntro = [
  { name: 'AD8', fullName: '8项痴呆筛查问卷', scope: '认知变化', time: '3分钟', desc: '知情者问卷，评估过去数年的认知变化，2项及以上阳性提示需进一步评估' },
  { name: 'MMSE', fullName: '简易精神状态检查', scope: '全面认知', time: '10分钟', desc: '最广泛使用的认知筛查工具，30分制，<27分(教育校正)提示认知障碍可能' },
  { name: 'MoCA', fullName: '蒙特利尔认知评估', scope: 'MCI筛查', time: '10分钟', desc: '对轻度认知障碍敏感度优于MMSE，30分制，<26分为异常' },
  { name: 'CDR', fullName: '临床痴呆评定量表', scope: '痴呆分级', time: '30分钟', desc: '从6个维度评估痴呆严重程度(0-3分)，0=正常、0.5=可疑、1=轻度、2=中度、3=重度' },
  { name: 'Mini_Cog', fullName: '简易认知评估', scope: '快速筛查', time: '3分钟', desc: '结合3词回忆和画钟测试，适合初级保健快速筛查' },
  { name: 'GPCOG', fullName: '全科医生认知评估', scope: '初级保健', time: '5分钟', desc: '含患者评估和知情者问卷两部分，适合社区/全科场景使用' }
];

const mmseQuestions = [
  '今年是哪一年？(1分)', '现在是什么季节？(1分)', '今天是几号？(1分)', '今天是星期几？(1分)', '现在是什么月份？(1分)',
  '我们在哪个省/市？(1分)', '我们在什么区/县？(1分)', '这是什么地方？(1分)', '现在是第几层楼？(1分)', '这是什么国家？(1分)',
  '重复"皮球"', '重复"国旗"', '重复"树木"', '100-7=？(1分)', '93-7=？(1分)', '86-7=？(1分)', '79-7=？(1分)', '72-7=？(1分)',
  '回忆"皮球"(1分)', '回忆"国旗"(1分)', '回忆"树木"(1分)', '这是什么？(手表)(1分)', '这是什么？(铅笔)(1分)',
  '重复"四十四只石狮子"(1分)', '请阅读并执行"闭上您的眼睛"(1分)', '请写一句完整的句子(1分)', '请按样画图(1分)'
];

const ad8Questions = [
  '判断力是否出现问题？(如做决定困难、财务处理不当)', '对以前感兴趣的活动兴趣减退？', '是否重复谈论同一件事情？',
  '学习新工具或设备是否有困难？', '是否忘记正确的年份或月份？', '处理复杂的财务问题是否有困难？',
  '是否忘记重要的约定或约会？', '是否持续出现思考和/或记忆问题？'
];

function getQuestions(type) { return type === 'MMSE' ? mmseQuestions : type === 'AD8' ? ad8Questions : Array.from({ length: type === 'MoCA' ? 30 : 10 }, (_, i) => `题目 ${i + 1}`); }
function qOptions(type, i) {
  if (type === 'AD8') return [{ label: '否，无变化', value: 0 }, { label: '是，有变化', value: 1 }];
  return [{ label: '正确(1分)', value: 1 }, { label: '错误(0分)', value: 0 }];
}

async function loadScreenings() {
  loading.value = true;
  try { const { data } = await api.get('/cognitive-screenings'); screenings.value = data; }
  finally { loading.value = false; }
}

async function createScreening() {
  try {
    const { data } = await api.post('/cognitive-screenings', newForm.value);
    showNewDialog.value = false;
    currentScreening.value = { ...data, screening_date: newForm.value.screening_date };
    answers.value = {};
    loadScreenings();
  } catch {}
}

function openScreening(s) { currentScreening.value = s; answers.value = {}; }

async function submitAnswers() {
  if (!Object.keys(answers.value).length) return ElMessage.warning('请完成所有题目');
  submitting.value = true;
  try {
    const { data } = await api.put(`/cognitive-screenings/${currentScreening.value.id}`, { answers: answers.value });
    currentScreening.value = { ...currentScreening.value, ...data, status: 'scored' };
    ElMessage.success('评分完成');
    loadScreenings();
  } finally { submitting.value = false; }
}

async function requestAnalysis() {
  analyzing.value = true;
  try {
    const { data } = await api.post(`/cognitive-screenings/${currentScreening.value.id}/analyze`);
    currentScreening.value = { ...currentScreening.value, ...data, status: 'completed' };
    loadScreenings();
  } finally { analyzing.value = false; }
}

onMounted(loadScreenings);
</script>
