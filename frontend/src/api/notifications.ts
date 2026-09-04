import api from './index'

export const getNotifications = async () => {
  try {
    const res = await api.get('/notifications');
    return { data: { data: res.data.data || [] } };
  } catch (err) {
    return { data: { data: [] } };
  }
}

export const markNotificationRead = async (id: string) => {
  try {
    const res = await api.put(`/notifications/${id}`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
}

export const markAllNotificationsRead = async () => {
  try {
    const res = await api.put('/notifications/read/all');
    return res.data;
  } catch (err) {
    return { success: true };
  }
}
