<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h2>专家分析</h2>
      <el-button v-if="!wizardActive && !processing" type="primary" @click="startWizard">新建咨询</el-button>
    </div>

    <!-- Educational intro -->
    <el-collapse v-if="!wizardActive && !processing" v-model="consultCollapse" style="margin-bottom:16px">
      <el-collapse-item name="guide">
        <template #title>
          <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600">
            <el-tag type="warning" size="small">指南</el-tag> 关于专家分析 — 功能简介与操作指南
          </div>
        </template>
        <el-tabs v-model="consultEduTab">
          <el-tab-pane label="功能简介" name="intro">
            <div style="padding:4px 0">
              <div style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);border-radius:10px;padding:24px;color:#fff;margin-bottom:24px">
                <h3 style="margin:0 0 8px;font-size:18px">专家分析是什么？</h3>
                <p style="margin:0;opacity:0.92;line-height:1.8">专家分析模块模拟<strong>多学科会诊（MDT）</strong>流程，基于您填写的结构化主诉信息，由 AI 从相关专科角度提供综合分析和建议。这<strong>不是</strong>在线问诊，也不能替代医生面诊，而是为您提供就医前的信息梳理和知识参考。</p>
              </div>

              <el-row :gutter="16" style="margin-bottom:24px">
                <el-col :span="8" v-for="item in consultBenefits" :key="item.title">
                  <div style="background:#f5f7fa;border-radius:8px;padding:18px;text-align:center;height:100%">
                    <div style="font-size:28px;margin-bottom:8px">{{ item.icon }}</div>
                    <div style="font-weight:600;margin-bottom:6px">{{ item.title }}</div>
                    <div style="font-size:13px;color:#909399;line-height:1.6">{{ item.desc }}</div>
                  </div>
                </el-col>
              </el-row>

              <h4 style="margin-bottom:16px;color:#303133">支持两种咨询模式</h4>
              <el-row :gutter="16">
                <el-col :span="12">
                  <div style="background:#ecf5ff;border-left:3px solid #409eff;border-radius:4px;padding:16px;height:100%">
                    <div style="font-weight:600;color:#409eff;margin-bottom:6px;font-size:15px">单专科咨询</div>
                    <div style="font-size:13px;color:#606266;line-height:1.7;margin-bottom:6px">针对特定科室的问题，由 AI 从该专科角度分析并给出建议。</div>
                    <div style="font-size:12px;color:#909399">适用场景：心慌→心内科 / 血糖控制不佳→内分泌科</div>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div style="background:#fdf6ec;border-left:3px solid #e6a23c;border-radius:4px;padding:16px;height:100%">
                    <div style="font-weight:600;color:#e6a23c;margin-bottom:6px;font-size:15px">MDT 多学科会诊</div>
                    <div style="font-size:13px;color:#606266;line-height:1.7;margin-bottom:6px">涉及多系统的复杂问题，AI 同时从多个专科角度综合分析，模拟真实 MDT 流程。</div>
                    <div style="font-size:12px;color:#909399">适用场景：糖尿病+高血压+蛋白尿 → 内分泌+心内+肾内</div>
                  </div>
                </el-col>
              </el-row>
            </div>
          </el-tab-pane>
          <el-tab-pane label="操作指南" name="guide">
            <div style="line-height:1.7">
              <h4 style="margin-bottom:16px">如何使用专家分析？</h4>
              <div v-for="(step, idx) in consultSteps" :key="idx" style="display:flex;gap:16px;margin-bottom:20px;align-items:flex-start">
                <div style="min-width:40px;height:40px;border-radius:50%;background:#e6a23c;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;flex-shrink:0">{{ idx + 1 }}</div>
                <div style="flex:1;background:#f5f7fa;border-radius:8px;padding:16px">
                  <div style="font-weight:600;margin-bottom:4px;font-size:15px">{{ step.title }}</div>
                  <div style="color:#606266;font-size:13px;line-height:1.7">{{ step.desc }}</div>
                </div>
              </div>
              <el-alert type="warning" :closable="false" show-icon style="margin-top:16px">
                <template #title>重要提醒</template>
                AI 分析仅供参考，不能替代医生诊断。如出现胸痛、呼吸困难、意识改变等急症，请立即拨打 120 就医。
              </el-alert>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-collapse-item>
    </el-collapse>

    <!-- Step Wizard -->
    <template v-if="wizardActive && !processing">
      <el-steps :active="step" finish-status="success" align-center style="margin-bottom:24px">
        <el-step title="选择专科" />
        <el-step title="填写主诉" />
        <el-step title="补充信息" />
        <el-step title="确认提交" />
      </el-steps>

      <!-- Step 1: Select specialty -->
      <el-card v-if="step === 0">
        <template #header><span style="font-weight:bold">第1步：选择咨询类型和专科</span></template>
        <el-form label-width="100px">
          <el-form-item label="咨询类型" required>
            <el-radio-group v-model="wizard.type">
              <el-radio value="specialist">单专科咨询 — 针对某一特定科室的问题</el-radio>
              <el-radio value="mdt">MDT 多学科会诊 — 涉及多个系统的复杂问题</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="wizard.type === 'specialist'" label="选择专科" required>
            <el-select v-model="wizard.specialty" placeholder="请选择科室" style="width:320px">
              <el-option v-for="s in specialties" :key="s.value" :label="s.label" :value="s.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-else label="选择专科" required>
            <el-select v-model="wizard.mdtSpecialties" multiple placeholder="至少选择 2 个专科" style="width:320px">
              <el-option v-for="s in specialties" :key="s.value" :label="s.label" :value="s.value" />
            </el-select>
            <div style="font-size:12px;color:#909399;margin-top:4px">已选 {{ wizard.mdtSpecialties.length }} 个专科</div>
          </el-form-item>
        </el-form>
        <div style="margin-top:16px;text-align:right">
          <el-button type="primary" @click="nextStep" :disabled="!checkStep0()">下一步</el-button>
        </div>
      </el-card>

      <!-- Step 2: Structured complaint -->
      <el-card v-if="step === 1">
        <template #header>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:bold">第2步：结构化填写主诉</span>
            <el-button size="small" text type="primary" @click="showTemplate = !showTemplate">{{ showTemplate ? '收起模板' : '使用填写模板' }}</el-button>
          </div>
        </template>

        <!-- Quick templates -->
        <div v-if="showTemplate" style="margin-bottom:16px;padding:12px;background:#f0f9ff;border-radius:4px">
          <div style="font-weight:bold;margin-bottom:8px">常见主诉模板（点击快速填入）：</div>
          <el-tag v-for="t in templates" :key="t.name" style="margin:4px;cursor:pointer" type="info" @click="applyTemplate(t)">{{ t.name }}</el-tag>
        </div>

        <el-form label-width="120px">
          <el-form-item label="主要症状" required>
            <div style="display:flex;gap:4px;width:100%">
              <el-input v-model="wizard.chiefComplaint" type="textarea" :rows="3"
                placeholder="请详细描述您的主要症状。例如：持续胸闷3天，以胸骨后压榨感为主，活动后加重，休息后缓解..."
                style="flex:1" />
              <VoiceInput v-model="wizard.chiefComplaint" />
            </div>
            <div style="font-size:12px;color:#909399;margin-top:4px">
              建议包含：症状部位 + 性质 + 持续时间 + 诱发/缓解因素
            </div>
          </el-form-item>

          <el-form-item label="持续时间">
            <el-input v-model="wizard.duration" placeholder="如：3天 / 2周 / 1个月 / 反复发作半年" />
          </el-form-item>

          <el-form-item label="诱发因素">
            <el-input v-model="wizard.triggers" placeholder="如：劳累后加重、进食油腻后出现、天气变化后..." />
          </el-form-item>

          <el-form-item label="伴随症状">
            <div style="display:flex;gap:4px;width:100%">
              <el-input v-model="wizard.accompanying" type="textarea" :rows="2"
                placeholder="如：伴恶心、出汗、头晕、气短...（若无则填'无'）" style="flex:1" />
              <VoiceInput v-model="wizard.accompanying" />
            </div>
          </el-form-item>

          <el-form-item label="既往病史">
            <div style="display:flex;gap:4px;width:100%">
              <el-input v-model="wizard.pastHistory" type="textarea" :rows="2"
                placeholder="如：高血压病史10年，2型糖尿病5年...（与本次主诉相关的既往诊断）" style="flex:1" />
              <VoiceInput v-model="wizard.pastHistory" />
            </div>
          </el-form-item>

          <el-form-item label="当前用药">
            <div style="display:flex;gap:4px;width:100%">
              <el-input v-model="wizard.currentMeds" type="textarea" :rows="2"
                placeholder="如：硝苯地平 30mg qd、二甲双胍 0.5g bid...（与本次主诉相关的当前用药）" style="flex:1" />
              <VoiceInput v-model="wizard.currentMeds" />
            </div>
          </el-form-item>

          <el-form-item label="咨询重点">
            <el-input v-model="wizard.question" type="textarea" :rows="2"
              placeholder="您最想了解什么？如：是否需要调整用药？需要做哪些检查？目前的治疗方案是否合理？" />
          </el-form-item>
        </el-form>

        <div style="margin-top:16px;text-align:right;display:flex;justify-content:space-between">
          <el-button @click="step = 0">上一步</el-button>
          <el-button type="primary" @click="nextStep" :disabled="!wizard.chiefComplaint.trim()">下一步</el-button>
        </div>
      </el-card>

      <!-- Step 3: Additional info -->
      <el-card v-if="step === 2">
        <template #header><span style="font-weight:bold">第3步：补充相关信息（可选）</span></template>
        <el-form label-width="120px">
          <el-form-item label="关联报告">
            <el-select v-model="wizard.reportIds" multiple placeholder="选择相关的健康报告（可选）" style="width:100%">
              <el-option v-for="r in recentReports" :key="r.id" :label="`${r.title} (${r.report_date})`" :value="r.id" />
            </el-select>
            <div style="font-size:12px;color:#909399;margin-top:4px">关联报告可帮助 AI 获取更多检验检查数据</div>
          </el-form-item>
          <el-form-item label="额外说明">
            <div style="display:flex;gap:4px;width:100%">
              <el-input v-model="wizard.extraNotes" type="textarea" :rows="3"
                placeholder="其他您认为对分析有帮助的信息..." style="flex:1" />
              <VoiceInput v-model="wizard.extraNotes" />
            </div>
          </el-form-item>
        </el-form>
        <div style="margin-top:16px;text-align:right;display:flex;justify-content:space-between">
          <el-button @click="step = 1">上一步</el-button>
          <el-button type="primary" @click="step = 3">下一步（预览）</el-button>
        </div>
      </el-card>

      <!-- Step 4: Review & Submit -->
      <el-card v-if="step === 3">
        <template #header><span style="font-weight:bold">第4步：确认信息并提交</span></template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="咨询类型">{{ wizard.type === 'specialist' ? '单专科咨询' : 'MDT 多学科会诊' }}</el-descriptions-item>
          <el-descriptions-item label="专科">{{ wizard.type === 'specialist' ? specialtyLabel(wizard.specialty) : wizard.mdtSpecialties.map(specialtyLabel).join('、') }}</el-descriptions-item>
          <el-descriptions-item label="主要症状">{{ wizard.chiefComplaint }}</el-descriptions-item>
          <el-descriptions-item v-if="wizard.duration" label="持续时间">{{ wizard.duration }}</el-descriptions-item>
          <el-descriptions-item v-if="wizard.triggers" label="诱发因素">{{ wizard.triggers }}</el-descriptions-item>
          <el-descriptions-item v-if="wizard.accompanying" label="伴随症状">{{ wizard.accompanying }}</el-descriptions-item>
          <el-descriptions-item v-if="wizard.pastHistory" label="既往病史">{{ wizard.pastHistory }}</el-descriptions-item>
          <el-descriptions-item v-if="wizard.currentMeds" label="当前用药">{{ wizard.currentMeds }}</el-descriptions-item>
          <el-descriptions-item v-if="wizard.question" label="咨询重点">{{ wizard.question }}</el-descriptions-item>
        </el-descriptions>

        <div style="margin-top:16px;text-align:right;display:flex;justify-content:space-between">
          <el-button @click="step = 2">上一步</el-button>
          <el-button type="primary" @click="submitConsultation" :loading="submitting">确认并提交</el-button>
        </div>
      </el-card>
    </template>

    <!-- Processing Progress -->
    <el-card v-if="processing" style="max-width:600px;margin:0 auto">
      <template #header><span style="font-weight:bold">AI 分析进行中</span></template>
      <div style="text-align:center;padding:20px 0">
        <el-steps :active="processingStep" direction="vertical" style="text-align:left">
          <el-step v-for="ps in processSteps" :key="ps.key" :title="ps.title" :description="ps.desc"
            :status="processingStep > ps.idx ? 'success' : processingStep === ps.idx ? 'process' : 'wait'" />
        </el-steps>
        <el-progress v-if="!processDone" :percentage="processPercent" :stroke-width="8" style="margin-top:20px" />
        <div v-if="processDone" style="margin-top:20px">
          <el-button type="primary" @click="viewResult">查看分析结果</el-button>
          <el-button @click="resetWizard">发起新咨询</el-button>
        </div>
        <div v-if="processError" style="margin-top:16px">
          <el-alert type="error" title="分析失败" :description="processError" show-icon :closable="false" />
          <el-button style="margin-top:12px" @click="resetWizard">重新发起</el-button>
        </div>
      </div>
    </el-card>

    <!-- Consultation History -->
    <el-card v-if="!wizardActive && !processing">
      <el-tabs v-model="tab">
        <el-tab-pane label="咨询历史" name="history">
          <el-table :data="consultations" stripe v-loading="loading">
            <el-table-column label="类型" width="100">
              <template #default="{row}">{{ row.consultation_type === 'mdt' ? 'MDT会诊' : '单专科' }}</template>
            </el-table-column>
            <el-table-column prop="specialty" label="专科" width="120">
              <template #default="{row}">{{ row.mdt_specialties ? JSON.parse(row.mdt_specialties).map(specialtyLabel).join('、') : specialtyLabel(row.specialty) }}</template>
            </el-table-column>
            <el-table-column prop="chief_complaint" label="主诉" min-width="200" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{row}">
                <el-tag :type="row.status === 'completed' ? 'success' : row.status === 'processing' ? 'warning' : row.status === 'failed' ? 'danger' : 'info'">
                  {{ statusMap[row.status] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="时间" width="160" />
            <el-table-column label="操作" width="100">
              <template #default="{row}">
                <el-button v-if="row.status === 'completed' && row.ai_response" size="small" text type="primary" @click="viewHistoryItem(row)">查看分析</el-button>
                <span v-else style="color:#909399;font-size:12px">—</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- Result Dialog with Follow-up Chat -->
    <el-dialog v-model="showResult" :title="currentConsultTitle || 'AI 分析结果'" width="760px" top="3vh" @close="closeResult">
      <div v-if="resultContent" style="margin-bottom:20px">
        <div style="line-height:1.9;white-space:pre-wrap;font-size:15px;background:#fafbfc;border-radius:10px;padding:20px;border-left:4px solid #409eff">{{ resultContent }}</div>
      </div>
      <el-empty v-else description="暂无分析内容" />

      <!-- Follow-up Q&A Section -->
      <div v-if="resultContent && currentConsultId" style="border-top:1px solid #ebeef5;padding-top:16px">
        <h4 style="margin:0 0 6px;color:#303133">💬 继续咨询</h4>
        <p style="font-size:13px;color:#909399;margin:0 0 12px">针对分析内容，您可以继续追问，我会结合慢病管理知识为您解答。</p>

        <!-- Chat messages -->
        <div v-if="followUpMessages.length > 0" style="max-height:320px;overflow-y:auto;margin-bottom:12px;background:#fafafa;border-radius:8px;padding:12px">
          <div v-for="(msg, idx) in followUpMessages" :key="idx" style="margin-bottom:12px;display:flex;flex-direction:column;align-items:flex-start">
            <div v-if="msg.role === 'user'" style="align-self:flex-end;max-width:80%;background:#409eff;color:#fff;border-radius:12px 12px 0 12px;padding:10px 14px;font-size:14px;line-height:1.6">{{ msg.content }}</div>
            <div v-else style="max-width:85%;background:#fff;border:1px solid #e4e7ed;border-radius:12px 12px 12px 0;padding:10px 14px;font-size:14px;line-height:1.7;white-space:pre-wrap">{{ msg.content }}</div>
            <div style="font-size:11px;color:#c0c4cc;margin-top:2px;align-self:flex-end" v-if="msg.role === 'user'">{{ msg.time }}</div>
            <div style="font-size:11px;color:#c0c4cc;margin-top:2px" v-else>{{ msg.time }}</div>
          </div>
        </div>

        <!-- Follow-up input -->
        <div style="display:flex;gap:8px">
          <el-input v-model="followUpInput" placeholder="在这里输入您的追问，如：我这种情况需要做什么检查？" @keyup.enter="sendFollowUp" :disabled="followUpLoading" style="flex:1" />
          <el-button type="primary" @click="sendFollowUp" :loading="followUpLoading">发送</el-button>
        </div>
        <div v-if="followUpKnowledge" style="font-size:12px;color:#67c23a;margin-top:6px">已匹配知识库：{{ followUpKnowledge }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';
import VoiceInput from '../components/VoiceInput.vue';

const tab = ref('history');
const loading = ref(false), submitting = ref(false);
const consultations = ref([]);
const recentReports = ref([]);
const wizardActive = ref(false);
const processing = ref(false);
const processDone = ref(false);
const processError = ref('');
const processingStep = ref(0);
const step = ref(0);
const showTemplate = ref(false);
const showResult = ref(false);
const resultContent = ref('');
const currentConsultId = ref(null);
const currentConsultTitle = ref('');
const followUpInput = ref('');
const followUpLoading = ref(false);
const followUpMessages = ref([]);
const followUpKnowledge = ref('');

const statusMap = { pending: '等待中', processing: '分析中', completed: '已完成', failed: '失败' };

const processSteps = [
  { key: 'parse', idx: 0, title: '解析主诉信息', desc: '提取关键症状、体征、病史要素...' },
  { key: 'context', idx: 1, title: '关联健康数据', desc: '匹配相关检查报告与用药记录...' },
  { key: 'knowledge', idx: 2, title: '匹配医学知识库', desc: '对照专科诊疗指南与药物相互作用...' },
  { key: 'generate', idx: 3, title: '生成综合分析', desc: '输出专科视角解读与建议...' },
  { key: 'done', idx: 4, title: '分析完成', desc: '您可查看完整分析报告' }
];

const processPercent = ref(0);
const consultCollapse = ref(['guide']);
const consultEduTab = ref('intro');

const consultBenefits = [
  { icon: '🏥', title: '多学科视角', desc: '覆盖心内科、内分泌科、消化科等16个专科，支持MDT多学科联合会诊' },
  { icon: '📝', title: '结构化填写', desc: '分步引导填写主诉要素，支持语音输入和常见主诉模板快速填入' },
  { icon: '🤖', title: 'AI 深度分析', desc: '基于主诉内容匹配医学知识库，生成含专科解读和就医建议的综合报告' }
];

const consultSteps = [
  { title: '选择咨询类型和专科', desc: '根据问题选择单专科咨询或 MDT 多学科会诊。单专科适合明确的专科问题（如心脏不适→心内科），MDT 适合涉及多系统的复杂问题（如糖尿病+高血压+肾功能异常）。' },
  { title: '结构化填写主诉', desc: '系统引导按医学主诉要素逐项填写：主要症状、持续时间、诱发因素、伴随症状、既往病史、当前用药等。支持语音输入和模板快速填入，填写越详细 AI 分析越精准。' },
  { title: '补充相关信息（可选）', desc: '可关联相关的健康报告和用药记录，帮助 AI 获取更多上下文信息进行综合分析。' },
  { title: '确认并提交', desc: '预览填写的全部信息，确认无误后提交。系统将按步骤展示 AI 分析处理进度。' },
  { title: '查看分析结果', desc: 'AI 生成的分析报告包含：专科视角解读、需关注的检查指标、用药注意事项、就医建议。分析结果可在「咨询历史」中随时回顾。' }
];

const specialties = [
  { label: '心内科', value: 'cardiology' }, { label: '内分泌科', value: 'endocrinology' },
  { label: '消化科', value: 'gastroenterology' }, { label: '肾内科', value: 'nephrology' },
  { label: '神经内科', value: 'neurology' }, { label: '肿瘤科', value: 'oncology' },
  { label: '呼吸科', value: 'respiratory' }, { label: '血液科', value: 'hematology' },
  { label: '全科', value: 'general' }, { label: '皮肤科', value: 'dermatology' },
  { label: '骨科', value: 'orthopedics' }, { label: '老年科', value: 'geriatrics' },
  { label: '妇科', value: 'gynecology' }, { label: '泌尿科', value: 'urology' },
  { label: '精神科', value: 'psychiatry' }, { label: '风湿免疫科', value: 'rheumatology' }
];

const templates = [
  { name: '胸闷/胸痛', text: '反复胸闷不适，位于胸骨后，呈压榨感/闷痛，每次持续5-10分钟，活动或情绪激动时诱发，休息后缓解。伴气短、出汗。' },
  { name: '头晕/眩晕', text: '反复头晕，呈旋转感/昏沉感，站立或转头时加重，平卧可缓解。伴恶心，无呕吐。既往有高血压病史。' },
  { name: '腹痛/消化不良', text: '上腹部隐痛不适，进食后加重（或空腹时明显），伴反酸、嗳气、腹胀。' },
  { name: '咳嗽/呼吸困难', text: '持续干咳（或有痰），以夜间为甚，伴胸闷、气短。活动后呼吸困难加重。' },
  { name: '关节疼痛', text: '双膝关节（或其他关节）疼痛，晨起僵硬约30分钟，活动后可缓解。上下楼梯时疼痛加重。' },
  { name: '血糖控制', text: '近期空腹血糖波动在7-9mmol/L，餐后2小时血糖11-14mmol/L。目前口服二甲双胍0.5g bid，饮食控制一般。想了解是否需要调整方案。' },
  { name: '失眠/睡眠障碍', text: '入睡困难，每晚需1-2小时才能入睡，或夜间易醒（2-3次），醒后难以再入睡。白天精神不振，注意力不集中。' },
  { name: '记忆力下降', text: '近半年来记忆力明显下降，特别是近期事件（如刚放的东西就找不到），但远期记忆尚可。家人反映有时重复问同一问题。' }
];

const wizard = ref({
  type: 'specialist',
  specialty: '',
  mdtSpecialties: [],
  chiefComplaint: '',
  duration: '',
  triggers: '',
  accompanying: '',
  pastHistory: '',
  currentMeds: '',
  question: '',
  reportIds: [],
  extraNotes: ''
});

function checkStep0() {
  if (wizard.value.type === 'specialist') return !!wizard.value.specialty;
  return wizard.value.mdtSpecialties.length >= 2;
}

function specialtyLabel(val) {
  const found = specialties.find(s => s.value === val);
  return found ? found.label : val;
}

function startWizard() {
  wizard.value = {
    type: 'specialist', specialty: '', mdtSpecialties: [],
    chiefComplaint: '', duration: '', triggers: '', accompanying: '',
    pastHistory: '', currentMeds: '', question: '', reportIds: [], extraNotes: ''
  };
  step.value = 0;
  showTemplate.value = false;
  wizardActive.value = true;
  processing.value = false;
  processDone.value = false;
  processError.value = '';
  loadRecentReports();
}

function nextStep() {
  if (step.value === 0) {
    if (!checkStep0()) return ElMessage.warning(wizard.value.type === 'specialist' ? '请选择专科' : '请至少选择2个专科');
  }
  step.value++;
}

function applyTemplate(t) {
  wizard.value.chiefComplaint = t.text;
  showTemplate.value = false;
}

function resetWizard() {
  wizardActive.value = false;
  processing.value = false;
  processDone.value = false;
  processError.value = '';
  step.value = 0;
  loadHistory();
}

async function loadRecentReports() {
  try {
    const { data } = await api.get('/reports', { params: { limit: 10 } });
    recentReports.value = data.data || [];
  } catch {}
}

function buildComplaintText() {
  let text = wizard.value.chiefComplaint;
  if (wizard.value.duration) text += `\n持续时间：${wizard.value.duration}`;
  if (wizard.value.triggers) text += `\n诱发因素：${wizard.value.triggers}`;
  if (wizard.value.accompanying) text += `\n伴随症状：${wizard.value.accompanying}`;
  if (wizard.value.pastHistory) text += `\n既往病史：${wizard.value.pastHistory}`;
  if (wizard.value.currentMeds) text += `\n当前用药：${wizard.value.currentMeds}`;
  if (wizard.value.question) text += `\n咨询重点：${wizard.value.question}`;
  if (wizard.value.extraNotes) text += `\n补充说明：${wizard.value.extraNotes}`;
  return text;
}

async function submitConsultation() {
  submitting.value = true;
  try {
    const complaintText = buildComplaintText();
    let endpoint, payload;

    if (wizard.value.type === 'specialist') {
      endpoint = '/consultations/specialist';
      payload = {
        specialty: wizard.value.specialty,
        chief_complaint: complaintText,
        related_report_ids: wizard.value.reportIds.length ? wizard.value.reportIds : null
      };
    } else {
      endpoint = '/consultations/mdt';
      payload = {
        specialties: wizard.value.mdtSpecialties,
        chief_complaint: complaintText,
        related_report_ids: wizard.value.reportIds.length ? wizard.value.reportIds : null
      };
    }

    const { data } = await api.post(endpoint, payload);
    wizardActive.value = false;
    startProcessing(data.id);
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '提交失败');
  } finally { submitting.value = false; }
}

function startProcessing(consultationId) {
  processing.value = true;
  processingStep.value = 0;
  processPercent.value = 0;
  processDone.value = false;
  processError.value = '';

  // Start the real AI call immediately
  const aiPromise = fetchResult(consultationId);

  // Animate progress while waiting for the real API
  const totalSteps = 5;
  const minStepDuration = 1500;
  let stopped = false;

  function advance() {
    if (stopped || processDone.value) return;
    if (processingStep.value < totalSteps - 1) {
      processingStep.value++;
      processPercent.value = Math.round((processingStep.value / totalSteps) * 100);
      setTimeout(advance, minStepDuration + Math.random() * 800);
    }
  }

  setTimeout(advance, 800);

  // When AI call finishes, jump to complete
  aiPromise.then(() => {
    stopped = true;
    if (!processError.value) {
      processingStep.value = totalSteps;
      processPercent.value = 100;
      processDone.value = true;
    }
  });
}

async function fetchResult(id) {
  try {
    await api.post(`/consultations/${id}/process`);
    const { data } = await api.get('/consultations');
    const item = data.find(c => c.id === id);
    if (item?.ai_response) {
      resultContent.value = item.ai_response;
      currentConsultId.value = item.id;
      currentConsultTitle.value = item.mdt_specialties
        ? 'MDT 会诊 — ' + JSON.parse(item.mdt_specialties).map(specialtyLabel).join('、')
        : '单专科咨询 — ' + specialtyLabel(item.specialty);
    }
  } catch (err) {
    processError.value = err?.response?.data?.error || 'AI 分析失败，请检查 API 配置后重试。';
  }
}

function viewResult() {
  showResult.value = true;
}

function viewHistoryItem(row) {
  resultContent.value = row.ai_response || '暂无分析内容';
  currentConsultId.value = row.id;
  currentConsultTitle.value = row.mdt_specialties
    ? 'MDT 会诊 — ' + JSON.parse(row.mdt_specialties).map(specialtyLabel).join('、')
    : '单专科咨询 — ' + specialtyLabel(row.specialty);
  followUpMessages.value = [];
  followUpKnowledge.value = '';
  showResult.value = true;
}

function closeResult() {
  followUpMessages.value = [];
  followUpInput.value = '';
  followUpKnowledge.value = '';
}

async function sendFollowUp() {
  const q = followUpInput.value.trim();
  if (!q || !currentConsultId.value) return;

  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  followUpMessages.value.push({ role: 'user', content: q, time });
  followUpInput.value = '';
  followUpLoading.value = true;

  try {
    const history = followUpMessages.value
      .filter(m => m.role !== 'knowledge')
      .map(m => ({ role: m.role, content: m.content }));

    const { data } = await api.post(`/consultations/${currentConsultId.value}/follow-up`, {
      question: q,
      conversation_history: history.slice(0, -1) // exclude the current question
    });

    followUpMessages.value.push({
      role: 'assistant',
      content: data.response,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    });
    if (data.knowledge_used) {
      followUpKnowledge.value = data.knowledge_used;
    }
  } catch (err) {
    followUpMessages.value.push({
      role: 'assistant',
      content: '抱歉，暂时无法回复您的问题。请稍后再试，或检查 AI API 配置。',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    });
  } finally {
    followUpLoading.value = false;
  }
}

async function loadHistory() {
  loading.value = true;
  try {
    const { data } = await api.get('/consultations');
    consultations.value = data;
  } catch {} finally { loading.value = false; }
}

onMounted(loadHistory);
</script>
