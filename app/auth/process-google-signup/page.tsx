// app/auth/process-google-signup/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { handleGoogleSignUp } from "@/app/actions/auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProcessGoogleSignup() {
  const router = useRouter();
  const [status, setStatus] = useState("Processing your Google account...");

  useEffect(() => {
    const processSignup = async () => {
      try {
        // Get vendor data from session storage
        const vendorDataStr = sessionStorage.getItem('tempVendorData');
        
        if (!vendorDataStr) {
          toast.error("No vendor data found. Please try again.");
          router.push('/auth/register');
          return;
        }

        const vendorData = JSON.parse(vendorDataStr);
        
        setStatus("Creating your account...");
        
        // Call the server action to save data
        const result = await handleGoogleSignUp(vendorData);
        
        if (result.success) {
          setStatus("Account created! Redirecting to dashboard...");
          toast.success("Account created successfully!");
          
          // Clear temp data
          sessionStorage.removeItem('tempVendorData');
          
          setTimeout(() => {
            router.push('/');
          }, 1500);
        } else {
          toast.error(result.error || "Failed to create account");
          router.push('/auth/register');
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Something went wrong");
        router.push('/auth/register');
      }
    };

    processSignup();
  }, [router]);

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      background: "#f0f0f0",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif"
    }}>
      <div style={{ textAlign: "center", background: "#fff", padding: "48px", borderRadius: "22px", boxShadow: "0 24px 80px rgba(0,0,0,0.14)" }}>
        <Loader2 className="h-12 w-12 animate-spin text-gray-600 mx-auto" />
        <h2 style={{ marginTop: "20px", fontSize: "18px", color: "#333" }}>{status}</h2>
        <p style={{ marginTop: "10px", fontSize: "13px", color: "#888" }}>Please wait while we set up your account...</p>
      </div>
    </div>
  );
}