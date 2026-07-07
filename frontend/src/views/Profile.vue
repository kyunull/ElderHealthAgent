<template>
  <div>
    <h2>个人档案</h2>
    <el-tabs v-model="tab">
      <el-tab-pane label="基本信息" name="basic">
        <el-card>
          <el-form label-width="100px" style="max-width:800px">
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="用户名"><el-input :model-value="profile.username" disabled /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="显示名称"><el-input v-model="editProfile.display_name" /></el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :span="8">
                <el-form-item label="身高(cm)"><el-input-number v-model="editProfile.height_cm" :min="30" :max="250" style="width:100%" /></el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="体重(kg)"><el-input-number v-model="editProfile.weight_kg" :min="1" :max="500" :precision="1" style="width:100%" /></el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="出生日期"><el-date-picker v-model="editProfile.birth_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="24">
              <el-col :span="8">
                <el-form-item label="性别"><el-select v-model="editProfile.gender" style="width:100%"><el-option label="男" value="male" /><el-option label="女" value="female" /><el-option label="其他" value="other" /></el-select></el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="血型"><el-select v-model="editProfile.blood_type" style="width:100%"><el-option label="A型" value="A" /><el-option label="B型" value="B" /><el-option label="AB型" value="AB" /><el-option label="O型" value="O" /></el-select></el-form-item>
              </el-col>
            </el-row>
            <el-form-item>
              <el-button type="primary" @click="saveProfile" :loading="saving">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="过敏史" name="allergies">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <span style="color:#909399">管理您的过敏原记录，帮助医生了解用药禁忌</span>
          <el-button type="primary" @click="showAllergyForm = true">添加过敏记录</el-button>
        </div>
        <el-card>
          <el-table :data="allergies" stripe>
            <el-table-column prop="allergen" label="过敏原" min-width="150" />
            <el-table-column prop="severity" label="严重程度" width="140">
              <template #default="{row}">
                <el-tag :type="severityColor(row.severity)">{{ severityMap[row.severity] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="reaction" label="反应描述" min-width="250" />
            <el-table-column label="操作" width="100">
              <template #default="{row}">
                <el-button size="small" type="danger" @click="deleteAllergy(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!allergies.length" description="暂无过敏记录" :image-size="60" />
        </el-card>

        <el-dialog v-model="showAllergyForm" title="添加过敏记录" width="400px">
          <el-form>
            <el-form-item label="过敏原" required><el-input v-model="allergyForm.allergen" /></el-form-item>
            <el-form-item label="严重程度" required>
              <el-select v-model="allergyForm.severity" style="width:100%">
                <el-option label="轻度" value="mild" /><el-option label="中度" value="moderate" />
                <el-option label="重度" value="severe" /><el-option label="危及生命" value="life_threatening" />
              </el-select>
            </el-form-item>
            <el-form-item label="反应描述"><el-input v-model="allergyForm.reaction" type="textarea" /></el-form-item>
          </el-form>
          <template #footer><el-button @click="showAllergyForm=false">取消</el-button><el-button type="primary" @click="addAllergy">保存</el-button></template>
        </el-dialog>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const tab = ref('basic'), saving = ref(false);
const profile = ref({}), editProfile = ref({});
const allergies = ref([]), showAllergyForm = ref(false), allergyForm = ref({ allergen: '', severity: 'mild', reaction: '' });
const severityMap = { mild: '轻度', moderate: '中度', severe: '重度', life_threatening: '危及生命' };
const severityColor = s => s === 'severe' || s === 'life_threatening' ? 'danger' : s === 'moderate' ? 'warning' : 'info';

async function loadProfile() {
  try { const { data } = await api.get('/profile'); profile.value = data; editProfile.value = { ...data }; }
  catch {}
}

async function saveProfile() {
  saving.value = true;
  try { await api.put('/profile', editProfile.value); ElMessage.success('档案已更新'); loadProfile(); }
  finally { saving.value = false; }
}

async function loadAllergies() {
  try { const { data } = await api.get('/profile/allergies'); allergies.value = data; }
  catch {}
}

async function addAllergy() {
  if (!allergyForm.value.allergen) return ElMessage.warning('请填写过敏原');
  try { await api.post('/profile/allergies', allergyForm.value); showAllergyForm.value = false; allergyForm.value = { allergen: '', severity: 'mild', reaction: '' }; loadAllergies(); }
  catch {}
}

async function deleteAllergy(id) {
  try { await api.delete(`/profile/allergies/${id}`); loadAllergies(); }
  catch {}
}

onMounted(() => { loadProfile(); loadAllergies(); });
</script>
