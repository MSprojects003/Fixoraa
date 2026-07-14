import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export function useOrderPaymentCallback() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const currentOrderId = window.location.pathname.split('/').pop();

    if (!paymentStatus || !currentOrderId) return;

    if (paymentStatus === 'cancelled') {
      toast.info('Payment cancelled');
      return;
    }

    if (paymentStatus === 'success') {
      handlePaymentSuccess(currentOrderId);
    }
  }, [searchParams]);

  async function handlePaymentSuccess(orderId: string) {
    try {
      const storedData = localStorage.getItem('payhere_order_acceptance');
      const paymentData = storedData ? JSON.parse(storedData) : null;

      if (!paymentData || paymentData.orderId !== orderId) {
        console.warn('[order-payment] No stored payment data found');
        toast.info('Payment completed. Updating order...');
      }

      console.log('[order-payment] Payment successful, processing order acceptance');

      // Call webhook endpoint to complete order acceptance
      const response = await fetch(`/api/payment/order-notify?order_id=${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentData,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[order-payment] Order accepted successfully:', result);
        toast.success('Order accepted and payment recorded');
        localStorage.removeItem('payhere_order_acceptance');
        // Refresh page to show updated order
        setTimeout(() => window.location.reload(), 1000);
      } else {
        console.error('[order-payment] Failed to accept order:', result);
        toast.info('Payment confirmed. Please refresh to see changes.');
      }
    } catch (error) {
      console.error('[order-payment] Error processing payment:', error);
      toast.info('Payment completed. Please refresh the page.');
    }
  }

  return null;
}
