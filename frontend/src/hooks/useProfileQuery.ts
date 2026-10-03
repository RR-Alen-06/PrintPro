import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as profileApi from '../api/profile'
import { useAppContext } from '../context/AppContext'

export const PROFILE_QUERY_KEY = ['business_profile']

export function useProfile() {
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  return useQuery({
    queryKey: [...PROFILE_QUERY_KEY, userId],
    queryFn: async () => {
      const res = await profileApi.getProfile()
      return res.data?.data || {}
    },
    enabled: !!userId,
  })
}

export function useProfileMutations() {
  const queryClient = useQueryClient()
  const { currentUser } = useAppContext()
  const userId = currentUser?.id

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const res = await profileApi.updateProfile(profileData)
      return res.data?.data
    },
    onMutate: async (newProfile: any) => {
      const userProfileKey = [...PROFILE_QUERY_KEY, userId]
      await queryClient.cancelQueries({ queryKey: userProfileKey })
      const previousProfile = (queryClient.getQueryData<any>(userProfileKey) || {}) as any

      queryClient.setQueryData(userProfileKey, (old: any = {}) => ({
        ...old,
        ...newProfile,
      }))

      return { previousProfile, userProfileKey }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousProfile && context?.userProfileKey) {
        queryClient.setQueryData(context.userProfileKey, context.previousProfile)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY })
    },
  })

  return {
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
  }
}
