// hooks/use-customer.ts
import { useQuery } from "@tanstack/react-query";
import { customerApi } from "@/lib/api/customer";

export function useCustomerDetail(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["customer", userId],
    queryFn: () => customerApi.getCustomerByUserId(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });
}