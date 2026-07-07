import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { guest: true }
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'reports', name: 'Reports', component: () => import('../views/Reports.vue') },
      { path: 'reports/upload', name: 'ReportUpload', component: () => import('../views/ReportUpload.vue') },
      { path: 'reports/:id', name: 'ReportDetail', component: () => import('../views/ReportDetail.vue') },
      { path: 'medications', name: 'Medications', component: () => import('../views/Medications.vue') },
      { path: 'consultation', name: 'Consultation', component: () => import('../views/Consultation.vue') },
      { path: 'trends', name: 'Trends', component: () => import('../views/Trends.vue') },
      { path: 'cga', name: 'CGA', component: () => import('../views/CGAAssessment.vue') },
      { path: 'cognitive', name: 'Cognitive', component: () => import('../views/CognitiveScreening.vue') },
      { path: 'profile', name: 'Profile', component: () => import('../views/Profile.vue') },
      { path: 'settings', name: 'Settings', component: () => import('../views/Settings.vue') }
    ]
  }
];

const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to, from, next) => {
  const token = sessionStorage.getItem('token');
  if (to.meta.guest) {
    if (token) return next('/dashboard');
    return next();
  }
  if (!token) return next('/login');
  next();
});

export default router;
