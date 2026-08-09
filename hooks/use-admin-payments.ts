// hooks/use-admin-payments.ts

import { useQuery } from '@tanstack/react-query';
import {
  fetchAdminPayments,
  toAdminPaymentRow,
  type AdminPaymentRow,
  type PaymentTypeFilter,
} from '@/lib/api/admin-payments';

const ADMIN_PAYMENTS_KEY = 'admin-payments' as const;

export function useAdminPayments(type: PaymentTypeFilter = 'all') {
  const query = useQuery({
    queryKey: [ADMIN_PAYMENTS_KEY, { type }],
    queryFn: () => fetchAdminPayments(type),
    staleTime: 30_000,
  });

  const rows: AdminPaymentRow[] = (query.data ?? []).map(toAdminPaymentRow);

  return {
    ...query,
    payments: query.data ?? [],
    rows,
  };
}