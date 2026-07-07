import axios from 'axios';
import { ElMessage } from 'element-plus';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const { status, data } = error.response || {};
    const msg = data?.error?.message;

    if (status === 401) {
      sessionStorage.removeItem('token');
      window.location.hash = '#/login?expired=true';
      ElMessage.warning(msg || '登录已过期，请重新登录');
    } else if (status === 403) {
      ElMessage.error('无权访问该资源');
    } else if (status === 404) {
      ElMessage.error(msg || '资源不存在');
    } else if (status === 413) {
      ElMessage.error('图片大小不能超过 20MB');
    } else if (status >= 500) {
      ElMessage.error(msg || '服务器错误，请稍后重试');
    }
    return Promise.reject(error);
  }
);

export default api;
