// app/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, ShoppingCart, TrendingUp, Clock, UserCheck } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's what's happening with your business today.
        </p>
      </div>

      {/* KPI Cards - Horizontal Flex Row */}
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[220px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$48,392</div>
            <p className="text-xs text-emerald-600 mt-1">+12.4% from last month</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[220px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,284</div>
            <p className="text-xs text-blue-600 mt-1">+87 this week</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[220px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">342</div>
            <p className="text-xs text-amber-600 mt-1">+23 today</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-[220px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">18.7%</div>
            <p className="text-xs text-purple-600 mt-1">This month</p>
          </CardContent>
        </Card>
      </div>
        
<br />
      {/* Recent Orders & Top Customers - Side by Side (Flex Row) */}
     
        
        {/* Recent Orders - 50% width on desktop */}
        <div className="flex flex-row gap-6"> 
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Orders
            </CardTitle>
            <CardDescription>Last 5 orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b last:border-0">
                <div>
                  <p className="font-medium">Order #{1000 + i}</p>
                  <p className="text-sm text-muted-foreground">Customer {i} • 2 hours ago</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">₹2,89{i}</p>
                  <p className="text-xs text-emerald-600">Completed</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top 5 Customers - 50% width on desktop */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Top 5 Customers
            </CardTitle>
            <CardDescription>By spending this month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { rank: 1, name: "Rahul Sharma", spent: "₹48,250", orders: 12 },
              { rank: 2, name: "Priya Patel", spent: "₹35,780", orders: 9 },
              { rank: 3, name: "Amit Kumar", spent: "₹29,450", orders: 7 },
              { rank: 4, name: "Sneha Gupta", spent: "₹24,900", orders: 8 },
              { rank: 5, name: "Vikram Singh", spent: "₹21,650", orders: 5 },
            ].map((customer) => (
              <div key={customer.rank} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
                    {customer.rank}
                  </div>
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.orders} orders</p>
                  </div>
                </div>
                <div className="font-semibold">{customer.spent}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        </div>
      </div>
    
  );
}