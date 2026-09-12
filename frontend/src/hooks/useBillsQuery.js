import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as billsApi from '../api/bills'
import { useAppContext } from '../context/AppContext'

export const BILLS_QUERY_KEY = ['bills']

export function useBills(filters = {}) {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...BILLS_QUERY_KEY, userId, filters],
    queryFn: async () => {
      const res = await billsApi.getBills(filters)
      return res.data?.data || []
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

export function useBill(id) {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...BILLS_QUERY_KEY, userId, id],
    queryFn: async () => {
      if (!id) return null
      const res = await billsApi.getBill(id)
      return res.data?.data || null
    },
    enabled: !!userId && !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useDeletedBills() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...BILLS_QUERY_KEY, 'deleted', userId],
    queryFn: async () => {
      const res = await billsApi.getDeletedBills()
      return res.data?.data || []
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useBillMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const createBillMutation = useMutation({
    mutationFn: async (billData) => {
      const res = await billsApi.createBill(billData)
      return res.data?.data
    },
    onMutate: async (newBillData) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userBillsKey, exact: false })
      const previousQueries = queryClient.getQueriesData({ queryKey: userBillsKey, exact: false })

      const optimisticBill = {
        id: newBillData.id || `temp-bill-${Date.now()}`,
        invoice_number: newBillData.invoice_number || newBillData.invoiceNumber || 'BILL-SAVING...',
        invoiceNumber: newBillData.invoice_number || newBillData.invoiceNumber || 'BILL-SAVING...',
        customer_id: newBillData.customer_id || newBillData.customerId,
        customerId: newBillData.customer_id || newBillData.customerId,
        customer_name: newBillData.customer_name || newBillData.customerName || 'Customer',
        customerName: newBillData.customer_name || newBillData.customerName || 'Customer',
        date: newBillData.date,
        total: newBillData.total || 0,
        amount_paid: newBillData.amount_paid !== undefined ? newBillData.amount_paid : (newBillData.amountPaid || 0),
        amountPaid: newBillData.amount_paid !== undefined ? newBillData.amount_paid : (newBillData.amountPaid || 0),
        balance: newBillData.balance !== undefined ? newBillData.balance : 0,
        status: newBillData.status || 'unpaid',
        items: newBillData.items || [],
        isOptimistic: true,
      }

      queryClient.setQueriesData({ queryKey: userBillsKey, exact: false }, (old = []) => [
        optimisticBill,
        ...(Array.isArray(old) ? old : []),
      ])

      return { previousQueries }
    },
    onSuccess: (serverData, variables) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueriesData(
          { queryKey: userBillsKey, exact: false },
          (old = []) => Array.isArray(old)
            ? old.map((b) => (b.isOptimistic && (b.id === variables.id || b.invoice_number === variables.invoice_number || b.invoiceNumber === variables.invoiceNumber))
                ? { ...serverData, isOptimistic: false }
                : b
              )
            : old
        )
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  const updateBillMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await billsApi.updateBill(id, data)
      return res.data?.data
    },
    onMutate: async ({ id, data }) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userBillsKey, exact: false })
      const previousQueries = queryClient.getQueriesData({ queryKey: userBillsKey, exact: false })

      queryClient.setQueriesData({ queryKey: userBillsKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.map((b) => (b.id === id ? { ...b, ...data, isOptimistic: true } : b)) : old
      )

      return { previousQueries }
    },
    onSuccess: (serverData, variables) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueriesData(
          { queryKey: userBillsKey, exact: false },
          (old = []) => Array.isArray(old)
            ? old.map((b) => (b.id === variables.id ? { ...serverData, isOptimistic: false } : b))
            : old
        )
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  const deleteBillMutation = useMutation({
    mutationFn: async (id) => {
      await billsApi.deleteBill(id)
      return id
    },
    onMutate: async (id) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userBillsKey, exact: false })
      const previousQueries = queryClient.getQueriesData({ queryKey: userBillsKey, exact: false })

      queryClient.setQueriesData({ queryKey: userBillsKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.filter((b) => b.id !== id) : old
      )

      return { previousQueries }
    },
    onError: (err, id, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  const restoreBillMutation = useMutation({
    mutationFn: async (id) => {
      await billsApi.restoreBill(id)
      return id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })

  return {
    createBill: createBillMutation.mutateAsync,
    updateBill: updateBillMutation.mutateAsync,
    deleteBill: deleteBillMutation.mutateAsync,
    restoreBill: restoreBillMutation.mutateAsync,
    isCreatingBill: createBillMutation.isPending,
    isUpdatingBill: updateBillMutation.isPending,
    isDeletingBill: deleteBillMutation.isPending,
    isRestoringBill: restoreBillMutation.isPending,
  }
}
