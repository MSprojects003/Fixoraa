"use client";

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getVendorWithUser } from '@/lib/api/vendor';
import { useCurrentUser } from '@/hooks/use-user';
import { BusinessHeader } from '@/components/custom/BusinessHeader';
import BusinessTabTrigger from '@/components/custom/BusinessTabTrigger';

interface BusinessData {
  id?: string;
  name: string;
  branch: string;
  category: string;
  address: string;
  logo: string;
  status: string;
  profileImage?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  vendorImage?: string | null;
  nicFront?: string | null;
  nicBack?: string | null;
  nicVerified?: boolean;
  voCertificate?: string | null;
  voVerified?: boolean;
  phone?: string | null;
}

function BusinessPage() {
  const supabase = createClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const [businessData, setBusinessData] = useState<BusinessData>({
    name: "",
    branch: "",
    category: "",
    address: "",
    logo: "",
    status: "pending",
    profileImage: null,
    firstName: "",
    lastName: "",
    email: "",
    vendorImage: null,
    nicFront: null,
    nicBack: null,
    nicVerified: false,
    voCertificate: null,
    voVerified: false,
    phone: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Calculate profile completion percentage
  const calculateCompletionPercentage = () => {
    let filledFields = 0;
    const totalFields = 10;

    // Personal Information (30%)
    if (businessData.firstName) filledFields++;
    if (businessData.lastName) filledFields++;
    if (user?.phone || businessData.phone) filledFields++;

    // Business Information (40%)
    if (businessData.name && 
        businessData.name !== "Complete your profile" && 
        businessData.name !== "Business Name" &&
        businessData.name !== "Not set") filledFields++;
    if (businessData.category && 
        businessData.category !== "Not set" && 
        businessData.category !== "Category") filledFields++;
    if (businessData.address && 
        businessData.address !== "Not set" && 
        businessData.address !== "Address") filledFields++;
    if (businessData.vendorImage) filledFields++;

    // NIC (15% - requires BOTH front AND back uploaded AND verified)
    if (businessData.nicFront && businessData.nicBack && businessData.nicVerified) {
      filledFields++;
    }

    // VO Certificate (15% - uploaded AND verified)
    if (businessData.voCertificate && businessData.voVerified) {
      filledFields++;
    }

    const percentage = Math.round((filledFields / totalFields) * 100);
    return Math.min(percentage, 100);
  };

  const normalizeCategoryValue = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed.toLowerCase() === "category") {
      return "Category";
    }
    return trimmed;
  };

  // Fetch vendor data
  useEffect(() => {
    const fetchVendorData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get vendor with user details
        const vendorData = await getVendorWithUser(user.id);

        if (vendorData) {
          setBusinessData({
            id: vendorData.id,
            name: vendorData.vendor_name || "Business Name",
            branch: vendorData.branch || "Branch",
            category: normalizeCategoryValue(vendorData.category),
            address: vendorData.address || "Address",
            logo: vendorData.image1 || "",
            status: vendorData.status || "pending",
            profileImage: vendorData.user?.profile_image || null,
            firstName: vendorData.user?.first_name || "",
            lastName: vendorData.user?.last_name || "",
            email: vendorData.user?.email || "",
            vendorImage: vendorData.image1 || null,
            nicFront: vendorData.nic_pic || null,
            nicBack: vendorData.nic_back || null,
            nicVerified: vendorData.nic_verified || false,
            voCertificate: vendorData.vo_certificate || null,
            voVerified: vendorData.vo_verified || false,
            
          });
        } else {
          // No vendor found - set default values
          setBusinessData({
            name: user.first_name && user.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : "Complete your profile",
            branch: "Not set",
            category: "Not set",
            address: "Not set",
            logo: "",
            status: "pending",
            profileImage: user.profile_image || null,
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            email: user.email || "",
            vendorImage: null,
            nicFront: null,
            nicBack: null,
            nicVerified: false,
            voCertificate: null,
            voVerified: false,
            phone: user.phone || null,
          });
        }
      } catch (err) {
        console.error("Error fetching vendor data:", err);
        setError("Failed to load business data");
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();
  }, [user, refreshKey]);

  // Handle service added successfully
  const handleServiceAdded = () => {
    // Refresh data or fetch services again
    setRefreshKey(prev => prev + 1);
    console.log('Service added, refreshing data...');
  };

  const completionPercentage = calculateCompletionPercentage();

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
          <p className="text-sm text-gray-600">Loading business details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mt-12 mx-auto">
        {/* Business Header */}
        <BusinessHeader 
          businessData={businessData} 
          completionPercentage={completionPercentage} 
        />

        {/* Business Tabs - Services & Products */}
        <div className="mt-8">
          <BusinessTabTrigger 
            businessId={businessData.id}
            vendorCategory={businessData.category}
            onServiceAdded={handleServiceAdded}
          />
        </div>
      </div>
    </div>
  );
}

export default BusinessPage;