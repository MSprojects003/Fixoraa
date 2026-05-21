// components/custom/auth-guard.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/custom/app-sidebar";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

const AUTH_PAGES = [
  "/auth/login",
  "/auth/register",
  "/auth/process-google-signup",
] as const;

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowSidebar, setShouldShowSidebar] = useState(false);
  const hasRedirected = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const isAuthPage = AUTH_PAGES.some((p) => pathname === p);

      if (isAuthPage) {
        hasRedirected.current = false;
        setShouldShowSidebar(false);
        setIsLoading(false);
        return;
      }

      if (hasRedirected.current) return;

      setIsLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!user || userError) {
          hasRedirected.current = true;
          router.replace("/auth/login");
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        const { data: vendorData } = await supabase
          .from("vendors")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        // Complete profile: missing user row and/or vendor row
        if (!userData || !vendorData) {
          hasRedirected.current = true;

          const fullName =
            user.user_metadata?.full_name || user.user_metadata?.name || "";
          const metaFirst = fullName.split(" ")[0] || "";
          const metaLast = fullName.split(" ").slice(1).join(" ") || "";
          const firstName = userData?.first_name || metaFirst;
          const lastName = userData?.last_name || metaLast;
          const email = userData?.email || user.email || "";

          if (!userData) {
            await supabase.from("users").insert({
              id: user.id,
              first_name: firstName,
              last_name: lastName,
              email,
              phone: null,
              is_vendor: false,
              is_customer: false,
              is_deleted: false,
              profile_image: user.user_metadata?.avatar_url || null,
            });
          }

          const params = new URLSearchParams({
            google_signup: "true",
            email,
            firstName,
            lastName,
          });
          if (userData && !vendorData) {
            params.set("complete_vendor", "true");
          }

          router.replace(`/auth/register?${params.toString()}`);
          return;
        }

        hasRedirected.current = false;
        setShouldShowSidebar(true);
        setIsLoading(false);
      } catch {
        hasRedirected.current = true;
        router.replace("/auth/login");
      }
    };

    checkAuth();
  }, [pathname, router, supabase]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (shouldShowSidebar) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 overflow-auto bg-muted/10">{children}</main>
        </div>
      </SidebarProvider>
    );
  }

  return <>{children}</>;
}
