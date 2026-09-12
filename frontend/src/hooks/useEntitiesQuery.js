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
    staleTime: 1000 * 60 * 2, // 2 minutes
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
    onSuccess: (serverData, variables) => {
      const userPaymentsKey = [...PAYMENTS_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueryData(userPaymentsKey, (old = []) =>
          Array.isArray(old)
            ? old.map((p) =>
                p.isOptimistic && (p.id === variables.id || (p.bill_id && p.bill_id === variables.bill_id))
                  ? { ...serverData, isOptimistic: false }
                  : p
              )
            : old
        )
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousPayments && context?.userPaymentsKey) {
        queryClient.setQueryData(context.userPaymentsKey, context.previousPayments)
      }
    },
    onSettled: () => {
      // Payment list updated optimistically; invalidate dependent balances with 1500ms delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['bills'] })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      }, 1500)
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
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['bills'] })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      }, 1500)
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
    staleTime: 1000 * 60 * 10, // 10 minutes (changes infrequently)
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

      const singleC = Number(newItem.color_single !== undefined ? newItem.color_single : (newItem.colorSingle || 0)) || 0
      const doubleC = Number(newItem.color_double !== undefined ? newItem.color_double : (newItem.colorDouble || 0)) || 0
      const singleB = Number(newItem.bw_single !== undefined ? newItem.bw_single : (newItem.bwSingle || 0)) || 0
      const doubleB = Number(newItem.bw_double !== undefined ? newItem.bw_double : (newItem.bwDouble || 0)) || 0
      const sp = Number(newItem.selling_price !== undefined ? newItem.selling_price : (newItem.sellingPrice || 0)) || 0
      const stock = Number(newItem.stock || 0) || 0
      const lowStock = Number(newItem.low_stock_alert !== undefined ? newItem.low_stock_alert : (newItem.lowStockAlert || 50)) || 50

      const optimisticItem = {
        id: newItem.id || `temp-item-${Date.now()}`,
        name: newItem.name || '',
        type: newItem.type || 'print',
        hsnCode: newItem.hsn_code || newItem.hsnCode || '',
        hsn_code: newItem.hsn_code || newItem.hsnCode || '',
        sellingPrice: sp,
        selling_price: sp,
        colorSingle: singleC,
        color_single: singleC,
        colorDouble: doubleC,
        color_double: doubleC,
        bwSingle: singleB,
        bw_single: singleB,
        bwDouble: doubleB,
        bw_double: doubleB,
        stock,
        lowStockAlert: lowStock,
        low_stock_alert: lowStock,
        isOptimistic: true,
      }

      queryClient.setQueryData(userInventoryKey, (old = []) => [optimisticItem, ...old])

      return { previousItems, userInventoryKey }
    },
    onSuccess: (serverData, variables) => {
      const userInventoryKey = [...INVENTORY_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueryData(userInventoryKey, (old = []) =>
          Array.isArray(old)
            ? old.map((i) =>
                i.isOptimistic && (i.id === variables.id || i.name === variables.name)
                  ? { ...serverData, isOptimistic: false }
                  : i
              )
            : old
        )
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousItems && context?.userInventoryKey) {
        queryClient.setQueryData(context.userInventoryKey, context.previousItems)
      }
    },
    onSettled: () => {
      // Optimistic cache covers this mutation
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
        old.map((i) => {
          if (i.id !== id) return i
          const singleC = Number(data.color_single !== undefined ? data.color_single : (data.colorSingle !== undefined ? data.colorSingle : (i.colorSingle ?? i.color_single ?? 0))) || 0
          const doubleC = Number(data.color_double !== undefined ? data.color_double : (data.colorDouble !== undefined ? data.colorDouble : (i.colorDouble ?? i.color_double ?? 0))) || 0
          const singleB = Number(data.bw_single !== undefined ? data.bw_single : (data.bwSingle !== undefined ? data.bwSingle : (i.bwSingle ?? i.bw_single ?? 0))) || 0
          const doubleB = Number(data.bw_double !== undefined ? data.bw_double : (data.bwDouble !== undefined ? data.bwDouble : (i.bwDouble ?? i.bw_double ?? 0))) || 0
          const sp = Number(data.selling_price !== undefined ? data.selling_price : (data.sellingPrice !== undefined ? data.sellingPrice : (i.sellingPrice ?? i.selling_price ?? 0))) || 0
          const stock = data.stock !== undefined ? Number(data.stock) : Number(i.stock || 0)
          const lowStock = Number(data.low_stock_alert !== undefined ? data.low_stock_alert : (data.lowStockAlert !== undefined ? data.lowStockAlert : (i.lowStockAlert ?? i.low_stock_alert ?? 50))) || 50

          return {
            ...i,
            ...data,
            colorSingle: singleC,
            color_single: singleC,
            colorDouble: doubleC,
            color_double: doubleC,
            bwSingle: singleB,
            bw_single: singleB,
            bwDouble: doubleB,
            bw_double: doubleB,
            sellingPrice: sp,
            selling_price: sp,
            stock: isNaN(stock) ? 0 : stock,
            lowStockAlert: lowStock,
            low_stock_alert: lowStock,
          }
        })
      )

      return { previousItems, userInventoryKey }
    },
    onSuccess: (serverData, variables) => {
      const userInventoryKey = [...INVENTORY_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueryData(userInventoryKey, (old = []) =>
          Array.isArray(old)
            ? old.map((i) => (i.id === variables.id ? { ...serverData, isOptimistic: false } : i))
            : old
        )
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousItems && context?.userInventoryKey) {
        queryClient.setQueryData(context.userInventoryKey, context.previousItems)
      }
    },
    onSettled: () => {
      // Handled via optimistic and onSuccess update
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
      // Handled optimistically
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
    staleTime: 1000 * 60 * 5, // 5 minutes
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
    onSuccess: (serverData, variables) => {
      const userPurchasesKey = [...PURCHASES_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueryData(userPurchasesKey, (old = []) =>
          Array.isArray(old)
            ? old.map((p) =>
                p.isOptimistic && (p.id === variables.id || p.item_name === variables.item_name)
                  ? { ...serverData, isOptimistic: false }
                  : p
              )
            : old
        )
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousPurchases && context?.userPurchasesKey) {
        queryClient.setQueryData(context.userPurchasesKey, context.previousPurchases)
      }
    },
    onSettled: () => {
      // Optimistic cache update handles this
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
    onSuccess: (serverData, variables) => {
      const userPurchasesKey = [...PURCHASES_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueryData(userPurchasesKey, (old = []) =>
          Array.isArray(old)
            ? old.map((p) => (p.id === variables.id ? { ...serverData, isOptimistic: false } : p))
            : old
        )
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousPurchases && context?.userPurchasesKey) {
        queryClient.setQueryData(context.userPurchasesKey, context.previousPurchases)
      }
    },
    onSettled: () => {
      // Handled via optimistic update
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
      // Handled optimistically
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
    staleTime: 1000 * 60 * 10, // 10 minutes
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
    staleTime: 1000 * 60 * 10, // 10 minutes
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
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        queryClient.invalidateQueries({ queryKey: ['profile'] })
      }, 1500)
    },
  })

  const deleteAdvance = useMutation({
    mutationFn: async (id) => {
      await advancePaymentsApi.deleteAdvancePayment(id)
      return id
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        queryClient.invalidateQueries({ queryKey: ['profile'] })
      }, 1500)
    },
  })

  return {
    addAdvancePayment: createAdvance.mutateAsync,
    deleteAdvancePayment: deleteAdvance.mutateAsync,
    isAddingAdvance: createAdvance.isPending,
    isDeletingAdvance: deleteAdvance.isPending,
  }
}

