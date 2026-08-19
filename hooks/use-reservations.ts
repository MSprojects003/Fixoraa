// hooks/use-reservations.ts

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchReservations,
  updateReservationStatus,
  acceptReservation,
  rejectReservation,
  setFinalVendorTotalAmount,
  toReservationRow,
  type AcceptReservationPayload,
  type ReservationFilters,
  type ReservationRow,
  type ReservationStatus,
} from "@/lib/api/reservations";

const RESERVATIONS_KEY = "reservations" as const;

export function useReservations(filters: ReservationFilters = {}) {
  const { search, status = "all", vendorId } = filters;

  const query = useQuery({
    queryKey: [RESERVATIONS_KEY, { status, vendorId }],
    queryFn: () => fetchReservations({ status, vendorId }),
    enabled: vendorId !== null,
    staleTime: 30_000,
  });

  const rows: ReservationRow[] = useMemo(() => {
    const mapped = (query.data ?? []).map(toReservationRow);

    if (!search?.trim()) return mapped;

    const q = search.trim().toLowerCase();
    return mapped.filter(
      (r) =>
        r.reservationNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.serviceName.toLowerCase().includes(q)
    );
  }, [query.data, search]);

  return {
    ...query,
    reservations: query.data ?? [],
    rows,
  };
}

export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      cancellationReason,
    }: {
      id: string;
      status: ReservationStatus;
      cancellationReason?: string;
    }) => updateReservationStatus(id, status, cancellationReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESERVATIONS_KEY] });
    },
  });
}

export function useAcceptReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & AcceptReservationPayload) =>
      acceptReservation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESERVATIONS_KEY] });
    },
  });
}

export function useRejectReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      cancellationReason,
    }: {
      id: string;
      cancellationReason: string;
    }) => rejectReservation(id, cancellationReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESERVATIONS_KEY] });
    },
  });
}

export function useSetFinalVendorTotal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      setFinalVendorTotalAmount(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESERVATIONS_KEY] });
    },
  });
}