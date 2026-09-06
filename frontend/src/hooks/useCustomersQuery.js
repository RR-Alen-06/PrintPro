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
  })
}

export function useCustomerMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const createCustomerMutation = useMutation({
    mutationFn: async (newCustomerData) => {
      const res = await customerApi.createCustomer(newCustomerData)
      return res.data?.data
    },
    onMutate: async (newCustomerData) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userCustomersKey, exact: false })
      const previousQueries = queryClient.getQueriesData({ queryKey: userCustomersKey, exact: false })

      const optimisticCustomer = {
        id: newCustomerData.id || `temp-${Date.now()}`,
        name: newCustomerData.name,
        phone: newCustomerData.phone || '',
        type: newCustomerData.type || 'regular',
        email: newCustomerData.email || '',
        address: newCustomerData.address || '',
        credit_balance: newCustomerData.credit_balance || 0,
        credit_limit: newCustomerData.credit_limit || 0,
        isOptimistic: true,
      }

      queryClient.setQueriesData({ queryKey: userCustomersKey, exact: false }, (old = []) => [
        optimisticCustomer,
        ...(Array.isArray(old) ? old : []),
      ])

      return { previousQueries }
    },
    onError: (err, newCustomerData, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...CUSTOMERS_QUERY_KEY, userId] })
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await customerApi.updateCustomer(id, data)
      return res.data?.data
    },
    onMutate: async ({ id, data }) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userCustomersKey, exact: false })
      const previousQueries = queryClient.getQueriesData({ queryKey: userCustomersKey, exact: false })

      queryClient.setQueriesData({ queryKey: userCustomersKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.map((c) => (c.id === id ? { ...c, ...data, isOptimistic: true } : c)) : old
      )

      return { previousQueries }
    },
    onError: (err, variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...CUSTOMERS_QUERY_KEY, userId] })
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id) => {
      await customerApi.deleteCustomer(id)
      return id
    },
    onMutate: async (id) => {
      const userCustomersKey = [...CUSTOMERS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userCustomersKey, exact: false })
      const previousQueries = queryClient.getQueriesData({ queryKey: userCustomersKey, exact: false })

      queryClient.setQueriesData({ queryKey: userCustomersKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.filter((c) => c.id !== id) : old
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
      queryClient.invalidateQueries({ queryKey: [...CUSTOMERS_QUERY_KEY, userId] })
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
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
