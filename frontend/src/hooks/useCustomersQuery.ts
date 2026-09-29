import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as customerApi from '../api/customers'
import { useAppContext } from '../context/AppContext'

export const CUSTOMERS_QUERY_KEY = ['customers']

export function useCustomers(type = 'all', search = '') {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, userId, { type, search }],
    queryFn: async () => {
      const res = await customerApi.getCustomers(type, search)
      return res.data?.data || []
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useCustomerMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const createCustomerMutation = useMutation({
    mutationFn: async (newCustomerData: any) => {
      const res = await customerApi.createCustomer(newCustomerData)
      return res.data?.data
    },
    onMutate: async (newCustomerData: any) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userCustomersKey, exact: false })
      const previousQueries = queryClient.getQueriesData<any[]>({ queryKey: userCustomersKey, exact: false })

      const optimisticCustomer = {
        id: newCustomerData.id || `temp-${Date.now()}`,
        name: newCustomerData.name,
        phone: newCustomerData.phone || '',
        type: newCustomerData.type || 'regular',
        email: newCustomerData.email || '',
        address: newCustomerData.address || '',
        credit_balance: newCustomerData.credit_balance || 0,
        creditBalance: newCustomerData.credit_balance || 0,
        balance_due: newCustomerData.balance_due || 0,
        balanceDue: newCustomerData.balance_due || 0,
        credit_limit: newCustomerData.credit_limit || 0,
        creditLimit: newCustomerData.credit_limit || 0,
        isOptimistic: true,
      }

      queryClient.setQueriesData<any[]>({ queryKey: userCustomersKey, exact: false }, (old = []) => [
        optimisticCustomer,
        ...(Array.isArray(old) ? old : []),
      ])

      return { previousQueries }
    },
    onSuccess: (serverData: any, variables: any) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueriesData<any[]>(
          { queryKey: userCustomersKey, exact: false },
          (old = []) => Array.isArray(old)
            ? old.map((c) => (c.isOptimistic && (c.id === variables.id || c.name === variables.name))
                ? { ...serverData, isOptimistic: false }
                : c
              )
            : old
        )
      }
    },
    onError: (_err, _newCustomerData, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Optimistic cache + onSuccess covers primary entity completely. No full refetch needed.
    },
  })

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await customerApi.updateCustomer(id, data)
      return res.data?.data
    },
    onMutate: async ({ id, data }: { id: string; data: any }) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userCustomersKey, exact: false })
      const previousQueries = queryClient.getQueriesData<any[]>({ queryKey: userCustomersKey, exact: false })

      queryClient.setQueriesData<any[]>({ queryKey: userCustomersKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.map((c) => (c.id === id ? { ...c, ...data, isOptimistic: true } : c)) : old
      )

      return { previousQueries }
    },
    onSuccess: (serverData: any, variables: { id: string; data: any }) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueriesData<any[]>(
          { queryKey: userCustomersKey, exact: false },
          (old = []) => Array.isArray(old)
            ? old.map((c) => (c.id === variables.id ? { ...serverData, isOptimistic: false } : c))
            : old
        )
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Handled via optimistic and onSuccess replacement
    },
  })

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      await customerApi.deleteCustomer(id)
      return id
    },
    onMutate: async (id: string) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userCustomersKey, exact: false })
      const previousQueries = queryClient.getQueriesData<any[]>({ queryKey: userCustomersKey, exact: false })

      queryClient.setQueriesData<any[]>({ queryKey: userCustomersKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.filter((c) => c.id !== id) : old
      )

      return { previousQueries }
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      // Optimistic delete already removed from cache
    },
  })

  return {
    createCustomer: createCustomerMutation.mutateAsync,
    updateCustomer: updateCustomerMutation.mutateAsync,
    deleteCustomer: deleteCustomerMutation.mutateAsync,
    isCreating: createCustomerMutation.isPending,
    isUpdating: updateCustomerMutation.isPending,
    isDeleting: deleteCustomerMutation.isPending,
  }
}
