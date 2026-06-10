import axios from 'axios';
import { getToken, clearToken } from './auth';

// 개발 환경: Vite proxy(`/api` -> http://localhost:8000) 통과
// 배포 환경: VITE_API_BASE_URL에 백엔드 origin (e.g. https://articulum-api.onrender.com/api) 지정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  },
);

export default api;
