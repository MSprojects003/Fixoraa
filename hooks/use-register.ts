// hooks/use-register.ts
import { useMutation } from '@tanstack/react-query'
import { registerUser } from '@/app/actions/auth'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function useRegister() {
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: any) => {
      // Call server action directly
      const result = await registerUser(data)
      return result
    },
    onSuccess: (data) => {
      console.log("Registration response:", data)
      
      if (data && typeof data === 'object') {
        if (data.error) {
          toast.error(data.error)
        } else if (data.success) {
          toast.success(data.message || 'Account created successfully!')
          setTimeout(() => {
            router.push('/auth/login')
          }, 2000)
        } else {
          toast.error('Registration failed. Please try again.')
        }
      } else {
        toast.success('Account created successfully!')
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      }
    },
    onError: (error: any) => {
      console.error("Mutation error:", error)
      // Check if the error contains the success response
      if (error?.message?.includes('success')) {
        toast.success('Account created successfully!')
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      } else {
        toast.error(error?.message || 'Registration failed')
      }
    },
  })
}