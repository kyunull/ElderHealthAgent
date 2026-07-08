<template>
  <div class="register-page">
    <!-- Dynamic animated background -->
    <div class="bg-layer">
      <div class="bg-blob bg-blob--1"></div>
      <div class="bg-blob bg-blob--2"></div>
      <div class="bg-blob bg-blob--3"></div>
      <div class="bg-particles">
        <span v-for="i in 16" :key="i" class="particle" :style="particleStyle(i)"></span>
      </div>
    </div>

    <!-- Register card -->
    <div class="register-card-wrapper">
      <div class="register-card">
        <div class="card-header">
          <div class="logo-icon">📝</div>
          <h1 class="app-title">创建新账户</h1>
          <p class="app-subtitle">填写信息，开始管理您的健康</p>
        </div>

        <el-form class="register-form" @submit.prevent="handleRegister" label-position="top">
          <el-form-item label="用户名">
            <el-input
              v-model="username"
              placeholder="设置一个用户名（字母和数字，3到50位）"
              size="large"
              class="elder-input"
              maxlength="50"
            />
          </el-form-item>

          <el-form-item label="怎么称呼您">
            <el-input
              v-model="displayName"
              placeholder="请输入您的姓名或昵称"
              size="large"
              class="elder-input"
            />
          </el-form-item>

          <el-form-item label="设置密码">
            <el-input
              v-model="password"
              type="password"
              placeholder="请设置密码（至少6位）"
              size="large"
              show-password
              class="elder-input"
            />
          </el-form-item>

          <el-form-item label="再次输入密码">
            <el-input
              v-model="confirmPassword"
              type="password"
              placeholder="请再次输入密码确认"
              size="large"
              show-password
              class="elder-input"
              @keyup.enter="handleRegister"
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="register-btn"
              @click="handleRegister"
              :loading="loading"
              round
            >
              {{ loading ? '正在创建账户...' : '注册' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="card-footer">
          <router-link to="/login" class="login-link">已有账户？点这里登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api/index.js';

const router = useRouter();
const username = ref(''), displayName = ref(''), password = ref(''), confirmPassword = ref(''), loading = ref(false);

function particleStyle(i) {
  const size = 3 + Math.floor(i * 3) % 7;
  const left = (i * 41 + 7) % 100;
  const delay = (i * 4.1) % 18;
  const duration = 14 + (i * 4) % 14;
  const opacity = 0.12 + (i * 0.02) % 0.22;
  return {
    width: `${size}px`, height: `${size}px`, left: `${left}%`,
    animationDelay: `${delay}s`, animationDuration: `${duration}s`, opacity
  };
}

async function handleRegister() {
  if (!username.value || !displayName.value || !password.value) return ElMessage.warning('请填写所有必填项');
  if (password.value !== confirmPassword.value) return ElMessage.error('两次输入的密码不一致，请重新输入');
  if (password.value.length < 6) return ElMessage.error('密码长度至少需要6位');
  loading.value = true;
  try {
    const { data } = await api.post('/auth/register', {
      username: username.value, display_name: displayName.value, password: password.value
    });
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', data.user.display_name || data.user.username);
    ElMessage.success('注册成功，欢迎加入！');
    router.push('/dashboard');
  } catch { /* handled by interceptor */ }
  finally { loading.value = false; }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, #F0EDE8 0%, #E8EBED 30%, #DCE5E8 60%, #EDEEEC 100%);
}

/* Background (shared with login) */
.bg-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.bg-blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.4; }
.bg-blob--1 { width: 450px; height: 450px; background: radial-gradient(circle, rgba(91,139,160,0.45) 0%, transparent 70%); top: -12%; right: -8%; animation: drift1 22s ease-in-out infinite; }
.bg-blob--2 { width: 380px; height: 380px; background: radial-gradient(circle, rgba(107,163,104,0.32) 0%, transparent 70%); bottom: -8%; left: -10%; animation: drift2 20s ease-in-out infinite; }
.bg-blob--3 { width: 320px; height: 320px; background: radial-gradient(circle, rgba(196,163,118,0.28) 0%, transparent 70%); top: 50%; left: 55%; animation: drift3 19s ease-in-out infinite; }
.bg-particles { position: absolute; inset: 0; }
.particle { position: absolute; bottom: -10px; background: rgba(91,139,160,0.35); border-radius: 50%; animation: float-up linear infinite; }

@keyframes drift1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-60px, 40px) scale(1.08); }
  50% { transform: translate(-30px, -50px) scale(0.94); }
  75% { transform: translate(50px, -10px) scale(1.04); }
}
@keyframes drift2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(70px, -40px) scale(1.1); }
  66% { transform: translate(-20px, 50px) scale(0.9); }
}
@keyframes drift3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(60px, 35px) scale(1.08); }
}
@keyframes float-up {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 0.5; }
  100% { transform: translateY(-100vh) translateX(-20px) scale(0.3); opacity: 0; }
}

/* Card */
.register-card-wrapper { position: relative; z-index: 1; width: 480px; max-width: 92vw; }
.register-card {
  background: rgba(255,255,255,0.92); backdrop-filter: blur(20px);
  border-radius: 20px; padding: 40px 40px 32px;
  box-shadow: 0 8px 40px rgba(74,107,124,0.1), 0 2px 8px rgba(0,0,0,0.04);
}
.card-header { text-align: center; margin-bottom: 28px; }
.logo-icon { font-size: 44px; margin-bottom: 8px; line-height: 1; }
.app-title { font-size: 24px; font-weight: 700; color: #2C3E50; margin: 0 0 6px; letter-spacing: 2px; }
.app-subtitle { font-size: 14px; color: #7B8D9E; margin: 0; }

/* Form */
.register-form :deep(.el-form-item) { margin-bottom: 18px; }
.register-form :deep(.el-form-item__label) { font-size: 15px; color: #3D5060; font-weight: 600; padding-bottom: 4px; line-height: 1.4; }

.elder-input :deep(.el-input__wrapper) {
  border-radius: 12px; padding: 6px 16px; background: #F8F6F3;
  border: 2px solid #E8E2D8; box-shadow: none; transition: all 0.3s;
}
.elder-input :deep(.el-input__wrapper:hover) { border-color: #B8CFDA; background: #F5F8F9; }
.elder-input :deep(.el-input__wrapper.is-focus) { border-color: #5B8BA0; box-shadow: 0 0 0 3px rgba(91,139,160,0.12); background: #fff; }
.elder-input :deep(.el-input__inner) { font-size: 16px; color: #2C3E50; height: 42px; line-height: 42px; }
.elder-input :deep(.el-input__inner::placeholder) { color: #B0BEC5; font-size: 14px; }

.register-btn {
  width: 100%; height: 50px; font-size: 18px; font-weight: 600;
  letter-spacing: 4px; border-radius: 25px;
  background: linear-gradient(135deg, #6BA368 0%, #5A9257 100%); border: none;
  box-shadow: 0 4px 16px rgba(107,163,104,0.3); transition: all 0.3s; margin-top: 4px;
}
.register-btn:hover { background: linear-gradient(135deg, #7BB478 0%, #6BA368 100%); box-shadow: 0 6px 20px rgba(107,163,104,0.4); transform: translateY(-1px); }
.register-btn:active { transform: translateY(0); }

.card-footer { text-align: center; margin-top: 16px; }
.login-link { font-size: 15px; color: #5B8BA0; text-decoration: none; transition: color 0.2s; }
.login-link:hover { color: #3D7085; text-decoration: underline; }
</style>
