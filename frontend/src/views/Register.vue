<template>
  <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)">
    <el-card style="width:400px">
      <template #header><h2 style="text-align:center;margin:0">注册新账户</h2></template>
      <el-form>
        <el-form-item><el-input v-model="username" placeholder="用户名（3-50位字母数字）" /></el-form-item>
        <el-form-item><el-input v-model="displayName" placeholder="显示名称" /></el-form-item>
        <el-form-item><el-input v-model="password" type="password" placeholder="密码（至少6位）" show-password /></el-form-item>
        <el-form-item><el-input v-model="confirmPassword" type="password" placeholder="确认密码" show-password @keyup.enter="handleRegister" /></el-form-item>
        <el-form-item><el-button type="primary" style="width:100%" @click="handleRegister" :loading="loading">注 册</el-button></el-form-item>
        <div style="text-align:center"><router-link to="/login">已有账户？返回登录</router-link></div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const router = useRouter();
const username = ref(''), displayName = ref(''), password = ref(''), confirmPassword = ref(''), loading = ref(false);

async function handleRegister() {
  if (!username.value || !displayName.value || !password.value) return ElMessage.warning('请填写所有必填项');
  if (password.value !== confirmPassword.value) return ElMessage.error('两次输入的密码不一致');
  if (password.value.length < 6) return ElMessage.error('密码至少 6 位');
  loading.value = true;
  try {
    const { data } = await api.post('/auth/register', { username: username.value, display_name: displayName.value, password: password.value });
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', data.user.display_name || data.user.username);
    ElMessage.success('注册成功');
    router.push('/dashboard');
  } catch { /* handled */ }
  finally { loading.value = false; }
}
</script>
