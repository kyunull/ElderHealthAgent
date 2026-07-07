<template>
  <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)">
    <el-card style="width:400px">
      <template #header><h2 style="text-align:center;margin:0">颐年家庭医生 登录</h2></template>
      <el-form @submit.prevent="handleLogin">
        <el-form-item><el-input v-model="username" placeholder="用户名" prefix-icon="User" /></el-form-item>
        <el-form-item><el-input v-model="password" type="password" placeholder="密码" prefix-icon="Lock" show-password @keyup.enter="handleLogin" /></el-form-item>
        <el-form-item><el-button type="primary" style="width:100%" @click="handleLogin" :loading="loading">登 录</el-button></el-form-item>
        <div style="text-align:center"><router-link to="/register">注册新账户</router-link></div>
        <div v-if="route.query.expired" style="text-align:center;margin-top:8px"><el-tag type="warning">登录已过期，请重新登录</el-tag></div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const router = useRouter();
const route = useRoute();
const username = ref('');
const password = ref('');
const loading = ref(false);

async function handleLogin() {
  if (!username.value || !password.value) return ElMessage.warning('请输入用户名和密码');
  loading.value = true;
  try {
    const { data } = await api.post('/auth/login', { username: username.value, password: password.value });
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', data.user.display_name || data.user.username);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch { /* handled by interceptor */ }
  finally { loading.value = false; }
}
</script>
