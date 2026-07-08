<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">用药管理</h2>
      <div>
        <el-button type="primary" @click="openAddDialog">添加用药</el-button>
        <el-button type="warning" @click="checkInteractions" :loading="checking">检测相互作用</el-button>
      </div>
    </div>

    <!-- Interaction Results -->
    <el-alert v-if="interactionResult" :title="`发现 ${interactionResult.total_count} 条药物相互作用`"
      :type="interactionResult.x_count > 0 ? 'error' : interactionResult.d_count > 0 ? 'warning' : 'info'"
      :closable="true" style="margin-bottom:16px" />
    <div v-if="interactionResult?.interactions?.length">
      <el-card v-for="ir in interactionResult.interactions" :key="ir.drug_pair" style="margin-bottom:8px"
        :style="{ borderLeft: `4px solid ${severityColor(ir.severity)}` }">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>{{ ir.drug_pair }}</strong> — {{ ir.mechanism || '机制不详' }}</div>
          <el-tag :type="severityType(ir.severity)">{{ ir.severity }} 级</el-tag>
        </div>
        <div v-if="ir.management" style="color:#909399;margin-top:4px;font-size:13px">{{ ir.management }}</div>
      </el-card>
    </div>

    <!-- Medication List -->
    <el-card>
      <el-table :data="medications" stripe v-loading="loading">
        <el-table-column prop="drug_name" label="药品名" min-width="140" />
        <el-table-column label="剂量" width="110">
          <template #default="{row}">{{ row.dosage }}{{ row.dosage_unit || '' }}</template>
        </el-table-column>
        <el-table-column label="频率" width="130">
          <template #default="{row}">
            <div>{{ row.frequency_cn || row.frequency }}</div>
            <div v-if="row.timing_cn && row.timing_cn !== '不限'" style="font-size:12px;color:#909399">{{ row.timing_cn }}</div>
          </template>
        </el-table-column>
        <el-table-column label="用法" width="90">
          <template #default="{row}">{{ routeMap[row.route] || row.route }}</template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始" width="110" />
        <el-table-column prop="end_date" label="结束" width="110">
          <template #default="{row}">{{ row.end_date || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{row}">
            <el-select v-model="row.status" size="small" @change="updateStatus(row)">
              <el-option label="使用中" value="active" />
              <el-option label="已停用" value="discontinued" />
              <el-option label="已完成" value="completed" />
              <el-option label="已暂停" value="paused" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="提醒" width="80" align="center">
          <template #default="{row}">
            <el-button size="small" text type="primary" @click="openReminder(row)">🔔</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="center">
          <template #default="{row}">
            <el-button size="small" text type="primary" @click="editMed(row)">编辑</el-button>
            <el-button size="small" text type="danger" @click="deleteMed(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog (with integrated photo recognition) -->
    <el-dialog v-model="showAddDialog" :title="editingMed ? '编辑用药' : '添加用药'" width="750px" @close="closeDialog">
      <el-form label-width="90px">
        <!-- Photo recognition - prominent top section -->
        <div style="margin-bottom:18px;padding:14px 16px;background:linear-gradient(135deg, #f0f5f7 0%, #f7f9fa 100%);border-radius:12px;border:1px dashed #c8d6db">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:20px">📷</span>
              <div>
                <div style="font-weight:600;color:#303133;font-size:14px">拍照识别药品</div>
                <div style="font-size:12px;color:#909399">拍摄药盒或说明书，自动识别并填写药品信息</div>
              </div>
            </div>
            <el-button type="primary" @click="triggerPhotoRecognition" :loading="photoRecognizing" size="large">
              {{ photoRecognizing ? '识别中...' : '选择照片' }}
            </el-button>
          </div>
          <input ref="photoFileInput" type="file" accept="image/jpeg,image/png,image/webp" style="display:none" @change="onPhotoSelected" />

          <!-- Photo preview & results -->
          <div v-if="photoPreview || photoResult || photoError" style="margin-top:12px">
            <div v-if="photoPreview && !photoResult && !photoError" style="text-align:center">
              <img :src="photoPreview" style="max-width:100%;max-height:180px;border-radius:8px;margin-bottom:6px" />
              <div style="color:#909399;font-size:13px">AI 正在识别药品信息...</div>
            </div>
            <div v-if="photoResult" style="text-align:left;padding:12px;background:#fff;border-radius:8px;border:1px solid #e8ecf0">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-weight:600;color:#303133">识别结果</span>
                <span style="font-size:12px;color:#909399">置信度：{{ { high: '高', medium: '中', low: '低' }[photoResult.confidence] || '未知' }}</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:13px;line-height:2;margin-bottom:8px">
                <div><span style="color:#909399">药品名：</span>{{ photoResult.drug_name || '未识别' }}</div>
                <div><span style="color:#909399">通用名：</span>{{ photoResult.generic_name || '未识别' }}</div>
                <div><span style="color:#909399">每片规格：</span>{{ photoResult.spec_per_pill ? photoResult.spec_per_pill + (photoResult.spec_unit || 'mg') : '未识别' }}</div>
                <div><span style="color:#909399">厂家：</span>{{ photoResult.manufacturer || '未识别' }}</div>
              </div>
              <div v-if="photoResult.usage_direction" style="font-size:13px;line-height:1.6;margin-bottom:4px"><span style="color:#909399">用法用量：</span>{{ photoResult.usage_direction }}</div>
              <div v-if="photoResult.warnings" style="font-size:13px;line-height:1.6;color:#e6a23c;margin-bottom:8px">⚠ {{ photoResult.warnings }}</div>
              <div v-if="photoConversion" style="padding:8px 12px;background:#fefce8;border-radius:6px;border-left:3px solid #e6a23c;margin-bottom:8px">
                <div style="font-weight:600;margin-bottom:4px;font-size:13px;color:#303133">用量换算参考（每片{{ photoConversion.per_pill_mg }}mg）</div>
                <div v-for="c in photoConversion.common_dosages" :key="c.target_mg" style="font-size:13px;line-height:1.8;color:#606266">{{ c.readable }}</div>
              </div>
              <div style="display:flex;gap:8px">
                <el-button size="small" @click="clearPhotoRecognition">清除</el-button>
                <el-button size="small" type="primary" @click="autoFillFromPhoto" :disabled="!photoResult.drug_name">填入表单</el-button>
              </div>
            </div>
            <div v-if="photoError" style="text-align:center">
              <el-alert type="error" :title="photoError" show-icon :closable="false" style="margin-bottom:8px" />
              <el-button size="small" @click="clearPhotoRecognition">关闭</el-button>
            </div>
          </div>
        </div>

        <!-- Drug name -->
        <el-form-item label="药品名" required>
          <div style="display:flex;gap:4px;width:100%">
            <el-input v-model="form.drug_name" placeholder="如：阿托伐他汀钙片" style="flex:1" />
            <VoiceInput v-model="form.drug_name" />
          </div>
        </el-form-item>

        <el-form-item label="通用名">
          <div style="display:flex;gap:4px;width:100%">
            <el-input v-model="form.generic_name" placeholder="如：Atorvastatin" style="flex:1" />
            <VoiceInput v-model="form.generic_name" />
          </div>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="13">
            <el-form-item label="剂量" required>
              <div style="display:flex;gap:4px">
                <el-input v-model="form.dosage" placeholder="如：20" @input="updatePillConversion" style="flex:1" />
                <VoiceInput v-model="form.dosage" />
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="11">
            <el-form-item label="单位" required label-width="50px">
              <el-select v-model="form.dosage_unit" placeholder="选择" @change="updatePillConversion" style="width:100%">
                <el-option v-for="u in units" :key="u" :label="u" :value="u" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="13">
            <el-form-item label="每片mg">
              <div style="display:flex;gap:4px">
                <el-input v-model="form.spec_per_pill_mg" placeholder="如：10" @input="onSpecChange" style="flex:1" />
                <VoiceInput v-model="form.spec_per_pill_mg" />
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <!-- Friendly pill conversion -->
        <div v-if="pillConversionDisplay" style="margin-bottom:18px;padding:10px 14px;background:#fefce8;border-radius:8px;border-left:4px solid #e6a23c;font-size:14px;line-height:1.8">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:18px">💊</span>
            <span>{{ pillConversionDisplay }}</span>
          </div>
        </div>
        <el-form-item label="服用频率" required>
          <div style="display:flex;gap:4px;width:100%">
            <el-input v-model="form.frequency" placeholder="如：一天一次，一次一片，饭后服用" @input="onFreqInput" style="flex:1" />
            <VoiceInput v-model="form.frequency" />
          </div>
          <div v-if="freqPreview" style="margin-top:4px;font-size:12px;color:#67c23a">
            识别：<el-tag size="small" type="success">{{ freqPreview.freqLabel }}</el-tag>
            <el-tag v-if="freqPreview.timingLabel" size="small" type="warning" style="margin-left:4px">{{ freqPreview.timingLabel }}</el-tag>
            <span v-if="freqPreview.schedule" style="margin-left:4px;color:#909399">服药时间: {{ freqPreview.schedule }}</span>
          </div>
        </el-form-item>
        <el-form-item label="给药途径" required>
          <el-select v-model="form.route" style="width:100%">
            <el-option v-for="(label, val) in routeMap" :key="val" :label="label" :value="val" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期" required><el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.end_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="备注">
          <div style="display:flex;gap:4px;width:100%">
            <el-input v-model="form.notes" type="textarea" placeholder="其他说明" style="flex:1" />
            <VoiceInput v-model="form.notes" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="closeDialog">取消</el-button><el-button type="primary" @click="saveMedication" :loading="saving">{{ editingMed ? '更新' : '保存' }}</el-button></template>
    </el-dialog>

    <!-- Reminder Dialog -->
    <el-dialog v-model="showReminderDialog" title="设置服药提醒" width="460px">
      <template v-if="reminderMed">
        <p style="margin-bottom:12px"><strong>{{ reminderMed.drug_name }}</strong> {{ reminderMed.dosage }}{{ reminderMed.dosage_unit || '' }}</p>
        <el-form label-width="90px">
          <el-form-item label="提醒方式" required>
            <el-radio-group v-model="reminderForm.reminder_type">
              <el-radio value="app">App 内提醒</el-radio>
              <el-radio value="sms">短信提醒</el-radio>
              <el-radio value="phone">电话提醒</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="reminderForm.reminder_type !== 'app'" label="手机号码" required>
            <el-input v-model="reminderForm.phone_number" placeholder="输入手机号码" />
          </el-form-item>
          <el-form-item label="提醒时间" required>
            <el-time-picker v-model="reminderForm.remind_time" format="HH:mm" value-format="HH:mm" placeholder="选择时间" />
          </el-form-item>
          <el-form-item label="重复日期">
            <el-checkbox-group v-model="reminderForm.days">
              <el-checkbox v-for="d in weekDays" :key="d.val" :label="d.val" :value="d.val">{{ d.label }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="showReminderDialog=false">取消</el-button>
        <el-button type="primary" @click="saveReminder" :loading="savingReminder">保存提醒</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';
import VoiceInput from '../components/VoiceInput.vue';

const medications = ref([]), loading = ref(false), checking = ref(false), saving = ref(false), savingReminder = ref(false);
const showAddDialog = ref(false), showReminderDialog = ref(false), interactionResult = ref(null);
const reminderMed = ref(null);
const freqPreview = ref(null);
const editingMed = ref(null);
const pillConversionDisplay = ref('');

// Photo recognition state (now inline in add dialog)
const photoFileInput = ref(null);
const photoPreview = ref('');
const photoRecognizing = ref(false);
const photoResult = ref(null);
const photoConversion = ref(null);
const photoError = ref('');

const routeMap = {
  oral: '口服', topical: '外用', injection: '注射', inhalation: '吸入',
  sublingual: '舌下含服', rectal: '直肠给药', ophthalmic: '眼用', otic: '耳用',
  nasal: '鼻用', transdermal: '透皮贴剂', other: '其他'
};
const units = ['mg', 'g', 'μg', 'ml', '片', '粒', '袋', '滴', 'IU'];
const weekDays = [
  { val: 1, label: '周一' }, { val: 2, label: '周二' }, { val: 3, label: '周三' },
  { val: 4, label: '周四' }, { val: 5, label: '周五' }, { val: 6, label: '周六' }, { val: 7, label: '周日' }
];

const form = ref({ drug_name: '', generic_name: '', dosage: '', dosage_unit: 'mg', spec_per_pill_mg: '', frequency: '', route: 'oral', start_date: '', end_date: '', notes: '' });
const reminderForm = ref({ medication_id: null, reminder_type: 'app', phone_number: '', remind_time: '', days: [1,2,3,4,5,6,7] });

const severityColor = s => ({ X: '#f56c6c', D: '#e6a23c', C: '#e6a23c', B: '#909399', A: '#c0c4cc' }[s]);
const severityType = s => s === 'X' ? 'danger' : s === 'D' ? 'warning' : s === 'C' ? 'warning' : 'info';

function onFreqInput(val) {
  if (!val) { freqPreview.value = null; return; }
  const text = val.toLowerCase();
  let times = 1, timing = '', schedule = '';

  if (text.includes('饭前') || text.includes('餐前')) timing = '饭前';
  else if (text.includes('饭后') || text.includes('餐后')) timing = '饭后';
  else if (text.includes('空腹')) timing = '空腹';
  else if (text.includes('睡前')) timing = '睡前';

  if (text.includes('一天两') || text.includes('每日两') || text.includes('早晚各') || text.includes('bid')) times = 2;
  else if (text.includes('一天三') || text.includes('每日三') || text.includes('早中晚') || text.includes('tid')) times = 3;
  else if (text.includes('一天四') || text.includes('qid')) times = 4;

  if (times === 1) schedule = timing === '睡前' ? '21:00' : '08:00';
  else if (times === 2) schedule = '08:00, 20:00';
  else if (times === 3) schedule = '08:00, 12:00, 18:00';
  else if (times === 4) schedule = '08:00, 12:00, 18:00, 21:00';

  const freqLabels = { 1: '每日一次', 2: '每日两次', 3: '每日三次', 4: '每日四次' };
  freqPreview.value = { freqLabel: freqLabels[times] || `每日${times}次`, timingLabel: timing || null, schedule };
}

async function loadMeds() {
  loading.value = true;
  try { const { data } = await api.get('/medications'); medications.value = data; }
  finally { loading.value = false; }
}

function resetForm() {
  form.value = { drug_name: '', generic_name: '', dosage: '', dosage_unit: 'mg', spec_per_pill_mg: '', frequency: '', route: 'oral', start_date: '', end_date: '', notes: '' };
  freqPreview.value = null;
  pillConversionDisplay.value = '';
  editingMed.value = null;
}

function openAddDialog() {
  resetForm();
  clearPhotoRecognition();
  showAddDialog.value = true;
}

function closeDialog() {
  showAddDialog.value = false;
  resetForm();
  clearPhotoRecognition();
}

function editMed(med) {
  editingMed.value = med;
  form.value = {
    drug_name: med.drug_name,
    generic_name: med.generic_name || '',
    dosage: med.dosage,
    dosage_unit: med.dosage_unit || 'mg',
    spec_per_pill_mg: med.spec_per_pill_mg || '',
    frequency: med.frequency,
    route: med.route,
    start_date: med.start_date,
    end_date: med.end_date || '',
    notes: med.notes || ''
  };
  onFreqInput(med.frequency);
  updatePillConversion();
  clearPhotoRecognition();
  showAddDialog.value = true;
}

async function deleteMed(med) {
  try {
    await api.delete(`/medications/${med.id}`);
    ElMessage.success('用药已删除');
    interactionResult.value = null;
    loadMeds();
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '删除失败');
  }
}

async function saveMedication() {
  if (!form.value.drug_name || !form.value.dosage || !form.value.frequency || !form.value.start_date) return ElMessage.warning('请填写必填项');
  saving.value = true;
  try {
    if (editingMed.value) {
      await api.put(`/medications/${editingMed.value.id}`, form.value);
      ElMessage.success('用药已更新');
    } else {
      await api.post('/medications', form.value);
      ElMessage.success('用药已添加');
    }
    closeDialog();
    loadMeds();
    interactionResult.value = null;
  } finally { saving.value = false; }
}

async function updateStatus(row) {
  await api.put(`/medications/${row.id}`, { status: row.status });
  interactionResult.value = null;
}

async function checkInteractions() {
  checking.value = true;
  try { const { data } = await api.post('/medications/interactions/check'); interactionResult.value = data; }
  finally { checking.value = false; }
}

function openReminder(med) {
  reminderMed.value = med;
  reminderForm.value = {
    medication_id: med.id,
    reminder_type: 'app',
    phone_number: '',
    remind_time: med.schedule_times ? med.schedule_times.split(',')[0] : '08:00',
    days: [1,2,3,4,5,6,7]
  };
  showReminderDialog.value = true;
}

async function saveReminder() {
  if (!reminderForm.value.remind_time) return ElMessage.warning('请选择提醒时间');
  if (reminderForm.value.reminder_type !== 'app' && !reminderForm.value.phone_number) return ElMessage.warning('请输入手机号码');
  savingReminder.value = true;
  try {
    await api.post('/reminders', {
      medication_id: reminderForm.value.medication_id,
      reminder_type: reminderForm.value.reminder_type,
      phone_number: reminderForm.value.reminder_type !== 'app' ? reminderForm.value.phone_number : null,
      remind_time: reminderForm.value.remind_time,
      days_of_week: reminderForm.value.days.join(',')
    });
    showReminderDialog.value = false;
    ElMessage.success('提醒已设置');
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '设置失败');
  } finally { savingReminder.value = false; }
}

// Pill conversion display
function onSpecChange() { updatePillConversion(); }
function updatePillConversion() {
  const mg = parseFloat(form.value.spec_per_pill_mg);
  const dosage = parseFloat(form.value.dosage);
  const unit = form.value.dosage_unit;

  if (!mg || mg <= 0 || !dosage || dosage <= 0 || unit !== 'mg') {
    pillConversionDisplay.value = '';
    return;
  }

  const pills = dosage / mg;
  if (Number.isInteger(pills)) {
    pillConversionDisplay.value = `每片${mg}mg，每次需要吃 ${pills} 片，共 ${dosage}mg`;
  } else if (pills === 0.5) {
    pillConversionDisplay.value = `每片${mg}mg，每次需要吃半片（可沿刻痕掰开），共 ${dosage}mg`;
  } else if (pills === 0.25) {
    pillConversionDisplay.value = `每片${mg}mg，每次只需要 ¼ 片，共 ${dosage}mg`;
  } else {
    const rounded = Math.round(pills * 4) / 4;
    pillConversionDisplay.value = `每片${mg}mg，每次约 ${rounded} 片（共 ${dosage}mg），建议与医生或药师核对`;
  }
}

// Photo recognition (inline in add dialog)
function triggerPhotoRecognition() {
  photoFileInput.value?.click();
}

function clearPhotoRecognition() {
  photoPreview.value = '';
  photoResult.value = null;
  photoConversion.value = null;
  photoError.value = '';
  photoRecognizing.value = false;
}

async function onPhotoSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 20 * 1024 * 1024) {
    photoError.value = '图片大小不能超过 20MB';
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => { photoPreview.value = ev.target.result; };
  reader.readAsDataURL(file);

  photoRecognizing.value = true;
  photoError.value = '';
  photoResult.value = null;

  try {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await api.post('/medications/ocr-recognize', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    photoResult.value = data.drug_info;
    photoConversion.value = data.pill_conversion;
  } catch (err) {
    photoError.value = err?.response?.data?.error || '识别失败，请检查 AI API 配置后重试';
  } finally {
    photoRecognizing.value = false;
  }
}

function autoFillFromPhoto() {
  if (!photoResult.value) return;

  const r = photoResult.value;
  if (r.drug_name) form.value.drug_name = r.drug_name;
  if (r.generic_name) form.value.generic_name = r.generic_name;
  if (r.spec_per_pill) {
    form.value.spec_per_pill_mg = String(r.spec_per_pill);
    form.value.dosage_unit = 'mg';
  }
  if (r.usage_direction) {
    form.value.frequency = r.usage_direction;
    onFreqInput(r.usage_direction);
  }
  if (r.warnings) {
    form.value.notes = (form.value.notes ? form.value.notes + '\n' : '') + '⚠ ' + r.warnings;
  }

  updatePillConversion();
  clearPhotoRecognition();
  ElMessage.success('药品信息已填入，请补充剂量和服用频率后保存');
}

onMounted(loadMeds);
</script>

<style scoped>
.camera-btn {
  border-radius: 8px;
  border-color: #c8d6db;
  color: #5B8BA0;
  font-size: 13px;
  padding: 5px 12px;
  white-space: nowrap;
  flex-shrink: 0;
}
.camera-btn:hover {
  border-color: #5B8BA0;
  color: #4A6B7C;
  background: #f0f5f7;
}
</style>
