import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as settingsApi from '../api/settings'
import { useAppContext } from '../context/AppContext'

export const SETTINGS_QUERY_KEY = ['settings']

export const DEFAULT_SETTINGS = {
  gstRate: 0,
  theme: 'dark',
  currency: '₹',
  invoicePrefix: 'INV',
  customerPrefix: 'CUS',
  inventoryPrefix: 'ITM',
  receiptSize: 'thermal',
  autoBackup: false,
  viewMode: 'monthly',
  refundsEnabled: true,
  fyInvoicePrefixing: false,
  staffPermissions: {
    staffCanDiscount: true,
    staffCanDelete: false,
    staffCanExport: false,
    staffCanSettings: false,
  },
  loyaltyEnabled: true,
  loyaltyEarningRate: 30,
  loyaltyRedeemRatioPoints: 150,
  loyaltyRedeemRatioRupees: 5,
  loyaltyRedeemOptions: [
    { points: 100, rupees: 2.5 },
    { points: 120, rupees: 3 },
    { points: 150, rupees: 5 },
  ],
  loyaltyTiers: [
    { from: 1, to: 40, points: 1 },
    { from: 41, to: 100, points: 2 },
  ],
  primaryColor: '#0f172a',
  logoUrl: '',
  headerNotes: '',
  footerNotes: '',
  showGstBreakdown: true,
  showUpiQrCode: true,
  silentThermalPrint: false,
}

export function useSettings() {
  const { currentUser, settings: contextSettings } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const query = useQuery({
    queryKey: [...SETTINGS_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await settingsApi.getSettings()
      return res.data?.data || {}
    },
    enabled: !!userId,
  })

  const rawData = query.data
  const mergedSettings = useMemo(() => {
    const raw = rawData || {}
    return {
      ...DEFAULT_SETTINGS,
      ...(contextSettings || {}),
      ...raw,
      staffPermissions: {
        ...DEFAULT_SETTINGS.staffPermissions,
        ...(contextSettings?.staffPermissions || {}),
        ...(raw.staffPermissions || {}),
      },
    }
  }, [contextSettings, rawData])

  return {
    ...query,
    settings: mergedSettings,
    data: mergedSettings,
  }
}

export function useSettingsMutations() {
  const queryClient = useQueryClient()
  const { currentUser, updateSettings: contextUpdateSettings } = useAppContext()
  const userId = currentUser?.id || 'anonymous'

  const updateSettingsMutation = useMutation({
    mutationFn: async (settingsData: any) => {
      const res = await settingsApi.updateSettings(settingsData)
      return res.data?.data
    },
    onMutate: async (newSettings: any) => {
      const userSettingsKey = [...SETTINGS_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userSettingsKey })
      const previousSettings = queryClient.getQueryData(userSettingsKey) || {}

      queryClient.setQueryData(userSettingsKey, (old: any = {}) => ({
        ...old,
        ...newSettings,
      }))

      // Keep AppContext in sync for backwards compatibility
      if (contextUpdateSettings) {
        contextUpdateSettings(newSettings)
      }

      return { previousSettings, userSettingsKey }
    },
    onError: (err: any, variables: any, context: any) => {
      if (context?.previousSettings && context?.userSettingsKey) {
        queryClient.setQueryData(context.userSettingsKey, context.previousSettings)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
    },
  })

  return {
    updateSettings: updateSettingsMutation.mutateAsync,
    isUpdatingSettings: updateSettingsMutation.isPending,
  }
}
