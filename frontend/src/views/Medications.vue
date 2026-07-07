<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <h2>用药管理</h2>
      <div>
        <el-button type="primary" @click="showAddDialog = true">添加用药</el-button>
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

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="showAddDialog" :title="editingMed ? '编辑用药' : '添加用药'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="药品名" required><el-input v-model="form.drug_name" placeholder="如：阿托伐他汀钙片" /></el-form-item>
        <el-form-item label="通用名"><el-input v-model="form.generic_name" placeholder="如：Atorvastatin" /></el-form-item>
        <el-row>
          <el-col :span="12"><el-form-item label="剂量" required><el-input v-model="form.dosage" placeholder="如：20" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="单位" required><el-select v-model="form.dosage_unit" placeholder="选择"><el-option v-for="u in units" :key="u" :label="u" :value="u" /></el-select></el-form-item></el-col>
        </el-row>
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

const form = ref({ drug_name: '', generic_name: '', dosage: '', dosage_unit: 'mg', frequency: '', route: 'oral', start_date: '', end_date: '', notes: '' });
const reminderForm = ref({ medication_id: null, reminder_type: 'app', phone_number: '', remind_time: '', days: [1,2,3,4,5,6,7] });

const severityColor = s => ({ X: '#f56c6c', D: '#e6a23c', C: '#e6a23c', B: '#909399', A: '#c0c4cc' }[s]);
const severityType = s => s === 'X' ? 'danger' : s === 'D' ? 'warning' : s === 'C' ? 'warning' : 'info';

// Smart frequency preview
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
  form.value = { drug_name: '', generic_name: '', dosage: '', dosage_unit: 'mg', frequency: '', route: 'oral', start_date: '', end_date: '', notes: '' };
  freqPreview.value = null;
  editingMed.value = null;
}

function closeDialog() {
  showAddDialog.value = false;
  resetForm();
}

function editMed(med) {
  editingMed.value = med;
  form.value = {
    drug_name: med.drug_name,
    generic_name: med.generic_name || '',
    dosage: med.dosage,
    dosage_unit: med.dosage_unit || 'mg',
    frequency: med.frequency,
    route: med.route,
    start_date: med.start_date,
    end_date: med.end_date || '',
    notes: med.notes || ''
  };
  onFreqInput(med.frequency);
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

// Reminder functions
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

onMounted(loadMeds);
</script>
