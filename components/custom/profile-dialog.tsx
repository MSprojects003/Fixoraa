// components/custom/user-menu-card.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LogOut, Sparkles, User, CreditCard, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

interface UserMenuCardProps {
  onNavigate?: (path: string) => void;
  onSignOut?: () => void;
  user?: {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    profile_image?: string | null;
  };
  vendor?: {
    vendor_name?: string | null;
  };
}


export function UserMenuCard({ onNavigate, onSignOut, user, vendor }: UserMenuCardProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const supabase = createClient();

  const menuItems = [
    { label: "Account", path: "/account", icon: User },
    { label: "Billing", path: "/billing", icon: CreditCard },
    { label: "Notifications", path: "/notifications", icon: Bell },
  ];

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Sign out error:", error);
        toast.error("Failed to sign out. Please try again.");
        setIsLoggingOut(false);
        return;
      }
      
      // Clear all storage
      localStorage.clear();
      sessionStorage.clear();
      
      toast.success("Signed out successfully!");
      
      if (onSignOut) {
        onSignOut();
      }
      
      // Use window.location.href for full page refresh to clear all state
      window.location.href = "/auth/login";
      
    } catch (error) {
      console.error("Unexpected error during sign out:", error);
      toast.error("An error occurred while signing out.");
      setIsLoggingOut(false);
    }
  };

  // Get display name with proper fallbacks
  const getDisplayName = () => {
    if (vendor?.vendor_name && vendor.vendor_name.trim() !== "") {
      return vendor.vendor_name;
    }
    if (user?.first_name && user?.last_name) {
      return `${user.first_name} ${user.last_name}`.trim();
    }
    if (user?.first_name) {
      return user.first_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return "User";
  };

  // Get avatar initials
  const getInitials = () => {
    if (vendor?.vendor_name && vendor.vendor_name.trim() !== "") {
      // Get first 2 letters of vendor name
      const name = vendor.vendor_name.trim();
      if (name.length >= 2) {
        return name.substring(0, 2).toUpperCase();
      }
      return name.charAt(0).toUpperCase();
    }
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    }
    if (user?.first_name) {
      return user.first_name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const displayName = getDisplayName();
  const displayEmail = user?.email || "No email provided";
  const initials = getInitials();

  return (
    <Card className="w-72 border border-border/50 shadow-sm rounded-xl overflow-hidden bg-background">
      {/* User Info Section */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary/10">
            <AvatarImage src={user?.profile_image || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate mt-1">{displayEmail}</p>
          </div>
        </div>
      </div>

      {/* Upgrade to Pro Button */}
      <div className="px-4 py-3">
        <Button 
          variant="default" 
          size="sm" 
          className="w-full font-medium"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Upgrade to Pro
        </Button>
      </div>

      <Separator />

      {/* Menu Items */}
      <div className="py-1">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              if (onNavigate) {
                onNavigate(item.path);
              } else {
                router.push(item.path);
              }
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors duration-200"
          >
            <span>{item.label}</span>
            {item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
          </button>
        ))}
      </div>

      <Separator />

      {/* Log Out Button */}
      <div className="p-2">
        <button
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? (
            <>
              <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              <span>Signing out...</span>
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </>
          )}
        </button>
      </div>
    </Card>
  );
}
