import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as notifApi from '../api/notifications'
import { useAppContext } from '../context/AppContext'

export const NOTIFICATIONS_QUERY_KEY = ['notifications']

export function useNotifications() {
  const { currentUser, notifications: contextNotifications = [] } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const queryKey = [...NOTIFICATIONS_QUERY_KEY, userId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await notifApi.getNotifications()
      const serverNotes = res.data?.data || []
      return serverNotes.length > 0 ? serverNotes : contextNotifications
    },
    initialData: contextNotifications,
    staleTime: 30000,
  })

  // Prefer reactive context notifications if available, otherwise query data
  const notifications = contextNotifications.length > 0 ? contextNotifications : (query.data || [])

  return {
    notifications,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const {
    currentUser,
    markNotificationRead: contextMarkRead,
    markAllNotificationsRead: contextMarkAllRead,
    deleteNotification: contextDelete,
    clearAllNotifications: contextClearAll,
    addNotification: contextAdd,
  } = useAppContext()
  const userId = currentUser?.id || 'anonymous'
  const queryKey = [...NOTIFICATIONS_QUERY_KEY, userId]

  const markRead = useMutation({
    mutationFn: async (id) => {
      if (contextMarkRead) contextMarkRead(id)
      return notifApi.markNotificationRead(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (contextMarkAllRead) contextMarkAllRead()
      return notifApi.markAllNotificationsRead()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteNotification = useMutation({
    mutationFn: async (id) => {
      if (contextDelete) contextDelete(id)
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const clearAllNotifications = useMutation({
    mutationFn: async () => {
      if (contextClearAll) contextClearAll()
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const addNotification = useMutation({
    mutationFn: async (notification) => {
      if (contextAdd) contextAdd(notification)
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    deleteNotification: deleteNotification.mutateAsync,
    clearAllNotifications: clearAllNotifications.mutateAsync,
    addNotification: addNotification.mutateAsync,
    isMarkingRead: markRead.isPending,
    isMarkingAllRead: markAllRead.isPending,
  }
}

