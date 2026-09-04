import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as notifApi from '../api/notifications'
import { useAppContext } from '../context/AppContext'

export const NOTIFICATIONS_QUERY_KEY = ['notifications']

export function useNotifications() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const queryKey = [...NOTIFICATIONS_QUERY_KEY, userId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await notifApi.getNotifications()
      return res.data?.data || []
    },
    staleTime: 30000,
  })

  return {
    notifications: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id || 'anonymous'
  const queryKey = [...NOTIFICATIONS_QUERY_KEY, userId]

  const markRead = useMutation({
    mutationFn: notifApi.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const markAllRead = useMutation({
    mutationFn: notifApi.markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    isMarkingRead: markRead.isPending,
    isMarkingAllRead: markAllRead.isPending,
  }
}
