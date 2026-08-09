// components/app-sidebar.tsx (Fixed for Responsive with proper null handling)
"use client";

import {
  LayoutDashboard,
  Users,
  HelpCircle,
  FileText,
  Menu,
  ChevronRight,
  Bell,
  X,
  Crown,
  Gem,
  ShieldCheck,
  Package,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenuCard } from "@/components/custom/user-menu-card";
import logoImage from "@/app/assets/logo/logo.png";
import { useCurrentUser, useVendor } from "@/hooks/use-user";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Reports", href: "/reports", icon: FileText },
  { title: "Help", href: "/help", icon: HelpCircle },
  { title: "My Business", href: "/my-business", icon: Users },
  {title: "Reservations", href: "/reservations", icon: FileText},
  {title:"Orders", href:"/orders", icon:Package},
];

function getPageTitle(pathname: string): string {
  const item = navItems.find(item => item.href === pathname);
  return item?.title || "Dashboard";
}

export function AppSidebar() {
  const pathname = usePathname();
  const { toggleSidebar, state, setOpenMobile, openMobile } = useSidebar();
  const currentPageTitle = getPageTitle(pathname);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { data: vendor, isLoading: isLoadingVendor } = useVendor();

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSignOut = async () => {
    console.log("Signing out...");
    setIsProfileOpen(false);
    // Add your sign out logic here
  };

  const handleNavigation = (path: string) => {
    console.log(`Navigate to: ${path}`);
    setIsProfileOpen(false);
  };

  const handleMobileMenuClose = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Get display name for sidebar footer
  const getDisplayName = () => {
    if (vendor?.vendor_name) {
      return vendor.vendor_name;
    }
    if (currentUser?.first_name && currentUser?.last_name) {
      return `${currentUser.first_name} ${currentUser.last_name}`;
    }
    if (currentUser?.first_name) {
      return currentUser.first_name;
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return "User";
  };

  // Get subscription badge
  const getSubscriptionBadge = () => {
    const hasSubscription = vendor?.has_subscription === true;
    const planType = vendor?.subscription_type?.toLowerCase() || 'basic';

    if (!hasSubscription) {
      return null;
    }

    const planConfig: Record<string, { icon: any; label: string; className: string }> = {
      premium: { 
        icon: Crown, 
        label: 'Premium', 
        className: 'bg-black text-white border-gray-800 text-sm' 
      },
      pro: { 
        icon: Gem, 
        label: 'Pro', 
        className: 'bg-black text-white border-gray-800 text-sm' 
      },
      basic: { 
        icon: ShieldCheck, 
        label: 'Basic', 
        className: ' bg-black text-white border-gray-800 text-sm' 
      },
    };

    const config = planConfig[planType] || planConfig.basic;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.className}`}>
        <Icon className="h-2 w-2" />
        {config.label}
      </span>
    );
  };

  // Get initials for avatar
  const getInitials = () => {
    if (vendor?.vendor_name) {
      return vendor.vendor_name.charAt(0).toUpperCase();
    }
    if (currentUser?.first_name && currentUser?.last_name) {
      return `${currentUser.first_name.charAt(0)}${currentUser.last_name.charAt(0)}`.toUpperCase();
    }
    if (currentUser?.first_name) {
      return currentUser.first_name.charAt(0).toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const displayName = getDisplayName();
  const displayEmail = currentUser?.email || "user@example.com";
  const initials = getInitials();
  const subscriptionBadge = getSubscriptionBadge();

  return (
    <TooltipProvider>
      {/* Mobile Overlay */}
      {isMobile && openMobile && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden"
          onClick={() => setOpenMobile(false)}
        />
      )}

      <Sidebar collapsible="icon" className="border-r shadow-sm">
        <SidebarHeader className="border-b px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-left shadow-none">
              <Image 
                src={logoImage}
                alt="Logo" 
                width={95}
                className="w-24"
              />
            </div>
            {/* Close button for mobile */}
            {isMobile && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setOpenMobile(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className="py-2">
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive} 
                    tooltip={item.title}
                    onClick={handleMobileMenuClose}
                  >
                    <Link href={item.href} className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t p-4">
          <DropdownMenu open={isProfileOpen} onOpenChange={setIsProfileOpen}>
            <DropdownMenuTrigger asChild>
              <div className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-muted/50 p-2 transition-all hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {state === 'expanded' && !isMobile && (
                  <>
                    <div className="flex-1 overflow-hidden text-left">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                        {subscriptionBadge && (
                          <span className="flex-shrink-0">
                            {subscriptionBadge}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </>
                )}
                {isMobile && (
                  <div className="flex-1 overflow-hidden text-left">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                      {subscriptionBadge && (
                        <span className="flex-shrink-0">
                          {subscriptionBadge}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align={isMobile ? "center" : "end"}
              sideOffset={10}
              className="w-72 p-0"
            >
              <UserMenuCard 
                onNavigate={handleNavigation}
                onSignOut={handleSignOut}
                user={{
                  id: currentUser?.id || undefined,
                  email: currentUser?.email || undefined,
                  first_name: currentUser?.first_name || undefined,
                  last_name: currentUser?.last_name || undefined,
                  profile_image: currentUser?.profile_image || undefined,
                }}
                vendor={{
                  vendor_name: vendor?.vendor_name || undefined,
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Header - Fixed positioning for responsive */}
      <header 
        className="fixed left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b bg-background px-4 shadow-sm md:px-6 transition-all duration-300"
        style={{ 
          left: !isMobile && state === 'expanded' ? 'var(--sidebar-width, 16rem)' : 
                !isMobile && state === 'collapsed' ? 'var(--sidebar-width-icon, 4rem)' : 
                '0px',
        }}
      >
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
            className="h-9 w-9"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            {/* Logo Image in Header */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm overflow-hidden">
              <Image 
                src="/logo-small.png" 
                alt="Logo" 
                width={32} 
                height={32} 
                className="object-cover"
                onError={(e) => {
                  // Fallback if logo-small.png doesn't exist
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const span = document.createElement('span');
                    span.className = 'text-white text-sm font-bold';
                    span.textContent = '';
                    parent.appendChild(span);
                  }
                }}
              />
            </div>
            <h1 className="text-lg font-semibold tracking-tight md:text-xl">
              {currentPageTitle}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </Button>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16" />
    </TooltipProvider>
  );
}