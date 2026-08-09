// app/reports/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, TrendingUp } from "lucide-react";

const reports = [
  { id: 1, name: "Monthly Sales Report", date: "March 2024", type: "Sales", size: "2.4 MB" },
  { id: 2, name: "Customer Acquisition", date: "February 2024", type: "Analytics", size: "1.8 MB" },
  { id: 3, name: "Revenue Summary Q1", date: "January 2024", type: "Financial", size: "3.1 MB" },
  { id: 4, name: "User Engagement Metrics", date: "December 2023", type: "Analytics", size: "1.2 MB" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Access and download your business reports.</p>
        </div>
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground">Generated this year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">March 2024</div>
            <p className="text-xs text-muted-foreground">Monthly Sales Report</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.5 MB</div>
            <p className="text-xs text-muted-foreground">Across all reports</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
          <CardDescription>Download your generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {report.type === "Sales" ? <TrendingUp className="h-5 w-5 text-primary" /> : <Calendar className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{report.date}</span>
                      <span>{report.type}</span>
                      <span>{report.size}</span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}