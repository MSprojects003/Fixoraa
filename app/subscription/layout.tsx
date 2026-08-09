// app/subscription/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscription Plans',
  description: 'Choose the best plan for your business',
};

export default function SubscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {children}
    </div>
  );
}