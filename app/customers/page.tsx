// app/customers/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, MoreHorizontal, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const customers = [
  { id: 1, name: "John Doe", email: "john@example.com", phone: "+1 234 567 890", initials: "JD", status: "Active", totalSpent: "$1,234" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", phone: "+1 234 567 891", initials: "JS", status: "Active", totalSpent: "$2,456" },
  { id: 3, name: "Robert Johnson", email: "robert@example.com", phone: "+1 234 567 892", initials: "RJ", status: "Inactive", totalSpent: "$567" },
  { id: 4, name: "Emily Davis", email: "emily@example.com", phone: "+1 234 567 893", initials: "ED", status: "Active", totalSpent: "$3,789" },
  { id: 5, name: "Michael Brown", email: "michael@example.com", phone: "+1 234 567 894", initials: "MB", status: "Active", totalSpent: "$890" },
];

export default function CustomersPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer relationships and view their details.</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>A list of all customers registered in your system. Total: {customers.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {customers.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback className={customer.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                      {customer.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {customer.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{customer.totalSpent}</p>
                    <p className="text-xs text-muted-foreground">Total spent</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    customer.status === 'Active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {customer.status}
                  </span>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}