<template>
  <div>
    <h2>设置</h2>

    <!-- Row 1: AI API + OCR config side by side -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="12">
        <el-card style="margin-bottom:20px">
          <template #header><span style="font-weight:bold">🤖 AI 模型 API 配置</span></template>

          <el-alert v-if="autoConfigAvailable" type="success" :closable="false" style="margin-bottom:16px" show-icon>
            <template #title>检测到 Claude Code 配置</template>
            <template #default>
              在 <code>{{ configSource }}</code> 中找到 API 配置<br>
              模型：<el-tag size="small">{{ autoModel }}</el-tag>
              <span v-if="autoBaseUrl"> &nbsp;API：<el-tag size="small" type="info">{{ autoBaseUrl }}</el-tag></span>
            </template>
          </el-alert>

          <el-form label-width="100px">
            <el-form-item label="当前状态">
              <el-tag :type="apiKeyConfigured ? 'success' : 'warning'">{{ apiKeyConfigured ? '已配置' : '未配置' }}</el-tag>
              <el-tag v-if="apiModel" style="margin-left:8px" type="info">模型：{{ apiModel }}</el-tag>
            </el-form-item>
            <el-form-item v-if="autoConfigAvailable && !apiKeyConfigured" label="快捷配置">
              <el-button type="success" size="small" @click="autoConfigure" :loading="autoLoading">一键加载 Claude Code 配置</el-button>
              <div style="font-size:12px;color:#909399;margin-top:4px">自动读取本地 <code>.claude/settings.json</code></div>
            </el-form-item>
            <el-divider v-if="autoConfigAvailable" />
            <el-form-item label="API Key">
              <el-input v-model="apiKey" type="password" placeholder="输入 API Key" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveKey" :loading="saving">保存</el-button>
            </el-form-item>
          </el-form>
          <el-alert type="info" :closable="false" show-icon style="margin-top:8px">
            <template #title>说明</template>
            Key 加密存储在本地数据库，不上传云端。获取：<a href="https://console.anthropic.com" target="_blank">Anthropic Console</a>
          </el-alert>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card style="margin-bottom:20px">
          <template #header><span style="font-weight:bold">📷 OCR 识别 API 配置</span></template>
          <el-form label-width="100px">
            <el-form-item label="当前状态">
              <el-tag :type="ocrConfig.api_key_configured ? 'success' : 'warning'">{{ ocrConfig.api_key_configured ? '已配置' : '未配置' }}</el-tag>
              <el-tag v-if="ocrConfig.provider" style="margin-left:8px" type="info">{{ ocrConfig.provider }}</el-tag>
            </el-form-item>
            <el-form-item label="服务提供商">
              <el-select v-model="ocrForm.provider" placeholder="选择OCR服务" style="width:100%">
                <el-option label="Anthropic Claude (多模态)" value="anthropic" />
                <el-option label="智谱 GLM-4V" value="glm" />
                <el-option label="OpenAI GPT-4o (多模态)" value="openai" />
                <el-option label="百度 OCR" value="baidu" />
                <el-option label="自定义 API" value="custom" />
              </el-select>
            </el-form-item>
            <el-form-item label="模型名称">
              <el-input v-model="ocrForm.model" placeholder="glm-4v / gpt-4o / 留空使用默认" />
            </el-form-item>
            <el-form-item label="API 地址">
              <el-input v-model="ocrForm.api_url" placeholder="自定义 API 地址（可选）" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input v-model="ocrForm.api_key" type="password" placeholder="OCR 服务 API Key" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveOcrConfig" :loading="ocrSaving">保存</el-button>
              <el-button v-if="ocrConfig.api_key_configured" type="danger" text @click="clearOcrConfig">清除</el-button>
            </el-form-item>
          </el-form>
          <el-alert type="info" :closable="false" show-icon style="margin-top:8px">
            <template #title>说明</template>
            OCR 识别用于从检查单图片提取指标数据。如未单独配置，默认使用上方 AI API 进行识别。
          </el-alert>
        </el-card>
      </el-col>
    </el-row>

    <!-- Row 2: ASR config -->
    <el-row :gutter="20">
      <el-col :xs="24" :lg="12">
        <el-card style="margin-bottom:20px">
          <template #header><span style="font-weight:bold">🎤 语音识别 (ASR) 配置</span></template>
          <el-form label-width="100px">
            <el-form-item label="当前状态">
              <el-tag :type="asrConfig.api_key_configured ? 'success' : 'warning'">{{ asrConfig.api_key_configured ? '已配置' : '未配置' }}</el-tag>
              <el-tag v-if="asrConfig.provider" style="margin-left:8px" type="info">{{ asrProviderLabel(asrConfig.provider) }}</el-tag>
            </el-form-item>
            <el-form-item label="识别引擎">
              <el-select v-model="asrForm.provider" placeholder="选择语音识别引擎" style="width:100%">
                <el-option label="浏览器内置 (免费/Chrome+Edge)" value="web-speech" />
                <el-option label="百度语音识别 (免费5万次/日)" value="baidu" />
                <el-option label="腾讯云 ASR (免费5小时/月)" value="tencent" />
                <el-option label="讯飞语音听写 (免费500次/日)" value="iflytek" />
                <el-option label="OpenAI Whisper API" value="openai" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="asrForm.provider !== 'web-speech'" label="App ID">
              <el-input v-model="asrForm.app_id" placeholder="应用 ID" />
            </el-form-item>
            <el-form-item v-if="asrForm.provider !== 'web-speech'" label="API Key">
              <el-input v-model="asrForm.api_key" type="password" placeholder="API Key" show-password />
            </el-form-item>
            <el-form-item v-if="asrForm.provider !== 'web-speech'" label="Secret Key">
              <el-input v-model="asrForm.secret_key" type="password" placeholder="Secret Key (可选)" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveAsrConfig" :loading="asrSaving">保存</el-button>
              <el-button v-if="asrConfig.api_key_configured" type="danger" text @click="clearAsrConfig">清除</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="12">
        <el-card style="margin-bottom:20px">
          <template #header><span style="font-weight:bold">🔒 数据与隐私</span></template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="数据存储">本地 SQLite 数据库 (data/yinian.db)</el-descriptions-item>
            <el-descriptions-item label="图片存储">本地 data/uploads/ 目录</el-descriptions-item>
            <el-descriptions-item label="网络访问">仅调用 AI API，不上传健康数据</el-descriptions-item>
            <el-descriptions-item label="数据隐私">所有健康数据完全本地化</el-descriptions-item>
          </el-descriptions>
          <el-alert type="warning" :closable="false" show-icon style="margin-top:12px">
            <template #title>医疗免责声明</template>
            本系统 AI 分析仅供参考，不作为医疗诊断依据。所有诊疗决策需咨询专业医生。紧急情况请立即就医。
          </el-alert>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const apiKey = ref(''), saving = ref(false), autoLoading = ref(false);
const apiKeyConfigured = ref(false), apiModel = ref(null);
const autoConfigAvailable = ref(false), autoModel = ref(null), autoBaseUrl = ref(null), configSource = ref('');

async function loadStatus() {
  try {
    const [meRes, statusRes, checkRes] = await Promise.all([
      api.get('/auth/me'),
      api.get('/settings/api-key/status'),
      api.get('/settings/api-key/check-config')
    ]);
    apiKeyConfigured.value = meRes.data.api_key_configured;
    apiModel.value = statusRes.data.model;
    autoConfigAvailable.value = checkRes.data.available;
    autoModel.value = checkRes.data.model;
    autoBaseUrl.value = checkRes.data.baseUrl;
    configSource.value = checkRes.data.source || 'settings.json';
  } catch {}
}

async function autoConfigure() {
  autoLoading.value = true;
  try {
    const { data } = await api.get('/settings/api-key/auto-config');
    if (data.configured) {
      apiKeyConfigured.value = true;
      apiModel.value = data.model;
      ElMessage.success(data.message || '已自动加载配置');
    } else {
      ElMessage.warning(data.message);
    }
  } catch { /* handled */ }
  finally { autoLoading.value = false; }
}

async function saveKey() {
  if (!apiKey.value.trim()) return ElMessage.warning('请输入 API Key');
  saving.value = true;
  try {
    await api.put('/settings/api-key', { api_key: apiKey.value });
    apiKeyConfigured.value = true;
    apiKey.value = '';
    ElMessage.success('API Key 已保存');
  } finally { saving.value = false; }
}

const ocrSaving = ref(false);
const ocrConfig = ref({ provider: null, model: null, api_url: null, api_key_configured: false });
const ocrForm = ref({ provider: '', model: '', api_url: '', api_key: '' });

async function loadOcrConfig() {
  try {
    const { data } = await api.get('/settings/ocr-config');
    ocrConfig.value = data;
    ocrForm.value.provider = data.provider || '';
    ocrForm.value.model = data.model || '';
    ocrForm.value.api_url = data.api_url || '';
  } catch {}
}

async function saveOcrConfig() {
  ocrSaving.value = true;
  try {
    await api.put('/settings/ocr-config', ocrForm.value);
    ElMessage.success('OCR 配置已保存');
    loadOcrConfig();
  } catch { /* skip */ }
  finally { ocrSaving.value = false; }
}

async function clearOcrConfig() {
  try {
    await api.delete('/settings/ocr-config');
    ElMessage.success('OCR 配置已清除');
    ocrForm.value = { provider: '', model: '', api_url: '', api_key: '' };
    loadOcrConfig();
  } catch {}
}

// ASR config
const asrSaving = ref(false);
const asrConfig = ref({ provider: 'web-speech', app_id: '', api_key_configured: false, secret_key_configured: false });
const asrForm = ref({ provider: 'web-speech', app_id: '', api_key: '', secret_key: '' });

function asrProviderLabel(p) {
  const map = { 'web-speech': '浏览器内置', baidu: '百度 ASR', tencent: '腾讯 ASR', iflytek: '讯飞 ASR', openai: 'OpenAI Whisper' };
  return map[p] || p;
}

async function loadAsrConfig() {
  try {
    const { data } = await api.get('/asr/config');
    asrConfig.value = data;
    asrForm.value.provider = data.provider || 'web-speech';
    asrForm.value.app_id = data.app_id || '';
  } catch {}
}

async function saveAsrConfig() {
  asrSaving.value = true;
  try {
    await api.put('/asr/config', asrForm.value);
    ElMessage.success('ASR 配置已保存');
    loadAsrConfig();
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '保存失败');
  } finally { asrSaving.value = false; }
}

async function clearAsrConfig() {
  try {
    await api.delete('/asr/config');
    ElMessage.success('ASR 配置已清除');
    asrForm.value = { provider: 'web-speech', app_id: '', api_key: '', secret_key: '' };
    loadAsrConfig();
  } catch {}
}

onMounted(() => { loadStatus(); loadOcrConfig(); loadAsrConfig(); });
</script>
