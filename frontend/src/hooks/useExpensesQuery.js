import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as purchasesApi from '../api/purchases'
import { useAppContext } from '../context/AppContext'

export const EXPENSES_QUERY_KEY = ['expenses']

export const mapPurchaseFromApi = (p) => ({
  ...p,
  id: p.id,
  date: p.date,
  description: p.item_name || p.description || p.notes || p.category || 'Expense',
  itemName: p.item_name || p.description || '',
  category: p.category || 'Supplies',
  amount: Number(p.total !== undefined ? p.total : (p.amount || 0)),
  total: Number(p.total !== undefined ? p.total : (p.amount || 0)),
  cashAmount: Number(p.cash_amount !== undefined ? p.cash_amount : (p.cashAmount !== undefined ? p.cashAmount : (p.total || p.amount || 0))),
  upiAmount: Number(p.upi_amount !== undefined ? p.upi_amount : (p.upiAmount || 0)),
  qty: Number(p.qty || 1),
  unitCost: Number(p.unit_cost !== undefined ? p.unit_cost : (p.unitCost || 0)),
  notes: p.notes || '',
  receiptUrl: p.receipt_url || p.receiptUrl || '',
  createdAt: p.created_at || p.createdAt || p.date,
})

export function useExpenses(filters = {}) {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...EXPENSES_QUERY_KEY, userId, filters],
    queryFn: async () => {
      const res = await purchasesApi.getPurchases(filters)
      const raw = res.data?.data || []
      return raw.map(mapPurchaseFromApi)
    },
    enabled: !!userId,
  })
}

export function useExpenseMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const createExpenseMutation = useMutation({
    mutationFn: async (expenseData) => {
      const payload = {
        date: expenseData.date || new Date().toISOString().slice(0, 10),
        item_name: expenseData.item_name || expenseData.description || expenseData.itemName || 'Expense',
        category: expenseData.category || 'Supplies',
        qty: Number(expenseData.qty || 1),
        unit_cost: Number(expenseData.unit_cost || expenseData.amount || 0),
        total: Number(expenseData.total !== undefined ? expenseData.total : (expenseData.amount || 0)),
        notes: expenseData.notes || expenseData.description || '',
      }
      const res = await purchasesApi.createPurchase(payload)
      return mapPurchaseFromApi(res.data?.data || payload)
    },
    onMutate: async (newExpense) => {
      const userKey = [...EXPENSES_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userKey })
      const previousExpenses = queryClient.getQueryData(userKey) || []

      const optimisticExpense = mapPurchaseFromApi({
        id: newExpense.id || `temp-exp-${Date.now()}`,
        date: newExpense.date || new Date().toISOString().slice(0, 10),
        description: newExpense.description || newExpense.item_name || 'Expense',
        category: newExpense.category || 'Supplies',
        amount: Number(newExpense.amount || newExpense.total || 0),
        total: Number(newExpense.total || newExpense.amount || 0),
        cashAmount: Number(newExpense.cashAmount || newExpense.amount || 0),
        upiAmount: Number(newExpense.upiAmount || 0),
        notes: newExpense.notes || '',
        isOptimistic: true,
      })

      queryClient.setQueryData(userKey, (old = []) => [optimisticExpense, ...old])

      return { previousExpenses, userKey }
    },
    onError: (err, variables, context) => {
      if (context?.previousExpenses && context?.userKey) {
        queryClient.setQueryData(context.userKey, context.previousExpenses)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY })
    },
  })

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id) => {
      await purchasesApi.deletePurchase(id)
      return id
    },
    onMutate: async (id) => {
      const userKey = [...EXPENSES_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userKey })
      const previousExpenses = queryClient.getQueryData(userKey) || []

      queryClient.setQueryData(userKey, (old = []) => old.filter((e) => String(e.id) !== String(id)))

      return { previousExpenses, userKey }
    },
    onError: (err, id, context) => {
      if (context?.previousExpenses && context?.userKey) {
        queryClient.setQueryData(context.userKey, context.previousExpenses)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY })
    },
  })

  return {
    createExpense: createExpenseMutation.mutateAsync,
    deleteExpense: deleteExpenseMutation.mutateAsync,
    isCreatingExpense: createExpenseMutation.isPending,
    isDeletingExpense: deleteExpenseMutation.isPending,
  }
}
