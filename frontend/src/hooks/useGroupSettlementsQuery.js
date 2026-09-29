import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as groupBillsApi from '../api/groupBills'
import { useAppContext } from '../context/AppContext'

export const GROUP_SETTLEMENTS_QUERY_KEY = ['group-settlements']

export function useGroupSettlements(groupBillId) {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const query = useQuery({
    queryKey: [...GROUP_SETTLEMENTS_QUERY_KEY, userId, groupBillId || 'all'],
    queryFn: async () => {
      const res = await groupBillsApi.getGroupSettlements(groupBillId)
      return res.data?.data || []
    },
    staleTime: 30000,
  })

  return {
    groupSettlements: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useGroupSettlementMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const settleGroupBillMutation = useMutation({
    mutationFn: groupBillsApi.settleGroupBill,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_SETTLEMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['group-bills'] })
      queryClient.invalidateQueries({ queryKey: ['groupBills'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const reverseGroupSettlementMutation = useMutation({
    mutationFn: groupBillsApi.reverseGroupSettlement,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: GROUP_SETTLEMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['group-bills'] })
      queryClient.invalidateQueries({ queryKey: ['groupBills'] })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  return {
    settleGroupBill: settleGroupBillMutation.mutateAsync,
    isSettling: settleGroupBillMutation.isPending,
    reverseGroupSettlement: reverseGroupSettlementMutation.mutateAsync,
    isReversing: reverseGroupSettlementMutation.isPending,
  }
}
