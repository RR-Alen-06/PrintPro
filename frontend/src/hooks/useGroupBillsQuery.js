import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as groupBillsApi from '../api/groupBills'
import { useAppContext } from '../context/AppContext'

export const GROUP_BILLS_QUERY_KEY = ['group-bills']

export function useGroupBills() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const query = useQuery({
    queryKey: [...GROUP_BILLS_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await groupBillsApi.getGroupBills()
      return res.data?.data || []
    },
    staleTime: 30000,
  })

  return {
    groupBills: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useGroupBillMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id || 'anonymous'
  const queryKey = [...GROUP_BILLS_QUERY_KEY, userId]

  const createGroupBill = useMutation({
    mutationFn: groupBillsApi.createGroupBill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const updateGroupBill = useMutation({
    mutationFn: ({ id, ...data }) => groupBillsApi.updateGroupBill(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteGroupBill = useMutation({
    mutationFn: groupBillsApi.deleteGroupBill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    createGroupBill: createGroupBill.mutateAsync,
    updateGroupBill: updateGroupBill.mutateAsync,
    deleteGroupBill: deleteGroupBill.mutateAsync,
    isCreating: createGroupBill.isPending,
    isUpdating: updateGroupBill.isPending,
    isDeleting: deleteGroupBill.isPending,
  }
}
