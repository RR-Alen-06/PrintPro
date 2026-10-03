import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as billsApi from '../api/bills'
import * as inventoryApi from '../api/inventory'
import { useAppContext } from '../context/AppContext'

export const BILLS_QUERY_KEY = ['bills']

export function useBills(filters: Record<string, any> = {}) {
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

export function useBill(id?: string) {
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
    mutationFn: async (billData: any) => {
      const res = await billsApi.createBill(billData)
      return res.data?.data
    },
    onMutate: async (newBillData: any) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userBillsKey, exact: false })
      const previousQueries = queryClient.getQueriesData<any[]>({ queryKey: userBillsKey, exact: false })

      const totalPaidDirect = Number(newBillData.amount_paid !== undefined ? newBillData.amount_paid : (newBillData.amountPaid || 0))
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
        amount_paid: totalPaidDirect,
        amountPaid: totalPaidDirect,
        balance: newBillData.balance !== undefined ? newBillData.balance : Math.max(0, (newBillData.total || 0) - totalPaidDirect),
        status: newBillData.status || (totalPaidDirect >= (newBillData.total || 0) ? 'paid' : totalPaidDirect > 0 ? 'partial' : 'unpaid'),
        items: newBillData.items || [],
        isOptimistic: true,
      }

      queryClient.setQueriesData<any[]>({ queryKey: userBillsKey, exact: false }, (old = []) => [
        optimisticBill,
        ...(Array.isArray(old) ? old : []),
      ])

      if (totalPaidDirect > 0) {
        const userPaymentsKey = ['payments', userId]
        const optimisticPayment = {
          id: `temp-pay-${Date.now()}`,
          bill_id: optimisticBill.id,
          billId: optimisticBill.id,
          customer_id: optimisticBill.customer_id,
          customerId: optimisticBill.customerId,
          cash_amount: Number(newBillData.cash_amount || newBillData.cashAmount || 0),
          cashAmount: Number(newBillData.cash_amount || newBillData.cashAmount || 0),
          upi_amount: Number(newBillData.upi_amount || newBillData.upiAmount || 0),
          upiAmount: Number(newBillData.upi_amount || newBillData.upiAmount || 0),
          total_paid: totalPaidDirect,
          totalPaid: totalPaidDirect,
          date: newBillData.date,
          payment_type: optimisticBill.status === 'paid' ? 'full' : 'partial',
          notes: 'POS checkout payment'
        }
        queryClient.setQueriesData<any[]>({ queryKey: userPaymentsKey, exact: false }, (old = []) => [
          optimisticPayment,
          ...(Array.isArray(old) ? old : [])
        ])
      }

      return { previousQueries }
    },
    onSuccess: (serverData: any, variables: any) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueriesData<any[]>(
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
    onError: (_err, _variables, context) => {
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
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const updateBillMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // Find old bill before edit to compute stock difference if items changed
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      const previousQueries = queryClient.getQueriesData<any[]>({ queryKey: userBillsKey, exact: false })
      let oldBill: any = null
      for (const [, billsData] of previousQueries) {
        if (Array.isArray(billsData)) {
          oldBill = billsData.find((b) => String(b.id) === String(id) || String(b.invoice_number) === String(id) || String(b.invoiceNumber) === String(id))
          if (oldBill) break
        }
      }

      const res = await billsApi.updateBill(id, data)

      if (oldBill && Array.isArray(data.items)) {
        try {
          const userInventoryKey = ['inventory', userId]
          const inventoryData = (queryClient.getQueryData<any[]>(userInventoryKey) || []) as any[]
          const productInvItems = inventoryData.filter((i) => i.type === 'product')
          const oldItems = oldBill.items || []
          const newItems = data.items || []
          const adjustments: Promise<any>[] = []

          productInvItems.forEach((invItem) => {
            const oldQty = oldItems
              .filter((item: any) => String(item.itemId || item.id) === String(invItem.id) || item.itemName === invItem.name || item.item_name === invItem.name || item.name === invItem.name)
              .reduce((s: number, it: any) => s + Number(it.qty || it.quantity || 0), 0)
            const newQty = newItems
              .filter((item: any) => String(item.itemId || item.id) === String(invItem.id) || item.itemName === invItem.name || item.item_name === invItem.name || item.name === invItem.name)
              .reduce((s: number, it: any) => s + Number(it.qty || it.quantity || 0), 0)
            const diff = oldQty - newQty
            if (diff !== 0) {
              adjustments.push(inventoryApi.adjustStock(invItem.id, diff))
            }
          })

          if (adjustments.length > 0) {
            await Promise.all(adjustments)
          }
        } catch (stockErr: any) {
          console.warn('Stock adjustment on bill edit notice:', stockErr?.message)
        }
      }

      return res.data?.data
    },
    onMutate: async ({ id, data }: { id: string; data: any }) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userBillsKey, exact: false })
      const previousQueries = queryClient.getQueriesData<any[]>({ queryKey: userBillsKey, exact: false })

      queryClient.setQueriesData<any[]>({ queryKey: userBillsKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.map((b) => (b.id === id ? { ...b, ...data, isOptimistic: true } : b)) : old
      )

      return { previousQueries }
    },
    onSuccess: (serverData: any, variables: { id: string; data: any }) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      if (serverData) {
        queryClient.setQueriesData<any[]>(
          { queryKey: userBillsKey, exact: false },
          (old = []) => Array.isArray(old)
            ? old.map((b) => (b.id === variables.id ? { ...serverData, isOptimistic: false } : b))
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
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const deleteBillMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find bill before deletion to restore stock
      let targetBill: any = null
      const billQueries = queryClient.getQueriesData<any[]>({ queryKey: BILLS_QUERY_KEY, exact: false })
      for (const [, billsData] of billQueries) {
        if (Array.isArray(billsData)) {
          targetBill = billsData.find((b) => String(b.id) === String(id) || String(b.invoice_number) === String(id) || String(b.invoiceNumber) === String(id))
          if (targetBill) break
        }
      }

      await billsApi.deleteBill(id)

      if (targetBill && Array.isArray(targetBill.items)) {
        try {
          let inventoryData = queryClient.getQueryData<any[]>(['inventory', userId])
          if (!Array.isArray(inventoryData) || inventoryData.length === 0) {
            const invQueries = queryClient.getQueriesData<any[]>({ queryKey: ['inventory'], exact: false })
            for (const [, invList] of invQueries) {
              if (Array.isArray(invList) && invList.length > 0) {
                inventoryData = invList
                break
              }
            }
          }
          if (Array.isArray(inventoryData) && inventoryData.length > 0) {
            const stockMap = new Map<string, number>()
            for (const item of targetBill.items) {
              const qty = Number(item.qty || item.quantity || 0)
              if (qty <= 0) continue
              const invItem = inventoryData.find(
                (i) => String(i.id) === String(item.itemId || item.id) || i.name === (item.itemName || item.item_name || item.name)
              )
              if (invItem && invItem.type === 'product') {
                stockMap.set(invItem.id, (stockMap.get(invItem.id) || 0) + qty)
              }
            }
            if (stockMap.size > 0) {
              await Promise.all(
                Array.from(stockMap.entries()).map(([itemId, qty]) => inventoryApi.adjustStock(itemId, qty))
              )
            }
          }
        } catch (stockErr: any) {
          console.warn('Stock restore on bill delete notice:', stockErr?.message)
        }
      }

      return id
    },
    onMutate: async (id: string) => {
      const userBillsKey = [...BILLS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userBillsKey, exact: false })
      const previousQueries = queryClient.getQueriesData<any[]>({ queryKey: userBillsKey, exact: false })

      queryClient.setQueriesData<any[]>({ queryKey: userBillsKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.filter((b) => b.id !== id && b.invoice_number !== id && b.invoiceNumber !== id) : old
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
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const restoreBillMutation = useMutation({
    mutationFn: async (id: string) => {
      let targetBill: any = null
      const deletedQueries = queryClient.getQueriesData<any[]>({ queryKey: [...BILLS_QUERY_KEY, 'deleted'], exact: false })
      for (const [, billsData] of deletedQueries) {
        if (Array.isArray(billsData)) {
          targetBill = billsData.find((b) => String(b.id) === String(id) || String(b.invoice_number) === String(id) || String(b.invoiceNumber) === String(id))
          if (targetBill) break
        }
      }

      await billsApi.restoreBill(id)

      if (targetBill && Array.isArray(targetBill.items)) {
        try {
          let inventoryData = queryClient.getQueryData<any[]>(['inventory', userId])
          if (!Array.isArray(inventoryData) || inventoryData.length === 0) {
            const invQueries = queryClient.getQueriesData<any[]>({ queryKey: ['inventory'], exact: false })
            for (const [, invList] of invQueries) {
              if (Array.isArray(invList) && invList.length > 0) {
                inventoryData = invList
                break
              }
            }
          }
          if (Array.isArray(inventoryData) && inventoryData.length > 0) {
            const stockMap = new Map<string, number>()
            for (const item of targetBill.items) {
              const qty = Number(item.qty || item.quantity || 0)
              if (qty <= 0) continue
              const invItem = inventoryData.find(
                (i) => String(i.id) === String(item.itemId || item.id) || i.name === (item.itemName || item.item_name || item.name)
              )
              if (invItem && invItem.type === 'product') {
                stockMap.set(invItem.id, (stockMap.get(invItem.id) || 0) + qty)
              }
            }
            if (stockMap.size > 0) {
              await Promise.all(
                Array.from(stockMap.entries()).map(([itemId, qty]) => inventoryApi.adjustStock(itemId, -qty))
              )
            }
          }
        } catch (stockErr: any) {
          console.warn('Stock deduction on bill restore notice:', stockErr?.message)
        }
      }

      return id
    },
    onMutate: async (id: string) => {
      const deletedKey = [...BILLS_QUERY_KEY, 'deleted', userId]
      await queryClient.cancelQueries({ queryKey: deletedKey, exact: false })
      const previousDeleted = queryClient.getQueryData(deletedKey)

      queryClient.setQueriesData<any[]>({ queryKey: deletedKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.filter((b) => b.id !== id && b.invoice_number !== id && b.invoiceNumber !== id) : old
      )

      return { previousDeleted }
    },
    onError: (_err, _id, context) => {
      if (context?.previousDeleted) {
        queryClient.setQueryData([...BILLS_QUERY_KEY, 'deleted', userId], context.previousDeleted)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const permanentDeleteBillMutation = useMutation({
    mutationFn: async (id: string) => {
      await billsApi.permanentDeleteBill(id)
      return id
    },
    onMutate: async (id: string) => {
      const deletedKey = [...BILLS_QUERY_KEY, 'deleted', userId]
      await queryClient.cancelQueries({ queryKey: deletedKey, exact: false })
      const previousDeleted = queryClient.getQueryData(deletedKey)

      queryClient.setQueriesData<any[]>({ queryKey: deletedKey, exact: false }, (old = []) =>
        Array.isArray(old) ? old.filter((b) => b.id !== id && b.invoice_number !== id && b.invoiceNumber !== id) : old
      )

      return { previousDeleted }
    },
    onError: (_err, _id, context) => {
      if (context?.previousDeleted) {
        queryClient.setQueryData([...BILLS_QUERY_KEY, 'deleted', userId], context.previousDeleted)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  const purgeAllDeletedBillsMutation = useMutation({
    mutationFn: async () => {
      await billsApi.purgeAllDeletedBills()
      return true
    },
    onMutate: async () => {
      const deletedKey = [...BILLS_QUERY_KEY, 'deleted', userId]
      await queryClient.cancelQueries({ queryKey: deletedKey, exact: false })
      const previousDeleted = queryClient.getQueryData(deletedKey)
      queryClient.setQueriesData<any[]>({ queryKey: deletedKey, exact: false }, () => [])
      return { previousDeleted }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDeleted) {
        queryClient.setQueryData([...BILLS_QUERY_KEY, 'deleted', userId], context.previousDeleted)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
  })

  return {
    createBill: createBillMutation.mutateAsync,
    updateBill: updateBillMutation.mutateAsync,
    deleteBill: deleteBillMutation.mutateAsync,
    restoreBill: restoreBillMutation.mutateAsync,
    permanentDeleteBill: permanentDeleteBillMutation.mutateAsync,
    purgeAllDeletedBills: purgeAllDeletedBillsMutation.mutateAsync,
    isCreatingBill: createBillMutation.isPending,
    isUpdatingBill: updateBillMutation.isPending,
    isDeletingBill: deleteBillMutation.isPending,
    isRestoringBill: restoreBillMutation.isPending,
    isPurgingBill: permanentDeleteBillMutation.isPending || purgeAllDeletedBillsMutation.isPending,
  }
}
