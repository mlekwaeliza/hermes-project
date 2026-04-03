import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

// Helper to get cookie value
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return null;
}

// Interceptor to add CSRF token to state-changing requests
api.interceptors.request.use(config => {
  const method = config.method.toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCookie('csrfToken');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      console.warn('CSRF token not found - cookie may have expired');
    }
  }
  return config;
}, error => Promise.reject(error));

// Auth API
export const authAPI = {
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  uploadProfilePicture: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/auth/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  updateProfile: (data) => api.put('/auth/profile', data)
};

// Admin API
export const adminAPI = {
  uploadCSV: (file) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post('/admin/upload-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getSections: () => api.get('/admin/sections'),
  createSection: (name) => api.post('/admin/sections', { name }),
  getMembers: (filters = {}) => api.get('/admin/members', { params: filters }),
  updateMember: (id, data) => api.put(`/admin/members/${id}`, data),
  deleteMember: (id) => api.delete(`/admin/members/${id}`),
  getAttendance: (filters = {}) => api.get('/admin/attendance', { params: filters }),
  updateAttendance: (id, status) => api.put(`/admin/attendance/${id}`, { status }),
  exportAttendance: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    window.open(`/api/admin/export?${params}`, '_blank');
  },
  getLeaders: () => api.get('/admin/leaders'),
  resetLeaderPassword: (leaderId) => api.post(`/admin/leaders/${leaderId}/reset-password`),
  createMember: (data) => api.post('/admin/members', data),
  getHistory: () => api.get('/admin/history'),
  getAttendanceTrends: (days = 90) => api.get(`/admin/attendance-trends?days=${days}`),
  getAggregatedOverview: (filterType, filterValue) => api.get('/admin/aggregated-overview', { params: { filterType, filterValue } }),
  getLeaderDashboard: (id) => api.get(`/admin/leader-dashboard/${id}`),
  submitAttendance: (date, attendance, leader_id, section_id) => api.post('/admin/attendance', { date, attendance, leader_id, section_id }),
  getTopMembers: (year, week) => api.get('/admin/rewards/top-members', { params: { year, week } }),
  getTopLeaders: (year, week) => api.get('/admin/rewards/top-leaders', { params: { year, week } }),

};

// Leader API
export const leaderAPI = {
  getMembers: () => api.get('/leader/members'),
  createMember: (data) => api.post('/leader/members', data),
  updateMember: (id, data) => api.put(`/leader/members/${id}`, data),
  deleteMember: (id) => api.delete(`/leader/members/${id}`),
  getAttendanceStatus: (date) => api.get(`/leader/attendance/${date}`),
  submitAttendance: (date, attendance) => api.post('/leader/attendance', { date, attendance }),
  getHistory: () => api.get('/leader/history'),
  getSectionOverview: (date) => api.get(`/leader/section-overview/${date}`),
  getAttendanceTrends: (days = 90) => api.get(`/leader/attendance-trends?days=${days}`)
};

// Pastor API
export const pastorAPI = {
  getDashboardStats: (filters = {}) => api.get('/pastor/dashboard/stats', { params: filters }),
  getTrends: (filters = {}) => api.get('/pastor/dashboard/trends', { params: filters }),
  getLeaderMetrics: (filters = {}) => api.get('/pastor/leaders/metrics', { params: filters }),
  getAtRiskMembers: () => api.get('/pastor/members/at-risk'),
  getMemberHistory: (memberId) => api.get(`/pastor/members/${memberId}/history`)
};

export default api;
