import apiClient from '@/lib/api/client';

export const fetchAttendanceOverview = (date) =>
  apiClient.get('/api/attendance', { params: date ? { date } : undefined });

export const saveAttendanceSettings = (payload) =>
  apiClient.put('/api/attendance', payload);

export const saveAttendanceEmployeeProfile = (userId, payload) =>
  apiClient.put(`/api/attendance/profiles/${encodeURIComponent(userId)}`, payload);

export const registerAttendanceDevice = (payload) =>
  apiClient.post('/api/attendance/devices', payload);

export const updateAttendanceDevice = (deviceUuid, payload) =>
  apiClient.put(`/api/attendance/devices/${encodeURIComponent(deviceUuid)}`, payload);

export const rotateAttendanceDeviceKey = (deviceUuid) =>
  apiClient.post(`/api/attendance/devices/${encodeURIComponent(deviceUuid)}/rotate-key`);
