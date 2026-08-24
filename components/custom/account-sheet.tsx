"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Mail, Building2, CheckCircle, XCircle, Upload, FileCheck, Image, AlertCircle, Crown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadImageToBucket } from "@/lib/storage";
import {
  useCurrentUser,
  useUpdateProfile,
  useUpdateVendor,
  useCreateVendor,
  useVendor,
} from "@/hooks/use-user";
import Link from "next/link";

interface AccountSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const businessCategories = [
  { value: "salon", label: "Salon", subtext: "Hair & Beauty" },
  { value: "technician", label: "Technician", subtext: "Home Repairs" },
  { value: "electrician", label: "Electrician", subtext: "Electrical Work" },
  { value: "welding", label: "Welding", subtext: "Fabrication" },
  { value: "interior-design", label: "Interior Design", subtext: "Home Styling" },
  { value: "bridal", label: "Bridal Services", subtext: "Wedding Makeup" },
  { value: "architectural", label: "Architectural", subtext: "Design & Planning" },
  { value: "garden-cleaning", label: "Garden Cleaning", subtext: "Landscaping" },
  { value: "home-decorator", label: "Home Decorator", subtext: "Interior Decor" },
  { value: "catering", label: "Catering", subtext: "Food Services" },
  { value: "garbage-disposal", label: "Garbage Disposal", subtext: "Waste Management" },
];

// Edit limits based on subscription type
const EDIT_LIMITS = {
  basic: { maxEdits: 2, label: "Basic", color: "text-gray-600" },
  pro: { maxEdits: 10, label: "Pro", color: "text-violet-600" },
  premium: { maxEdits: Infinity, label: "Premium", color: "text-amber-600" },
};

const VO_CERTIFICATE_BUCKET = "VO_certificate";

// Fields that should NOT have edit limits (verification fields)
const UNLIMITED_FIELDS = [
  "nic_front",
  "nic_back",
  "vo_certificate",
  "nic_verified",
  "vo_verified",
];

export function AccountSheet({ isOpen, onOpenChange }: AccountSheetProps) {
  const supabase = createClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: vendor, isLoading: vendorLoading } = useVendor();
  const { mutateAsync: updateProfileAsync } = useUpdateProfile();
  const { mutateAsync: updateVendorAsync } = useUpdateVendor();
  const { mutateAsync: createVendorAsync } = useCreateVendor();

  const isLoadingAccount = userLoading || vendorLoading;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const vendorImageInputRef = useRef<HTMLInputElement>(null);
  const nicFrontInputRef = useRef<HTMLInputElement>(null);
  const nicBackInputRef = useRef<HTMLInputElement>(null);
  const voCertificateInputRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    vendorName: "",
    businessCategory: "",
    address: "",
    profileImage: "",
    vendorImage: "",
    email: "",
    nicFront: "",
    nicBack: "",
    nicVerified: false,
    voCertificate: "",
    voVerified: false,
  });

  // Edit tracking state
  const [editCounts, setEditCounts] = useState<Record<string, number>>({});
  const [subscriptionType, setSubscriptionType] = useState<string>("basic");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});

  // Live entitlement: is the vendor's subscription actually still within
  // its paid period right now? This is the authoritative answer from the
  // database (checks subscriptions.expires_at directly), independent of
  // whatever vendors.has_subscription currently says, since that flag can
  // go stale between scheduled syncs. Until this resolves, every input is
  // disabled — we never allow an edit while entitlement is unknown.
  const [isEntitled, setIsEntitled] = useState(false);
  const [isCheckingEntitlement, setIsCheckingEntitlement] = useState(true);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);

  // Snapshot of the last value confirmed to be on the server (or loaded
  // from it) for each text field. `values` itself updates on every
  // keystroke via onChange, so it can NOT be used as the "did this
  // actually change since last save" baseline on blur — comparing against
  // it always reads as "unchanged" because onChange already wrote the new
  // keystroke into `values` before blur ever fires. This ref is the fix:
  // it only updates on load and on confirmed save, never on keystroke.
  const lastSavedRef = useRef<Record<string, string>>({
    firstName: "",
    lastName: "",
    phone: "",
    vendorName: "",
    businessCategory: "",
    address: "",
  });

  // Tracks which form fields currently have an in-flight save, so the
  // server-resync effect below doesn't clobber values mid-edit.
  const pendingFieldsRef = useRef<Set<string>>(new Set());

  // Live entitlement check + period-aware edit counts.
  // Runs once vendor.id is known. This is the authoritative check: it asks
  // the database directly whether the vendor's subscription is within its
  // paid period right now (check_vendor_entitlement), rather than trusting
  // vendor.has_subscription, which can be stale if the hourly cron hasn't
  // run yet. It also self-heals: calling it corrects vendors.has_subscription/
  // subscription_type as a side effect if they were wrong.
  useEffect(() => {
    if (!vendor?.id) {
      setIsCheckingEntitlement(false);
      return;
    }

    let cancelled = false;
    setIsCheckingEntitlement(true);

    (async () => {
      try {
        const { data: entitlementRows, error: entitlementError } = await supabase
          .rpc("check_vendor_entitlement", { p_vendor_id: vendor.id });

        if (entitlementError) throw entitlementError;
        const entitlement = entitlementRows?.[0];

        const { data: tracking, error: trackingError } = await supabase
          .rpc("get_current_edit_tracking", { p_vendor_id: vendor.id });

        if (trackingError) throw trackingError;

        if (cancelled) return;

        if (entitlement) {
          setIsEntitled(entitlement.is_entitled);
          setSubscriptionType(entitlement.plan_type || "basic");
          setHasSubscription(entitlement.is_entitled);
          setSubscriptionExpiresAt(entitlement.expires_at || null);
        } else {
          setIsEntitled(false);
          setSubscriptionType("basic");
          setHasSubscription(false);
          setSubscriptionExpiresAt(null);
        }

        const counts = (tracking && typeof tracking === "object" && tracking.counts) || {};
        setEditCounts(counts);
      } catch (err) {
        console.error("Error checking vendor entitlement:", err);
        if (!cancelled) {
          // Fail closed: if we can't verify entitlement, do not grant it.
          setIsEntitled(false);
          setSubscriptionType("basic");
          setHasSubscription(false);
        }
      } finally {
        if (!cancelled) setIsCheckingEntitlement(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vendor?.id]);

  // Sync values when data loads — but never stomp a field that has a save
  // currently in flight, otherwise a slow network response can snap an
  // input back to its old value right after the user just changed it.
  useEffect(() => {
    if (user || vendor) {
      setValues((prev) => {
        const next = {
          firstName: pendingFieldsRef.current.has("firstName") ? prev.firstName : user?.first_name || "",
          lastName: pendingFieldsRef.current.has("lastName") ? prev.lastName : user?.last_name || "",
          phone: pendingFieldsRef.current.has("phone") ? prev.phone : user?.phone || "",
          vendorName: pendingFieldsRef.current.has("vendorName") ? prev.vendorName : vendor?.vendor_name || "",
          businessCategory: pendingFieldsRef.current.has("businessCategory") ? prev.businessCategory : vendor?.category || "",
          address: pendingFieldsRef.current.has("address") ? prev.address : vendor?.address || "",
          profileImage: pendingFieldsRef.current.has("profileImage") ? prev.profileImage : user?.profile_image || "",
          vendorImage: pendingFieldsRef.current.has("vendorImage") ? prev.vendorImage : vendor?.image1 || "",
          email: user?.email || "",
          nicFront: pendingFieldsRef.current.has("nicFront") ? prev.nicFront : vendor?.nic_pic || "",
          nicBack: pendingFieldsRef.current.has("nicBack") ? prev.nicBack : vendor?.nic_back || "",
          nicVerified: vendor?.nic_verified || false,
          voCertificate: pendingFieldsRef.current.has("voCertificate") ? prev.voCertificate : vendor?.vo_certificate || "",
          voVerified: vendor?.vo_verified || false,
        };

        // Keep the baseline ref in sync with whatever we just decided the
        // "current truth" is for each text field, so the next blur compares
        // against the right value instead of against itself.
        lastSavedRef.current = {
          firstName: next.firstName,
          lastName: next.lastName,
          phone: next.phone,
          vendorName: next.vendorName,
          businessCategory: next.businessCategory,
          address: next.address,
        };

        return next;
      });
    }
  }, [user, vendor]);

  // Calculate profile completion percentage
  const calculateCompletionPercentage = () => {
    let filledFields = 0;
    const totalFields = 10;

    if (values.firstName) filledFields++;
    if (values.lastName) filledFields++;
    if (values.phone) filledFields++;
    if (values.vendorName) filledFields++;
    if (values.businessCategory) filledFields++;
    if (values.address) filledFields++;
    if (values.vendorImage) filledFields++;
    if (values.nicFront && values.nicBack && values.nicVerified) {
      filledFields++;
    }
    if (values.voCertificate && values.voVerified) {
      filledFields++;
    }
    if (hasSubscription) filledFields++;

    const percentage = Math.round((filledFields / totalFields) * 100);
    return Math.min(percentage, 100);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return "#22c55e";
    if (percentage >= 50) return "#eab308";
    return "#ef4444";
  };

  // Once a verification document is approved, lock it from further edits.
  // NIC front/back lock together under nic_verified; the VO certificate
  // locks independently under vo_verified. This prevents a vendor from
  // swapping out an already-approved ID document without going through
  // verification again.
  const isVerificationLocked = (field: string): boolean => {
    if (field === "nic_front" || field === "nic_back") {
      return values.nicVerified === true;
    }
    if (field === "vo_certificate") {
      return values.voVerified === true;
    }
    return false;
  };

  // Check if field should have edit limits
  const shouldLimitField = (field: string): boolean => {
    return !UNLIMITED_FIELDS.includes(field);
  };

  // Get max edits for current subscription
  const getNormalizedPlan = () => {
    const plan = subscriptionType || "basic";
    return plan.toLowerCase();
  };

  const getMaxEdits = () => {
    const plan = getNormalizedPlan();
    return EDIT_LIMITS[plan as keyof typeof EDIT_LIMITS]?.maxEdits ?? 2;
  };

  const getPlanLabel = () => {
    const plan = getNormalizedPlan();
    return EDIT_LIMITS[plan as keyof typeof EDIT_LIMITS]?.label || "Basic";
  };

  const isUnlimited = getMaxEdits() === Infinity;

  // Check if field can be edited
  const canEditField = (field: string): boolean => {
    // NIC front/back and VO certificate are exempt from the subscription
    // gate entirely — they're governed purely by their own verified flag
    // (see isVerificationLocked below), regardless of has_subscription.
    if (!shouldLimitField(field)) return true;

    // Every other field requires an active subscription.
    if (!isEntitled) return false;
    if (isUnlimited) return true;
    const currentCount = editCounts[field] || 0;
    return currentCount < getMaxEdits();
  };

  // Get remaining edits for a field
  const getRemainingEdits = (field: string): number => {
    if (!shouldLimitField(field)) return Infinity;
    if (!isEntitled) return 0;
    if (isUnlimited) return Infinity;
    const currentCount = editCounts[field] || 0;
    return Math.max(0, getMaxEdits() - currentCount);
  };

  // Persist an incremented edit count via the database RPC, which handles
  // billing-period resets authoritatively (resets counts to 0 if the
  // vendor's active subscription period has changed since the last edit,
  // self-healing on every call — no separate cron needed for this part).
  // Returns the updated counts on success.
  const persistEditCount = async (field: string): Promise<Record<string, number> | null> => {
    if (!vendor?.id) return null;

    const { data, error } = await supabase.rpc("record_field_edit", {
      p_vendor_id: vendor.id,
      p_field: field,
    });

    if (error) {
      console.error("Error tracking edit:", error);
      throw error;
    }

    const counts = (data && typeof data === "object" && data.counts) || {};
    return counts as Record<string, number>;
  };

  // Save field with edit tracking.
  // Order of operations matters here: we save the actual field value FIRST,
  // and only spend the user's edit credit AFTER that save is confirmed to
  // have succeeded. This prevents burning a limited edit on a write that
  // never actually landed.
  const handleSaveFieldWithTracking = async (
    formField: string,
    trackingField: string,
    value: string
  ) => {
    console.log(`[save] handleSaveFieldWithTracking called formField="${formField}" trackingField="${trackingField}" value="${value}" userId="${user?.id}"`);

    if (!user?.id) {
      console.log("[save] aborting: no user.id");
      return;
    }

    if (!isEntitled) {
      console.log("[save] aborting: vendor is not currently entitled (no active subscription)");
      toast.error("Editing is disabled. Your subscription is inactive — please subscribe to make changes.");
      return;
    }

    if (shouldLimitField(trackingField) && !canEditField(trackingField)) {
      console.log(`[save] aborting: edit limit reached for trackingField="${trackingField}"`);
      toast.error(`You've reached the edit limit for this field. Please upgrade your plan.`);
      return;
    }

    pendingFieldsRef.current.add(formField);
    setSavingFields((prev) => ({ ...prev, [formField]: true }));

    try {
      // 1. Perform the actual save and WAIT for it to resolve.
      if (trackingField === "first_name") {
        console.log("[save] calling updateProfileAsync (first_name)");
        await updateProfileAsync({
          first_name: value,
          last_name: values.lastName,
          phone: values.phone,
        });
      } else if (trackingField === "last_name") {
        console.log("[save] calling updateProfileAsync (last_name)");
        await updateProfileAsync({
          first_name: values.firstName,
          last_name: value,
          phone: values.phone,
        });
      } else if (trackingField === "phone") {
        console.log("[save] calling updateProfileAsync (phone)");
        await updateProfileAsync({
          first_name: values.firstName,
          last_name: values.lastName,
          phone: value,
        });
      } else if (
        trackingField === "vendor_name" ||
        trackingField === "category" ||
        trackingField === "address"
      ) {
        const vendorData = {
          vendor_name: trackingField === "vendor_name" ? value : values.vendorName,
          category: trackingField === "category" ? value : values.businessCategory,
          address: trackingField === "address" ? value : values.address,
        };

        if (vendor?.id) {
          console.log("[save] calling updateVendorAsync", vendorData);
          await updateVendorAsync(vendorData);
        } else {
          console.log("[save] no vendor yet, calling createVendorAsync", vendorData);
          await createVendorAsync(vendorData);
        }
      }

      console.log(`[save] confirmed success for formField="${formField}", updating baseline`);
      // Save succeeded — move the baseline forward immediately so a second
      // blur on this field (before the next refetch lands) is compared
      // against the value we just saved, not the original server value.
      lastSavedRef.current[formField] = value;

      // 2. Only now that the save is confirmed, spend the edit credit.
      if (shouldLimitField(trackingField)) {
        const updatedCounts = await persistEditCount(trackingField);
        if (updatedCounts) {
          setEditCounts(updatedCounts);
          if (!isUnlimited) {
            const remaining = getMaxEdits() - (updatedCounts[trackingField] || 0);
            if (remaining === 0) {
              toast.warning("You've used all edits for this field. Upgrade to Pro for more.");
            } else {
              toast.success(`Saved — ${remaining} edit${remaining === 1 ? "" : "s"} remaining`);
            }
          } else {
            toast.success("Saved");
          }
        }
      } else {
        toast.success("Saved");
      }
    } catch (error: any) {
      console.error("[save] FAILED for formField=" + formField, error);
      toast.error("Failed to save: " + (error?.message || "Please try again"));
      // On failure, drop the pending flag immediately so the next vendor/user
      // refetch is allowed to restore the last known-good server value.
      pendingFieldsRef.current.delete(formField);
    } finally {
      setSavingFields((prev) => ({ ...prev, [formField]: false }));
      // Keep the field marked "pending" briefly after a successful save too —
      // it gets cleared for real once the invalidated query refetches and
      // the effect above sees the field already matches, see clearPending below.
      setTimeout(() => pendingFieldsRef.current.delete(formField), 1500);
    }
  };

  // Image upload with edit tracking
  const handleImageUploadWithTracking = async (
    e: React.ChangeEvent<HTMLInputElement>,
    bucketName: string,
    fieldName: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in to upload");
      return;
    }

    const trackingField =
      fieldName === "profile"
        ? "profile_image"
        : fieldName === "vendor"
        ? "vendor_image"
        : fieldName === "nic_front"
        ? "nic_front"
        : fieldName === "nic_back"
        ? "nic_back"
        : fieldName === "vo_certificate"
        ? "vo_certificate"
        : fieldName;

    const stateField =
      fieldName === "profile"
        ? "profileImage"
        : fieldName === "vendor"
        ? "vendorImage"
        : fieldName === "nic_front"
        ? "nicFront"
        : fieldName === "nic_back"
        ? "nicBack"
        : fieldName === "vo_certificate"
        ? "voCertificate"
        : fieldName;

    if (isVerificationLocked(trackingField)) {
      toast.error("This document is already verified and can no longer be changed.");
      return;
    }

    // NIC front/back and VO certificate are exempt from the subscription
    // gate — only profile_image and vendor_image require an active
    // subscription to upload.
    if (shouldLimitField(trackingField) && !isEntitled) {
      toast.error("Uploading is disabled. Your subscription is inactive — please subscribe to make changes.");
      return;
    }

    if (shouldLimitField(trackingField) && !canEditField(trackingField)) {
      toast.error("You've reached the edit limit for images. Upgrade your plan.");
      return;
    }

    pendingFieldsRef.current.add(stateField);
    setSavingFields((prev) => ({ ...prev, [trackingField]: true }));

    const loadingToast = toast.loading("Uploading image...");

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const timestamp = Date.now();

      let filePath;
      if (fieldName === "nic_front") {
        filePath = `${user.id}/nic_front-${timestamp}.${fileExt}`;
      } else if (fieldName === "nic_back") {
        filePath = `${user.id}/nic_back-${timestamp}.${fileExt}`;
      } else {
        filePath = `${user.id}/${fieldName}-${timestamp}.${fileExt}`;
      }

      const { publicUrl, error } = await uploadImageToBucket(file, bucketName, filePath);

      if (error) throw new Error(error);
      if (!publicUrl) throw new Error("Failed to get public URL");

      if (fieldName === "profile") {
        const { error: dbError } = await supabase
          .from("users")
          .update({ profile_image: publicUrl })
          .eq("id", user.id);
        if (dbError) throw dbError;

        setValues((prev) => ({ ...prev, profileImage: publicUrl }));
        toast.success("Profile image updated");
      } else if (fieldName === "vendor") {
        if (!vendor?.id) throw new Error("Vendor not found");

        const { error: dbError } = await supabase
          .from("vendors")
          .update({ image1: publicUrl })
          .eq("id", vendor.id);
        if (dbError) throw dbError;

        setValues((prev) => ({ ...prev, vendorImage: publicUrl }));
        toast.success("Business image updated");
      } else if (fieldName === "nic_front") {
        if (!vendor?.id) throw new Error("Vendor not found");

        const { error: dbError } = await supabase
          .from("vendors")
          .update({ nic_pic: publicUrl, nic_verified: false })
          .eq("id", vendor.id);
        if (dbError) throw dbError;

        setValues((prev) => ({ ...prev, nicFront: publicUrl, nicVerified: false }));
        toast.info(
          values.nicBack
            ? "Both NIC sides uploaded! Waiting for verification."
            : "NIC Front uploaded successfully! Please upload the back side."
        );
      } else if (fieldName === "nic_back") {
        if (!vendor?.id) throw new Error("Vendor not found");

        const { error: dbError } = await supabase
          .from("vendors")
          .update({ nic_back: publicUrl, nic_verified: false })
          .eq("id", vendor.id);
        if (dbError) throw dbError;

        setValues((prev) => ({ ...prev, nicBack: publicUrl, nicVerified: false }));
        toast.info(
          values.nicFront
            ? "Both NIC sides uploaded! Waiting for verification."
            : "NIC Back uploaded successfully! Please upload the front side."
        );
      } else if (fieldName === "vo_certificate") {
        if (!vendor?.id) throw new Error("Vendor not found");

        const { error: dbError } = await supabase
          .from("vendors")
          .update({ vo_certificate: publicUrl, vo_verified: false })
          .eq("id", vendor.id);
        if (dbError) throw dbError;

        setValues((prev) => ({ ...prev, voCertificate: publicUrl, voVerified: false }));
        toast.info("VO Certificate uploaded successfully! Please wait for verification.");
      }

      // Only spend the edit credit once the upload + DB write both succeeded.
      if (shouldLimitField(trackingField)) {
        const updatedCounts = await persistEditCount(trackingField);
        if (updatedCounts) setEditCounts(updatedCounts);
      }

      toast.dismiss(loadingToast);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.dismiss(loadingToast);
      toast.error("Upload failed: " + (error.message || "Unknown error"));
      pendingFieldsRef.current.delete(stateField);
    } finally {
      setSavingFields((prev) => ({ ...prev, [trackingField]: false }));
      setTimeout(() => pendingFieldsRef.current.delete(stateField), 1500);
    }
  };

  const handleBlurWithTracking = (field: string, value: string) => {
    const baseline = lastSavedRef.current[field];
    console.log(`[blur] field="${field}" baseline="${baseline}" newValue="${value}"`);

    if (baseline === value) {
      console.log(`[blur] field="${field}" unchanged, skipping save`);
      return;
    }

    const trackingFieldMap: Record<string, string> = {
      firstName: "first_name",
      lastName: "last_name",
      phone: "phone",
      vendorName: "vendor_name",
      businessCategory: "category",
      address: "address",
    };

    const trackingField = trackingFieldMap[field] || field;
    console.log(`[blur] field="${field}" changed, saving as trackingField="${trackingField}"`);
    handleSaveFieldWithTracking(field, trackingField, value);
  };

  const getInitials = () => {
    const first = user?.first_name?.[0] || "";
    const last = user?.last_name?.[0] || "";
    return (first + last).toUpperCase() || "U";
  };

  const getCategoryLabel = () => {
    return businessCategories.find((c) => c.value === values.businessCategory)?.label || "Select category";
  };

  const completionPercentage = calculateCompletionPercentage();
  const circleColor = getPercentageColor(completionPercentage);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (completionPercentage / 100) * circumference;
  const isComplete = completionPercentage === 100;

  const isNICFullyUploaded = values.nicFront && values.nicBack;
  const isNICVerified = isNICFullyUploaded && values.nicVerified;

  const handlePublish = async () => {
    if (!isComplete) {
      toast.error("Please complete your profile 100% before publishing");
      return;
    }

    try {
      if (vendor?.id) {
        const { error } = await supabase
          .from("vendors")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", vendor.id);

        if (error) throw error;
        toast.success("Your business has been published successfully!");
        onOpenChange(false);
      } else {
        toast.error("Vendor record not found. Please complete your profile.");
      }
    } catch (error: any) {
      console.error("Error publishing business:", error);
      toast.error("Failed to publish business: " + (error.message || "Unknown error"));
    }
  };

  // Render edit limit indicator for a field
  const renderEditLimit = (field: string) => {
    if (!shouldLimitField(field)) return null;

    const remaining = getRemainingEdits(field);
    const maxEdits = getMaxEdits();
    const canEdit = canEditField(field);
    const planLabel = getPlanLabel();

    if (isUnlimited) {
      return (
        <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
          <Crown className="h-3 w-3" />
          Unlimited ({planLabel})
        </span>
      );
    }

    if (!canEdit && remaining === 0) {
      return (
        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Limit reached ({maxEdits}/{maxEdits})
          <Link href="/subscription" className="underline hover:text-red-800 ml-1 font-semibold">
            Upgrade
          </Link>
        </span>
      );
    }

    return (
      <span className={`text-xs font-medium ${remaining <= 1 ? "text-amber-600" : "text-gray-500"}`}>
        {remaining} edit{remaining > 1 ? "s" : ""} remaining
      </span>
    );
  };

  // Render input with a small rounded loading indicator pinned to the
  // top-right corner of the field while a save is in flight.
  const renderInput = (
    field: string,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onBlur: (e: React.ChangeEvent<HTMLInputElement>) => void,
    placeholder: string,
    disabled: boolean,
    type: string = "text"
  ) => {
    const isLoading = savingFields[field] || false;

    return (
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={`w-full px-2.5 py-2 text-sm border rounded bg-white outline-none transition-colors pr-9 ${
            disabled || isLoading
              ? "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
              : "border-gray-200 text-black focus:border-black placeholder-gray-400"
          }`}
        />
        {isLoading && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
          </div>
        )}
      </div>
    );
  };

  // ImageTile component
  const ImageTile = ({
    src,
    alt,
    onClick,
    icon,
    field,
  }: {
    src: string;
    alt: string;
    onClick: () => void;
    icon: React.ReactNode;
    field?: string;
  }) => {
    const locked = field ? isVerificationLocked(field) : false;
    const canEdit = locked ? false : field ? canEditField(field) : true;
    const isLoading = field ? savingFields[field] : false;

    return (
      <div className="relative w-20 h-20 shrink-0">
        {src ? (
          <div className="relative w-20 h-20 rounded overflow-hidden border border-gray-200 bg-gray-50">
            <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover object-center" />
            {locked ? (
              <div className="absolute inset-0 bg-green-900/20 flex items-center justify-center">
                <CheckCircle size={22} className="text-white drop-shadow" />
              </div>
            ) : canEdit ? (
              <button
                onClick={onClick}
                disabled={isLoading}
                className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
              >
                <Upload size={20} className="text-white" />
              </button>
            ) : (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <AlertCircle size={20} className="text-white" />
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={canEdit && !isLoading ? onClick : undefined}
            disabled={!canEdit || isLoading}
            className={`w-20 h-20 border-2 border-dashed rounded bg-gray-100 flex items-center justify-center transition-colors ${
              canEdit
                ? "border-black cursor-pointer hover:bg-gray-200"
                : "border-gray-400 cursor-not-allowed opacity-50"
            }`}
          >
            {icon}
          </button>
        )}
        {isLoading && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
          </div>
        )}
        {locked && !isLoading && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-600 border-2 border-white shadow-sm flex items-center justify-center">
            <CheckCircle size={11} className="text-white" />
          </div>
        )}
      </div>
    );
  };

  if (isLoadingAccount) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="bg-white overflow-y-auto p-0 max-w-[600px]">
          <SheetHeader className="px-6 py-5 border-b border-gray-200">
            <SheetTitle className="text-left text-lg font-semibold text-black">
              Account Details
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col min-h-screen bg-white">
            <div className="flex flex-row items-start gap-4 py-5 px-6 border-b border-gray-200">
              <Skeleton className="h-20 w-20 rounded-full shrink-0" />
              <div className="flex flex-col gap-2 flex-1 pt-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>

            <div className="flex flex-col gap-3 px-6 py-5 border-b border-gray-200">
              <Skeleton className="h-3 w-40" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="h-9 w-full" />
            </div>

            <div className="flex flex-col gap-3 px-6 py-5 border-b border-gray-200">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <div className="flex items-center gap-3 mt-1">
                <Skeleton className="h-20 w-20 rounded shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 px-6 py-5 border-b border-gray-200">
              <Skeleton className="h-3 w-44" />
              <div className="flex gap-4">
                <Skeleton className="h-20 w-20 rounded shrink-0" />
                <Skeleton className="h-20 w-20 rounded shrink-0" />
              </div>
              <Skeleton className="h-20 w-20 rounded shrink-0 mt-2" />
            </div>

            <div className="px-6 py-5 border-t border-gray-200 mt-auto">
              <Skeleton className="h-11 w-full rounded" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="bg-white overflow-y-auto p-0 max-w-[600px]">
        <SheetHeader className="px-6 py-5 border-b border-gray-200">
          <SheetTitle className="text-left text-lg font-semibold text-black">
            Account Details
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col min-h-screen bg-white">
          {/* Inactive subscription notice — every field below is disabled while this shows */}
          {!isCheckingEntitlement && !isEntitled && (
            <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border-b border-red-200">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <p className="text-xs text-red-700 flex-1">
                Your subscription is inactive, so all fields are read-only.{" "}
                <Link href="/subscription" className="underline font-semibold hover:text-red-900">
                  Subscribe to make changes
                </Link>
              </p>
            </div>
          )}

          {/* Header with Avatar and Info */}
          <div className="flex flex-row items-start gap-4 py-5 px-6 border-b border-gray-200">
            <div className="relative inline-block flex-shrink-0">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full">
                  <svg className="w-22 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r={radius} stroke="#e5e7eb" strokeWidth="6" fill="transparent" />
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke={circleColor}
                      strokeWidth="6"
                      fill="transparent"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: offset,
                        transition: "stroke-dashoffset 0.8s ease-in-out",
                      }}
                    />
                  </svg>
                </div>
                <Avatar className="h-18 w-18 border-2 border-white relative z-10">
                  <AvatarImage src={values.profileImage || undefined} className="object-cover" />
                  <AvatarFallback className="bg-gray-100 text-black text-xl font-bold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                {savingFields["profile_image"] && (
                  <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center z-20">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-center whitespace-nowrap">
                <span className="text-xs font-bold" style={{ color: circleColor }}>
                  {completionPercentage}%
                </span>
              </div>

              <button
                onClick={() => isEntitled && fileInputRef.current?.click()}
                disabled={!isEntitled}
                className={`absolute bottom-0 right-0 border-none rounded-full w-7 h-7 flex items-center justify-center z-20 ${
                  isEntitled
                    ? "bg-black text-white cursor-pointer hover:bg-gray-800"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                <Plus size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUploadWithTracking(e, "profile_images", "profile")}
                className="hidden"
              />
            </div>

            <div className="flex flex-col gap-2 flex-1 pt-1">
              <h3 className="text-base font-semibold text-black m-0">
                {values.firstName} {values.lastName}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Mail size={14} />
                {values.email}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Building2 size={14} />
                {getCategoryLabel()}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">Plan:</span>
                <span
                  className={`text-xs font-medium ${
                    getPlanLabel() === "Premium"
                      ? "text-amber-600"
                      : getPlanLabel() === "Pro"
                      ? "text-violet-600"
                      : "text-gray-600"
                  }`}
                >
                  {getPlanLabel()}
                </span>
                {hasSubscription ? (
                  <span className="text-xs text-emerald-600 font-medium">✓ Active</span>
                ) : (
                  <Link href="/subscription" className="text-xs text-red-600 font-medium underline hover:text-red-800">
                    Inactive — Subscribe
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="flex flex-col gap-3 px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-black tracking-wide m-0 pl-2 border-l border-gray-200">
                PERSONAL INFORMATION
              </h3>
              {renderEditLimit("first_name")}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-black tracking-tight">FIRST NAME</label>
                {renderInput(
                  "firstName",
                  values.firstName,
                  (e) => setValues((prev) => ({ ...prev, firstName: e.target.value })),
                  (e) => handleBlurWithTracking("firstName", e.target.value),
                  "Click to add",
                  !canEditField("first_name")
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-black tracking-tight">LAST NAME</label>
                {renderInput(
                  "lastName",
                  values.lastName,
                  (e) => setValues((prev) => ({ ...prev, lastName: e.target.value })),
                  (e) => handleBlurWithTracking("lastName", e.target.value),
                  "Click to add",
                  !canEditField("last_name")
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-black tracking-tight">PHONE NUMBER</label>
              {renderInput(
                "phone",
                values.phone,
                (e) => setValues((prev) => ({ ...prev, phone: e.target.value })),
                (e) => handleBlurWithTracking("phone", e.target.value),
                "Click to add",
                !canEditField("phone"),
                "tel"
              )}
            </div>
          </div>

          {/* Business Information Section */}
          <div className="flex flex-col gap-3 px-6 py-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-black tracking-wide m-0 pl-2 border-l border-gray-200">
                BUSINESS INFORMATION
              </h3>
              {renderEditLimit("vendor_name")}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-black tracking-tight">BUSINESS NAME</label>
              {renderInput(
                "vendorName",
                values.vendorName,
                (e) => setValues((prev) => ({ ...prev, vendorName: e.target.value })),
                (e) => handleBlurWithTracking("vendorName", e.target.value),
                "Click to add",
                !canEditField("vendor_name")
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-black tracking-tight">BUSINESS CATEGORY</label>
              <div className="relative">
                {values.businessCategory ? (
                  <div
                    className={`w-full px-2.5 py-2 text-sm rounded border border-gray-200 flex items-center pr-9 ${
                      !canEditField("category") ? "bg-gray-50 text-gray-400" : "bg-white text-black"
                    }`}
                  >
                    {getCategoryLabel()}
                  </div>
                ) : (
                  <select
                    value={values.businessCategory}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, businessCategory: e.target.value }));
                      handleBlurWithTracking("businessCategory", e.target.value);
                    }}
                    disabled={!canEditField("category") || savingFields["businessCategory"]}
                    className={`w-full px-2.5 py-2 text-sm border rounded bg-white outline-none cursor-pointer transition-colors pr-9 ${
                      canEditField("category")
                        ? "border-gray-200 text-black focus:border-black"
                        : "border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
                    }`}
                  >
                    <option value="">Select a category</option>
                    {businessCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                )}
                {savingFields["businessCategory"] && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-black tracking-tight">BUSINESS ADDRESS</label>
              {renderInput(
                "address",
                values.address,
                (e) => setValues((prev) => ({ ...prev, address: e.target.value })),
                (e) => handleBlurWithTracking("address", e.target.value),
                "Click to add",
                !canEditField("address")
              )}
            </div>

            {/* Business Image */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-black tracking-tight">BUSINESS IMAGE</label>
                {renderEditLimit("vendor_image")}
              </div>
              <div className="flex items-center gap-3">
                <ImageTile
                  src={values.vendorImage}
                  alt="Vendor"
                  onClick={() => vendorImageInputRef.current?.click()}
                  icon={<Plus size={24} className="text-black" />}
                  field="vendor_image"
                />
                <input
                  ref={vendorImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUploadWithTracking(e, "vendor_images", "vendor")}
                  className="hidden"
                />
                <div>
                  <p className="text-xs font-medium text-black m-0">Upload business image</p>
                  <p className="text-xs text-gray-600 mt-1">Recommended size 800 x 600 px</p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Documents Section - NO EDIT LIMITS */}
          <div className="flex flex-col gap-3 px-6 py-5 border-b border-gray-200">
            <h3 className="text-xs font-bold text-black tracking-wide m-0 pl-2 border-l border-gray-200">
              VERIFICATION DOCUMENTS
            </h3>

            {/* NIC Upload */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-black tracking-tight">
                  NIC (National Identity Card)
                </label>
                {isNICFullyUploaded && (
                  <div className="flex items-center gap-1">
                    {isNICVerified ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : (
                      <XCircle size={16} className="text-yellow-600" />
                    )}
                    <span className="text-xs text-gray-600">
                      {isNICVerified ? "Verified" : "Pending Verification"}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">Front Side</label>
                  <div className="flex items-center gap-3">
                    <ImageTile
                      src={values.nicFront}
                      alt="NIC Front"
                      onClick={() => nicFrontInputRef.current?.click()}
                      icon={<Image size={24} className="text-black" />}
                      field="nic_front"
                    />
                    <input
                      ref={nicFrontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUploadWithTracking(e, "nic_pic", "nic_front")}
                      className="hidden"
                    />
                    <div>
                      <p className="text-xs text-gray-600">
                        {values.nicVerified ? "Verified — locked" : values.nicFront ? "Uploaded" : "Upload front"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">Back Side</label>
                  <div className="flex items-center gap-3">
                    <ImageTile
                      src={values.nicBack}
                      alt="NIC Back"
                      onClick={() => nicBackInputRef.current?.click()}
                      icon={<Image size={24} className="text-black" />}
                      field="nic_back"
                    />
                    <input
                      ref={nicBackInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUploadWithTracking(e, "nic_pic", "nic_back")}
                      className="hidden"
                    />
                    <div>
                      <p className="text-xs text-gray-600">
                        {values.nicVerified ? "Verified — locked" : values.nicBack ? "Uploaded" : "Upload back"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {isNICVerified ? (
                  <span className="text-green-600">NIC verified successfully</span>
                ) : isNICFullyUploaded ? (
                  <span className="text-yellow-600">Both sides uploaded, awaiting verification</span>
                ) : values.nicFront ? (
                  <span className="text-blue-600">Front uploaded, please upload back side</span>
                ) : values.nicBack ? (
                  <span className="text-blue-600">Back uploaded, please upload front side</span>
                ) : (
                  <span className="text-gray-400">Required: Upload both front and back of NIC</span>
                )}
              </div>
            </div>

            {/* VO Certificate Upload */}
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-black tracking-tight">VO Certificate</label>
                {values.voCertificate && (
                  <div className="flex items-center gap-1">
                    {values.voVerified ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : (
                      <XCircle size={16} className="text-yellow-600" />
                    )}
                    <span className="text-xs text-gray-600">
                      {values.voVerified ? "Verified" : "Pending Verification"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ImageTile
                  src={values.voCertificate}
                  alt="VO Certificate"
                  onClick={() => voCertificateInputRef.current?.click()}
                  icon={<FileCheck size={24} className="text-black" />}
                  field="vo_certificate"
                />
                <input
                  ref={voCertificateInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUploadWithTracking(e, VO_CERTIFICATE_BUCKET, "vo_certificate")}
                  className="hidden"
                />
                <div>
                  <p className="text-xs font-medium text-black m-0">Upload VO Certificate</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {values.voVerified
                      ? "Verified — locked"
                      : values.voCertificate
                      ? "Awaiting verification"
                      : "Required for verification"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Publish Button */}
          <div className="px-6 py-5 border-t border-gray-200 mt-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <button
                      onClick={handlePublish}
                      disabled={!isComplete}
                      className={`w-full py-3 text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                        isComplete
                          ? "bg-black text-white border border-black hover:bg-gray-800"
                          : "bg-gray-200 text-gray-500 border border-gray-300 cursor-not-allowed"
                      }`}
                    >
                      <Building2 size={16} />
                      Publish my business
                    </button>
                  </div>
                </TooltipTrigger>
                {!isComplete && (
                  <TooltipContent side="top" className="bg-black text-white px-4 py-2 text-sm font-medium rounded-md">
                    <p>Please complete your profile 100% to publish</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}