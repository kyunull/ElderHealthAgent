<template>
  <div class="login-page">
    <!-- Dynamic animated background -->
    <div class="bg-layer">
      <div class="bg-blob bg-blob--1"></div>
      <div class="bg-blob bg-blob--2"></div>
      <div class="bg-blob bg-blob--3"></div>
      <div class="bg-blob bg-blob--4"></div>
      <div class="bg-particles">
        <span v-for="i in 20" :key="i" class="particle" :style="particleStyle(i)"></span>
      </div>
    </div>

    <!-- Login card -->
    <div class="login-card-wrapper">
      <div class="login-card">
        <div class="card-header">
          <div class="logo-icon">🏥</div>
          <h1 class="app-title">颐年家庭医生</h1>
          <p class="app-subtitle">关爱健康，温暖相伴</p>
        </div>

        <el-form class="login-form" @submit.prevent="handleLogin" label-position="top">
          <el-form-item label="用户名">
            <el-input
              v-model="username"
              placeholder="请输入用户名"
              size="large"
              :prefix-icon="UserFilled"
              class="elder-input"
            />
          </el-form-item>

          <el-form-item label="密码">
            <el-input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              size="large"
              :prefix-icon="Lock"
              show-password
              class="elder-input"
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-btn"
              @click="handleLogin"
              :loading="loading"
              round
            >
              {{ loading ? '正在登录...' : '登录' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="card-footer">
          <router-link to="/register" class="register-link">还没有账户？点这里注册</router-link>
          <div v-if="route.query.expired" class="expired-tip">
            <el-tag type="warning" size="large">登录已过期，请重新登录</el-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { UserFilled, Lock } from '@element-plus/icons-vue';
import api from '../api/index.js';

const router = useRouter();
const route = useRoute();
const username = ref('');
const password = ref('');
const loading = ref(false);

function particleStyle(i) {
  const size = 4 + Math.floor(i * 3) % 8;
  const left = (i * 37 + 13) % 100;
  const delay = (i * 3.7) % 20;
  const duration = 12 + (i * 5) % 16;
  const opacity = 0.15 + (i * 0.02) % 0.25;
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${duration}s`,
    opacity
  };
}

async function handleLogin() {
  if (!username.value || !password.value) return ElMessage.warning('请输入用户名和密码');
  loading.value = true;
  try {
    const { data } = await api.post('/auth/login', { username: username.value, password: password.value });
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', data.user.display_name || data.user.username);
    ElMessage.success('登录成功，欢迎回来！');
    router.push('/dashboard');
  } catch { /* handled by interceptor */ }
  finally { loading.value = false; }
}
</script>

<style scoped>
/* ===== Page Container ===== */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, #E8F0F2 0%, #D5E5EB 30%, #C3D9E4 60%, #DFEBF0 100%);
}

/* ===== Dynamic Animated Background ===== */
.bg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.45;
}

.bg-blob--1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(91,139,160,0.5) 0%, transparent 70%);
  top: -15%;
  left: -10%;
  animation: drift1 20s ease-in-out infinite;
}

.bg-blob--2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(107,163,104,0.35) 0%, transparent 70%);
  bottom: -10%;
  right: -8%;
  animation: drift2 24s ease-in-out infinite;
}

.bg-blob--3 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(196,163,118,0.3) 0%, transparent 70%);
  top: 45%;
  left: 50%;
  animation: drift3 18s ease-in-out infinite;
}

.bg-blob--4 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(132,165,184,0.35) 0%, transparent 70%);
  top: 60%;
  left: 5%;
  animation: drift4 22s ease-in-out infinite;
}

@keyframes drift1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(80px, -40px) scale(1.1); }
  50% { transform: translate(40px, 60px) scale(0.95); }
  75% { transform: translate(-30px, -20px) scale(1.05); }
}

@keyframes drift2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-60px, 50px) scale(1.08); }
  66% { transform: translate(30px, -30px) scale(0.92); }
}

@keyframes drift3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-70px, -40px) scale(1.12); }
}

@keyframes drift4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(50px, 30px) scale(0.9); }
  50% { transform: translate(-20px, -50px) scale(1.06); }
  75% { transform: translate(-40px, 20px) scale(0.94); }
}

/* Floating particles */
.bg-particles {
  position: absolute;
  inset: 0;
}

.particle {
  position: absolute;
  bottom: -10px;
  background: rgba(91,139,160,0.4);
  border-radius: 50%;
  animation: float-up linear infinite;
}

@keyframes float-up {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100vh) translateX(30px) scale(0.3);
    opacity: 0;
  }
}

/* ===== Login Card ===== */
.login-card-wrapper {
  position: relative;
  z-index: 1;
  width: 460px;
  max-width: 92vw;
}

.login-card {
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 48px 40px 36px;
  box-shadow: 0 8px 40px rgba(74,107,124,0.12), 0 2px 8px rgba(0,0,0,0.04);
}

.card-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo-icon {
  font-size: 52px;
  margin-bottom: 12px;
  line-height: 1;
}

.app-title {
  font-size: 26px;
  font-weight: 700;
  color: #2C3E50;
  margin: 0 0 8px;
  letter-spacing: 2px;
}

.app-subtitle {
  font-size: 15px;
  color: #7B8D9E;
  margin: 0;
  letter-spacing: 1px;
}

/* ===== Form ===== */
.login-form :deep(.el-form-item) {
  margin-bottom: 22px;
}

.login-form :deep(.el-form-item__label) {
  font-size: 15px;
  color: #3D5060;
  font-weight: 600;
  padding-bottom: 6px;
  line-height: 1.4;
}

.elder-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  padding: 6px 16px;
  background: #F8F6F3;
  border: 2px solid #E8E2D8;
  box-shadow: none;
  transition: all 0.3s;
}

.elder-input :deep(.el-input__wrapper:hover) {
  border-color: #B8CFDA;
  background: #F5F8F9;
}

.elder-input :deep(.el-input__wrapper.is-focus) {
  border-color: #5B8BA0;
  box-shadow: 0 0 0 3px rgba(91,139,160,0.12);
  background: #fff;
}

.elder-input :deep(.el-input__inner) {
  font-size: 16px;
  color: #2C3E50;
  height: 44px;
  line-height: 44px;
}

.elder-input :deep(.el-input__inner::placeholder) {
  color: #B0BEC5;
  font-size: 15px;
}

.elder-input :deep(.el-input__prefix) {
  color: #8FA8B5;
  font-size: 18px;
}

.login-btn {
  width: 100%;
  height: 50px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 4px;
  border-radius: 25px;
  background: linear-gradient(135deg, #5B8BA0 0%, #4A7B90 100%);
  border: none;
  box-shadow: 0 4px 16px rgba(91,139,160,0.3);
  transition: all 0.3s;
  margin-top: 8px;
}

.login-btn:hover {
  background: linear-gradient(135deg, #6B9BB0 0%, #5A8BA0 100%);
  box-shadow: 0 6px 20px rgba(91,139,160,0.4);
  transform: translateY(-1px);
}

.login-btn:active {
  transform: translateY(0);
}

.login-btn.is-loading {
  background: linear-gradient(135deg, #8FB8C8 0%, #7AA8B8 100%);
}

/* ===== Footer ===== */
.card-footer {
  text-align: center;
  margin-top: 20px;
}

.register-link {
  font-size: 15px;
  color: #5B8BA0;
  text-decoration: none;
  transition: color 0.2s;
}

.register-link:hover {
  color: #3D7085;
  text-decoration: underline;
}

.expired-tip {
  margin-top: 12px;
}
</style>
