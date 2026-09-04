import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as paymentsApi from '../api/payments'
import * as inventoryApi from '../api/inventory'
import * as purchasesApi from '../api/purchases'
import * as advancePaymentsApi from '../api/advancePayments'
import { useAppContext } from '../context/AppContext'

// ── 1. PAYMENTS HOOKS ────────────────────────────────────────────────────────
export const PAYMENTS_QUERY_KEY = ['payments']

export function usePayments() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...PAYMENTS_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await paymentsApi.getPayments()
      return res.data?.data || []
    },
    enabled: !!userId,
  })
}

export function usePaymentMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData) => {
      const res = await paymentsApi.createPayment(paymentData)
      return res.data?.data
    },
    onMutate: async (newPayment) => {
      const userPaymentsKey = [...PAYMENTS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userPaymentsKey })
      const previousPayments = queryClient.getQueryData(userPaymentsKey) || []

      const cash = Number(newPayment.cash_amount !== undefined ? newPayment.cash_amount : (newPayment.cashAmount || 0))
      const upi = Number(newPayment.upi_amount !== undefined ? newPayment.upi_amount : (newPayment.upiAmount || 0))
      const total = Number(newPayment.total_paid !== undefined ? newPayment.total_paid : (newPayment.totalPaid || (cash + upi)))
      const billId = newPayment.bill_id || newPayment.billId
      const customerId = newPayment.customer_id || newPayment.customerId
      const pType = newPayment.payment_type || newPayment.paymentType || 'partial'

      const optimisticPayment = {
        id: newPayment.id || `temp-pay-${Date.now()}`,
        billId,
        bill_id: billId,
        customerId,
        customer_id: customerId,
        date: newPayment.date || new Date().toISOString().slice(0, 10),
        cashAmount: cash,
        cash_amount: cash,
        upiAmount: upi,
        upi_amount: upi,
        totalPaid: total,
        total_paid: total,
        paymentType: pType,
        payment_type: pType,
        notes: newPayment.notes || '',
        isOptimistic: true,
      }

      queryClient.setQueryData(userPaymentsKey, (old = []) => [optimisticPayment, ...old])

      return { previousPayments, userPaymentsKey }
    },
    onError: (err, variables, context) => {
      if (context?.previousPayments && context?.userPaymentsKey) {
        queryClient.setQueryData(context.userPaymentsKey, context.previousPayments)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: async (id) => {
      await paymentsApi.deletePayment(id)
      return id
    },
    onMutate: async (id) => {
      const userPaymentsKey = [...PAYMENTS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userPaymentsKey })
      const previousPayments = queryClient.getQueryData(userPaymentsKey) || []

      queryClient.setQueryData(userPaymentsKey, (old = []) => old.filter((p) => p.id !== id))

      return { previousPayments, userPaymentsKey }
    },
    onError: (err, id, context) => {
      if (context?.previousPayments && context?.userPaymentsKey) {
        queryClient.setQueryData(context.userPaymentsKey, context.previousPayments)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })

  return {
    createPayment: createPaymentMutation.mutateAsync,
    deletePayment: deletePaymentMutation.mutateAsync,
    isCreatingPayment: createPaymentMutation.isPending,
    isDeletingPayment: deletePaymentMutation.isPending,
  }
}

// ── 2. INVENTORY HOOKS ───────────────────────────────────────────────────────
export const INVENTORY_QUERY_KEY = ['inventory']

export function useInventory() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...INVENTORY_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await inventoryApi.getItems()
      return res.data?.data || []
    },
    enabled: !!userId,
  })
}

export function useInventoryMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const createItemMutation = useMutation({
    mutationFn: async (itemData) => {
      const res = await inventoryApi.createItem(itemData)
      return res.data?.data
    },
    onMutate: async (newItem) => {
      const userInventoryKey = [...INVENTORY_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userInventoryKey })
      const previousItems = queryClient.getQueryData(userInventoryKey) || []

      const optimisticItem = {
        id: newItem.id || `temp-item-${Date.now()}`,
        name: newItem.name,
        color_single: newItem.color_single || 0,
        color_double: newItem.color_double || 0,
        bw_single: newItem.bw_single || 0,
        bw_double: newItem.bw_double || 0,
        stock: newItem.stock || 0,
        low_stock_alert: newItem.low_stock_alert || 50,
        isOptimistic: true,
      }

      queryClient.setQueryData(userInventoryKey, (old = []) => [optimisticItem, ...old])

      return { previousItems, userInventoryKey }
    },
    onError: (err, variables, context) => {
      if (context?.previousItems && context?.userInventoryKey) {
        queryClient.setQueryData(context.userInventoryKey, context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY })
    },
  })

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await inventoryApi.updateItem(id, data)
      return res.data?.data
    },
    onMutate: async ({ id, data }) => {
      const userInventoryKey = [...INVENTORY_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userInventoryKey })
      const previousItems = queryClient.getQueryData(userInventoryKey) || []

      queryClient.setQueryData(userInventoryKey, (old = []) =>
        old.map((i) => (i.id === id ? { ...i, ...data } : i))
      )

      return { previousItems, userInventoryKey }
    },
    onError: (err, variables, context) => {
      if (context?.previousItems && context?.userInventoryKey) {
        queryClient.setQueryData(context.userInventoryKey, context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY })
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (id) => {
      await inventoryApi.deleteItem(id)
      return id
    },
    onMutate: async (id) => {
      const userInventoryKey = [...INVENTORY_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userInventoryKey })
      const previousItems = queryClient.getQueryData(userInventoryKey) || []

      queryClient.setQueryData(userInventoryKey, (old = []) => old.filter((i) => i.id !== id))

      return { previousItems, userInventoryKey }
    },
    onError: (err, id, context) => {
      if (context?.previousItems && context?.userInventoryKey) {
        queryClient.setQueryData(context.userInventoryKey, context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY })
    },
  })

  return {
    createItem: createItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutateAsync,
    deleteItem: deleteItemMutation.mutateAsync,
    isCreatingItem: createItemMutation.isPending,
    isUpdatingItem: updateItemMutation.isPending,
    isDeletingItem: deleteItemMutation.isPending,
  }
}

// ── 3. PURCHASES HOOKS ───────────────────────────────────────────────────────
export const PURCHASES_QUERY_KEY = ['purchases']

export function usePurchases() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...PURCHASES_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await purchasesApi.getPurchases()
      return res.data?.data || []
    },
    enabled: !!userId,
  })
}

export function usePurchaseMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const createPurchaseMutation = useMutation({
    mutationFn: async (purchaseData) => {
      const res = await purchasesApi.createPurchase(purchaseData)
      return res.data?.data
    },
    onMutate: async (newPurchase) => {
      const userPurchasesKey = [...PURCHASES_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userPurchasesKey })
      const previousPurchases = queryClient.getQueryData(userPurchasesKey) || []

      const optimisticPurchase = {
        id: newPurchase.id || `temp-pur-${Date.now()}`,
        date: newPurchase.date,
        item_name: newPurchase.item_name,
        category: newPurchase.category,
        qty: newPurchase.qty || 1,
        unit_cost: newPurchase.unit_cost || 0,
        total: newPurchase.total || 0,
        notes: newPurchase.notes || '',
        isOptimistic: true,
      }

      queryClient.setQueryData(userPurchasesKey, (old = []) => [optimisticPurchase, ...old])

      return { previousPurchases, userPurchasesKey }
    },
    onError: (err, variables, context) => {
      if (context?.previousPurchases && context?.userPurchasesKey) {
        queryClient.setQueryData(context.userPurchasesKey, context.previousPurchases)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASES_QUERY_KEY })
    },
  })

  const updatePurchaseMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await purchasesApi.updatePurchase(id, data)
      return res.data?.data
    },
    onMutate: async ({ id, data }) => {
      const userPurchasesKey = [...PURCHASES_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userPurchasesKey })
      const previousPurchases = queryClient.getQueryData(userPurchasesKey) || []

      queryClient.setQueryData(userPurchasesKey, (old = []) =>
        old.map((p) => (p.id === id ? { ...p, ...data } : p))
      )

      return { previousPurchases, userPurchasesKey }
    },
    onError: (err, variables, context) => {
      if (context?.previousPurchases && context?.userPurchasesKey) {
        queryClient.setQueryData(context.userPurchasesKey, context.previousPurchases)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASES_QUERY_KEY })
    },
  })

  const deletePurchaseMutation = useMutation({
    mutationFn: async (id) => {
      await purchasesApi.deletePurchase(id)
      return id
    },
    onMutate: async (id) => {
      const userPurchasesKey = [...PURCHASES_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userPurchasesKey })
      const previousPurchases = queryClient.getQueryData(userPurchasesKey) || []

      queryClient.setQueryData(userPurchasesKey, (old = []) => old.filter((p) => p.id !== id))

      return { previousPurchases, userPurchasesKey }
    },
    onError: (err, id, context) => {
      if (context?.previousPurchases && context?.userPurchasesKey) {
        queryClient.setQueryData(context.userPurchasesKey, context.previousPurchases)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASES_QUERY_KEY })
    },
  })

  return {
    createPurchase: createPurchaseMutation.mutateAsync,
    updatePurchase: updatePurchaseMutation.mutateAsync,
    deletePurchase: deletePurchaseMutation.mutateAsync,
    isCreatingPurchase: createPurchaseMutation.isPending,
    isUpdatingPurchase: updatePurchaseMutation.isPending,
    isDeletingPurchase: deletePurchaseMutation.isPending,
  }
}

// ── 4. DELETED / REFUND PAYMENTS HOOK ────────────────────────────────────────
export const DELETED_PAYMENTS_QUERY_KEY = ['deleted-payments']

export function useDeletedPayments() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...DELETED_PAYMENTS_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await paymentsApi.getDeletedPayments()
      return res.data?.data || []
    },
    enabled: !!userId,
    staleTime: 30000,
  })
}

// ── 5. ADVANCE PAYMENTS HOOKS ────────────────────────────────────────────────
export const ADVANCE_PAYMENTS_QUERY_KEY = ['advance-payments']

export function useAdvancePayments() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...ADVANCE_PAYMENTS_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await advancePaymentsApi.getAdvancePayments()
      return res.data?.data || []
    },
    enabled: !!userId,
    staleTime: 30000,
  })
}

export function useAdvancePaymentMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id
  const queryKey = [...ADVANCE_PAYMENTS_QUERY_KEY, userId]

  const createAdvance = useMutation({
    mutationFn: async (payload) => {
      const res = await advancePaymentsApi.createAdvancePayment(payload)
      return res.data?.data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const deleteAdvance = useMutation({
    mutationFn: async (id) => {
      await advancePaymentsApi.deleteAdvancePayment(id)
      return id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  return {
    addAdvancePayment: createAdvance.mutateAsync,
    deleteAdvancePayment: deleteAdvance.mutateAsync,
    isAddingAdvance: createAdvance.isPending,
    isDeletingAdvance: deleteAdvance.isPending,
  }
}

