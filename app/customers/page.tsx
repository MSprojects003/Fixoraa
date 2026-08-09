// app/customers/page.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchAllCustomers } from '@/lib/api/customer';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function CustomersPage() {
  const customers = await fetchAllCustomers();

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          View all registered customer details.
        </p>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            Total: {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No customers found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.firstName ?? '—'}
                    </TableCell>
                    <TableCell>{customer.lastName ?? '—'}</TableCell>
                    <TableCell>{customer.city ?? '—'}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {customer.address ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(customer.joinedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
