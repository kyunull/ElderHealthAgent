<template>
  <el-container style="min-height:100vh">
    <el-aside width="220px" style="background:#1d1e2c;color:#fff">
      <div style="padding:20px;font-size:18px;font-weight:bold;border-bottom:1px solid #333">
        🏥 颐年家庭医生
      </div>
      <el-menu :default-active="activeMenu" background-color="#1d1e2c" text-color="#bfcbd9" active-text-color="#409eff" router>
        <el-menu-item index="/dashboard"><el-icon><DataBoard /></el-icon> 首页仪表盘</el-menu-item>
        <el-sub-menu index="reports-group">
          <template #title><el-icon><Document /></el-icon> 健康报告</template>
          <el-menu-item index="/reports">📋 报告列表</el-menu-item>
          <el-menu-item index="/reports/upload">📤 上传检查单</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/medications">
          <el-icon><Service /></el-icon>
          <span>用药管理</span>
          <el-badge v-if="medCount > 0" :value="medCount" :max="99" class="menu-badge" />
        </el-menu-item>
        <el-menu-item index="/consultation"><el-icon><UserFilled /></el-icon> 专家分析</el-menu-item>
        <el-menu-item index="/trends"><el-icon><TrendCharts /></el-icon> 健康趋势</el-menu-item>
        <el-menu-item index="/cga"><el-icon><Sunny /></el-icon> 老年综合评估</el-menu-item>
        <el-menu-item index="/cognitive"><el-icon><Reading /></el-icon> 认知筛查</el-menu-item>
        <el-menu-item index="/profile"><el-icon><User /></el-icon> 个人档案</el-menu-item>
        <el-menu-item index="/settings"><el-icon><Setting /></el-icon> 设置</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background:#fff;border-bottom:1px solid #e4e7ed;display:flex;align-items:center;justify-content:flex-end;padding:0 20px">
        <span style="margin-right:12px">{{ username }}</span>
        <el-button type="danger" text @click="logout">退出登录</el-button>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
.menu-badge {
  margin-left: auto;
  margin-right: 8px;
  display: flex;
  align-items: center;
}
.menu-badge :deep(.el-badge__content) {
  font-size: 11px;
  position: static;
}
</style>
