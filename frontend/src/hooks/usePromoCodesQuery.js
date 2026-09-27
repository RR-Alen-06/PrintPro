import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as promoApi from '../api/promoCodes'
import { useAppContext } from '../context/AppContext'

export const PROMO_CODES_QUERY_KEY = ['promo-codes']

export function usePromoCodes() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const query = useQuery({
    queryKey: [...PROMO_CODES_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await promoApi.getPromoCodes()
      return res.data?.data || []
    },
    enabled: !!userId,
  })

  return {
    ...query,
    promoCodes: query.data || [],
    data: query.data || [],
  }
}

export function usePromoCodeMutations() {
  const queryClient = useQueryClient()
  const { currentUser, setPromoCodes: contextSetPromoCodes } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const syncLocal = () => {
    if (contextSetPromoCodes) {
      const cached = queryClient.getQueryData([...PROMO_CODES_QUERY_KEY, userId])
      if (Array.isArray(cached)) contextSetPromoCodes(cached)
    }
  }

  const createPromoMutation = useMutation({
    mutationFn: async (promoData) => {
      const res = await promoApi.createPromoCode(promoData)
      return res.data?.data
    },
    onSuccess: (newItem) => {
      const userPromoKey = [...PROMO_CODES_QUERY_KEY, userId]
      queryClient.setQueryData(userPromoKey, (old = []) => [newItem, ...(Array.isArray(old) ? old : [])])
      syncLocal()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROMO_CODES_QUERY_KEY })
    },
  })

  const updatePromoMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await promoApi.updatePromoCode(id, data)
      return res.data?.data
    },
    onSuccess: (updated) => {
      const userPromoKey = [...PROMO_CODES_QUERY_KEY, userId]
      queryClient.setQueryData(userPromoKey, (old = []) =>
        Array.isArray(old) ? old.map((p) => (p.id === updated.id || p.code === updated.code ? updated : p)) : [updated]
      )
      syncLocal()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROMO_CODES_QUERY_KEY })
    },
  })

  const deletePromoMutation = useMutation({
    mutationFn: async (id) => {
      const res = await promoApi.deletePromoCode(id)
      return { id, res }
    },
    onSuccess: ({ id }) => {
      const userPromoKey = [...PROMO_CODES_QUERY_KEY, userId]
      queryClient.setQueryData(userPromoKey, (old = []) =>
        Array.isArray(old) ? old.filter((p) => p.id !== id && p.code !== id) : []
      )
      syncLocal()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROMO_CODES_QUERY_KEY })
    },
  })

  return {
    createPromoCode: createPromoMutation.mutateAsync,
    isCreatingPromo: createPromoMutation.isPending,
    updatePromoCode: updatePromoMutation.mutateAsync,
    isUpdatingPromo: updatePromoMutation.isPending,
    deletePromoCode: deletePromoMutation.mutateAsync,
    isDeletingPromo: deletePromoMutation.isPending,
  }
}
