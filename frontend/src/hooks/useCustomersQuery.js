import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as customerApi from '../api/customers'

export const CUSTOMERS_QUERY_KEY = ['customers']

export function useCustomers(type = 'all', search = '') {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, { type, search }],
    queryFn: async () => {
      const res = await customerApi.getCustomers(type, search)
      return res.data?.data || []
    },
  })
}

export function useCustomerMutations() {
  const queryClient = useQueryClient()

  const createCustomerMutation = useMutation({
    mutationFn: async (newCustomerData) => {
      const res = await customerApi.createCustomer(newCustomerData)
      return res.data?.data
    },
    onMutate: async (newCustomerData) => {
      await queryClient.cancelQueries({ queryKey: CUSTOMERS_QUERY_KEY })
      const previousCustomers = queryClient.getQueryData(CUSTOMERS_QUERY_KEY) || []

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

      queryClient.setQueryData(CUSTOMERS_QUERY_KEY, (old = []) => [optimisticCustomer, ...old])

      return { previousCustomers }
    },
    onError: (err, newCustomerData, context) => {
      if (context?.previousCustomers) {
        queryClient.setQueryData(CUSTOMERS_QUERY_KEY, context.previousCustomers)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await customerApi.updateCustomer(id, data)
      return res.data?.data
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: CUSTOMERS_QUERY_KEY })
      const previousCustomers = queryClient.getQueryData(CUSTOMERS_QUERY_KEY) || []

      queryClient.setQueryData(CUSTOMERS_QUERY_KEY, (old = []) =>
        old.map((c) => (c.id === id ? { ...c, ...data } : c))
      )

      return { previousCustomers }
    },
    onError: (err, variables, context) => {
      if (context?.previousCustomers) {
        queryClient.setQueryData(CUSTOMERS_QUERY_KEY, context.previousCustomers)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id) => {
      await customerApi.deleteCustomer(id)
      return id
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CUSTOMERS_QUERY_KEY })
      const previousCustomers = queryClient.getQueryData(CUSTOMERS_QUERY_KEY) || []

      queryClient.setQueryData(CUSTOMERS_QUERY_KEY, (old = []) =>
        old.filter((c) => c.id !== id)
      )

      return { previousCustomers }
    },
    onError: (err, id, context) => {
      if (context?.previousCustomers) {
        queryClient.setQueryData(CUSTOMERS_QUERY_KEY, context.previousCustomers)
      }
    },
    onSettled: () => {
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
