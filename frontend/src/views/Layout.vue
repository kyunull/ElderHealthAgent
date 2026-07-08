<template>
  <el-container class="app-layout">
    <!-- Sidebar -->
    <el-aside class="app-sidebar" width="240px">
      <div class="sidebar-brand">
        <span class="brand-icon">🏥</span>
        <span class="brand-text">颐年家庭医生</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        background-color="transparent"
        text-color="rgba(255,255,255,0.82)"
        active-text-color="#fff"
        router
      >
        <el-menu-item index="/dashboard" class="menu-item">
          <el-icon class="menu-icon"><DataBoard /></el-icon>
          <span class="menu-label">首页</span>
        </el-menu-item>

        <el-sub-menu index="reports-group" class="menu-item">
          <template #title>
            <el-icon class="menu-icon"><Document /></el-icon>
            <span class="menu-label">健康报告</span>
          </template>
          <el-menu-item index="/reports" class="sub-item">报告列表</el-menu-item>
          <el-menu-item index="/reports/upload" class="sub-item">上传检查单</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/medications" class="menu-item">
          <el-icon class="menu-icon"><Service /></el-icon>
          <span class="menu-label">用药管理</span>
          <el-badge v-if="medCount > 0" :value="medCount" :max="99" class="menu-badge" />
        </el-menu-item>

        <el-menu-item index="/consultation" class="menu-item">
          <el-icon class="menu-icon"><UserFilled /></el-icon>
          <span class="menu-label">专家分析</span>
        </el-menu-item>

        <el-menu-item index="/trends" class="menu-item">
          <el-icon class="menu-icon"><TrendCharts /></el-icon>
          <span class="menu-label">健康趋势</span>
        </el-menu-item>

        <el-menu-item index="/cga" class="menu-item">
          <el-icon class="menu-icon"><Sunny /></el-icon>
          <span class="menu-label">老年综合评估</span>
        </el-menu-item>

        <el-menu-item index="/cognitive" class="menu-item">
          <el-icon class="menu-icon"><Reading /></el-icon>
          <span class="menu-label">认知筛查</span>
        </el-menu-item>

        <el-menu-item index="/profile" class="menu-item">
          <el-icon class="menu-icon"><User /></el-icon>
          <span class="menu-label">个人档案</span>
        </el-menu-item>

        <el-menu-item index="/settings" class="menu-item">
          <el-icon class="menu-icon"><Setting /></el-icon>
          <span class="menu-label">系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- Main content -->
    <el-container class="main-container">
      <el-header class="app-header">
        <div class="header-greeting">
          <span class="greeting-text">您好，</span>
          <span class="greeting-name">{{ username }}</span>
        </div>
        <el-button class="logout-btn" @click="logout" :icon="SwitchButton">
          退出登录
        </el-button>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SwitchButton } from '@element-plus/icons-vue';
import api from '../api/index.js';

const route = useRoute();
const router = useRouter();
const activeMenu = computed(() => route.path);
const username = computed(() => sessionStorage.getItem('username') || '用户');
const medCount = ref(0);

async function loadMedCount() {
  try {
    const { data } = await api.get('/medications', { params: { status: 'active' } });
    medCount.value = data.length || 0;
  } catch {}
}

onMounted(loadMedCount);

function logout() {
  sessionStorage.clear();
  router.push('/login');
}
</script>

<style scoped>
/* ===== Layout ===== */
.app-layout {
  min-height: 100vh;
}

/* ===== Sidebar (warm, calming deep teal) ===== */
.app-sidebar {
  background: linear-gradient(180deg, #4A6B7C 0%, #3D5B6B 100%);
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: 2px 0 24px rgba(0,0,0,0.08);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.brand-icon {
  font-size: 28px;
  line-height: 1;
}

.brand-text {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

/* ===== Menu ===== */
.sidebar-menu {
  border-right: none;
  padding: 8px 0;
}

.sidebar-menu :deep(.el-menu-item),
.sidebar-menu :deep(.el-sub-menu__title) {
  height: 52px;
  line-height: 52px;
  margin: 2px 8px;
  border-radius: 10px;
  padding: 0 16px !important;
  font-size: 15px;
  transition: all 0.25s;
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-sub-menu__title:hover) {
  background: rgba(255,255,255,0.1) !important;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: rgba(255,255,255,0.18) !important;
  font-weight: 600;
  color: #fff !important;
}

.menu-icon {
  font-size: 20px;
  margin-right: 8px;
}

.menu-label {
  font-size: 15px;
  letter-spacing: 1px;
}

/* Sub-menu */
.sidebar-menu :deep(.el-sub-menu .el-menu) {
  background: rgba(0,0,0,0.12);
  border-radius: 8px;
  margin: 2px 8px;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item) {
  height: 42px;
  line-height: 42px;
  padding-left: 56px !important;
  font-size: 14px;
  color: rgba(255,255,255,0.75);
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item:hover) {
  color: #fff;
  background: rgba(255,255,255,0.08) !important;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item.is-active) {
  color: #fff !important;
  background: rgba(255,255,255,0.12) !important;
}

/* Badge */
.menu-badge {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.menu-badge :deep(.el-badge__content) {
  font-size: 12px;
  height: 20px;
  line-height: 20px;
  padding: 0 6px;
  background: #E8837A;
  position: static;
}

/* ===== Header ===== */
.app-header {
  background: #fff;
  border-bottom: 1px solid #EDE8E0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 28px;
  height: 56px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
}

.header-greeting {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-right: 20px;
}

.greeting-text {
  font-size: 14px;
  color: #7B8D9E;
}

.greeting-name {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
}

.logout-btn {
  font-size: 14px;
  color: #8B9DAE;
  border: 1px solid #E8E2D8;
  border-radius: 10px;
  padding: 8px 20px;
  transition: all 0.25s;
}

.logout-btn:hover {
  color: #C47876;
  border-color: #E8C8C6;
  background: #FEF8F7;
}

/* ===== Main content ===== */
.app-main {
  background: #F7F4F0;
  min-height: calc(100vh - 56px);
  padding: 24px 28px;
}
</style>
