"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  Clock,
  UserCheck,
  BarChart3,
  LineChart as LineChartIcon,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { fetchCustomersForDashboard, type DashboardCustomer } from "@/lib/api/customer";
import { fetchOrders, formatCurrency, type OrderRow } from "@/lib/api/orders";
import { fetchReservations, type ReservationWithRelations } from "@/lib/api/reservations";

type DashboardSummary = {
  revenue: number;
  activeCustomers: number;
  totalOrders: number;
  growthRate: number;
  serviceAnalysisData: Array<{ service: string; bookings: number }>;
  ordersAnalysisData: Array<{ day: string; orders: number; completed: number }>;
  customerAnalysisData: Array<{ day: string; newCustomers: number; returning: number }>;
  recentOrders: Array<{
    id: string;
    orderNo: string;
    customerName: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  topCustomers: Array<{ name: string; spent: number; orders: number }>;
};

function formatCustomerName(customer: ReservationWithRelations["customer"] | null | undefined) {
  if (!customer) return "Unknown customer";
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email || "Unknown customer";
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildServiceAnalysisData(reservations: ReservationWithRelations[]) {
  const grouped = reservations.reduce<Record<string, number>>((acc, reservation) => {
    const category = reservation.service?.category || "Uncategorized";
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([service, bookings]) => ({ service, bookings }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 6);
}

function buildOrdersAnalysisData(orders: OrderRow[]) {
  const today = new Date();

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    const key = getDayKey(date);

    const dayOrders = orders.filter((order) => order.orderDate.startsWith(key));
    const completed = dayOrders.filter((order) => ["delivered", "completed"].includes(order.status)).length;

    return {
      day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      orders: dayOrders.length,
      completed,
    };
  });
}

function buildCustomerAnalysisData(customers: DashboardCustomer[], orders: OrderRow[], reservations: ReservationWithRelations[]) {
  const activeCustomerNames = new Set<string>();
  orders.forEach((order) => activeCustomerNames.add(order.customerName));
  reservations.forEach((reservation) => activeCustomerNames.add(formatCustomerName(reservation.customer)));

  const today = new Date();

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));

    const newCustomers = customers.filter((customer) => {
      const createdAt = new Date(customer.createdAt);
      return createdAt.toDateString() === date.toDateString();
    }).length;

    const returning = customers.filter((customer) => {
      const createdAt = new Date(customer.createdAt);
      return createdAt <= date && activeCustomerNames.has(customer.name);
    }).length;

    return {
      day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      newCustomers,
      returning: Math.max(0, returning - newCustomers),
    };
  });
}

function buildRecentOrders(orders: OrderRow[]) {
  return orders.slice(0, 5).map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    amount: order.totalAmount,
    status: order.status,
    createdAt: order.orderDate,
  }));
}

function buildTopCustomers(orders: OrderRow[], reservations: ReservationWithRelations[], customers: DashboardCustomer[]) {
  const totals = new Map<string, { name: string; spent: number; orders: number }>();

  customers.forEach((customer) => {
    totals.set(customer.name, { name: customer.name, spent: 0, orders: 0 });
  });

  orders.forEach((order) => {
    const current = totals.get(order.customerName) ?? { name: order.customerName, spent: 0, orders: 0 };
    current.spent += order.totalAmount;
    current.orders += 1;
    totals.set(order.customerName, current);
  });

  reservations.forEach((reservation) => {
    const name = formatCustomerName(reservation.customer);
    const current = totals.get(name) ?? { name, spent: 0, orders: 0 };
    current.spent += Number(reservation.total_amount || 0);
    current.orders += 1;
    totals.set(name, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.spent - a.spent).slice(0, 5);
}

function getGrowthRate(orders: OrderRow[], reservations: ReservationWithRelations[]) {
  const currentMonth = getMonthKey(new Date());
  const previousMonthDate = new Date();
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = getMonthKey(previousMonthDate);

  const currentRevenue = orders.reduce((total, order) => {
    const month = getMonthKey(new Date(order.orderDate));
    return month === currentMonth ? total + order.totalAmount : total;
  }, 0) + reservations.reduce((total, reservation) => {
    const month = getMonthKey(new Date(reservation.created_at));
    return month === currentMonth ? total + Number(reservation.total_amount || 0) : total;
  }, 0);

  const previousRevenue = orders.reduce((total, order) => {
    const month = getMonthKey(new Date(order.orderDate));
    return month === previousMonth ? total + order.totalAmount : total;
  }, 0) + reservations.reduce((total, reservation) => {
    const month = getMonthKey(new Date(reservation.created_at));
    return month === previousMonth ? total + Number(reservation.total_amount || 0) : total;
  }, 0);

  if (!previousRevenue) return 0;
  return Number((((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1));
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [orders, reservations, customers] = await Promise.all([
          fetchOrders(),
          fetchReservations(),
          fetchCustomersForDashboard(),
        ]);

        if (!isMounted) return;

        const revenue = orders.reduce((sum, order) => sum + order.totalAmount, 0) + reservations.reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);

        setDashboardData({
          revenue,
          activeCustomers: customers.length,
          totalOrders: orders.length,
          growthRate: getGrowthRate(orders, reservations),
          serviceAnalysisData: buildServiceAnalysisData(reservations),
          ordersAnalysisData: buildOrdersAnalysisData(orders),
          customerAnalysisData: buildCustomerAnalysisData(customers, orders, reservations),
          recentOrders: buildRecentOrders(orders),
          topCustomers: buildTopCustomers(orders, reservations, customers),
        });
      } catch (error) {
        console.error("Dashboard data load failed", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || !dashboardData) {
    return (
      <div className="space-y-8 p-6 md:p-8">
        <div className="text-sm text-muted-foreground">Loading dashboard data…</div>
      </div>
    );
  }

  const { revenue, activeCustomers, totalOrders, growthRate, serviceAnalysisData, ordersAnalysisData, customerAnalysisData, recentOrders, topCustomers } = dashboardData;

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's what's happening with your business today.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-55">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(revenue)}</div>
            <p className="text-xs text-emerald-600 mt-1">Based on current orders and reservations</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-55">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCustomers}</div>
            <p className="text-xs text-blue-600 mt-1">Customers from your database</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-55">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalOrders}</div>
            <p className="text-xs text-amber-600 mt-1">Product orders in the system</p>
          </CardContent>
        </Card>

        <Card className="flex-1 min-w-55">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{growthRate}%</div>
            <p className="text-xs text-purple-600 mt-1">Compared with previous month</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Service Analysis
            </CardTitle>
            <CardDescription>Bookings by service category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceAnalysisData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="service" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="bookings" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-amber-600" />
              Orders Analysis
            </CardTitle>
            <CardDescription>Orders placed vs completed (last 14 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ordersAnalysisData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="orders" stroke="#d97706" strokeWidth={2} dot={false} name="Orders" />
                  <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2} dot={false} name="Completed" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Customer Analysis
          </CardTitle>
          <CardDescription>New vs returning customers (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={customerAnalysisData}>
                <defs>
                  <linearGradient id="newCustomersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="returningGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="newCustomers" name="New Customers" stroke="#7c3aed" fill="url(#newCustomersGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="returning" name="Returning Customers" stroke="#2563eb" fill="url(#returningGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Orders
            </CardTitle>
            <CardDescription>Latest orders from your database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent orders found.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex justify-between items-center py-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{order.orderNo}</p>
                    <p className="text-sm text-muted-foreground">{order.customerName} • {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(order.amount)}</p>
                    <p className="text-xs text-emerald-600">{order.status}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Top 5 Customers
            </CardTitle>
            <CardDescription>By spending across orders and reservations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customer activity found yet.</p>
            ) : (
              topCustomers.map((customer, index) => (
                <div key={`${customer.name}-${index}`} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.orders} activities</p>
                    </div>
                  </div>
                  <div className="font-semibold">{formatCurrency(customer.spent)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
