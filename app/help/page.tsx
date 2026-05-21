// app/help/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, MessageCircle, FileQuestion, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const faqs = [
  { question: "How do I create a new customer?", answer: "Navigate to Customers page and click 'Add Customer' button." },
  { question: "How can I generate reports?", answer: "Go to Reports page and click 'Generate Report'." },
  { question: "How do I update my profile?", answer: "Visit Settings page to update your information." },
  { question: "How to reset my password?", answer: "Use the 'Change Password' option in Settings > Security." },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">Find answers, get support, and learn more about our platform.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search for help articles..." className="pl-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="text-center">
            <BookOpen className="mx-auto h-8 w-8 text-primary" />
            <CardTitle>Documentation</CardTitle>
            <CardDescription>Detailed guides and API references</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" className="w-full">Browse Docs</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-primary" />
            <CardTitle>Live Chat</CardTitle>
            <CardDescription>Chat with our support team</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" className="w-full">Start Chat</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-center">
            <Mail className="mx-auto h-8 w-8 text-primary" />
            <CardTitle>Email Support</CardTitle>
            <CardDescription>Get help via email</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" className="w-full">Send Email</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>Quick answers to common questions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b pb-3 last:border-0">
              <div className="flex items-start gap-2">
                <FileQuestion className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <p className="font-medium">{faq.question}</p>
                  <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}