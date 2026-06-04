"use client"

import { useState, useRef, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Plus, Mail, MapPin, Building2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { uploadImageToBucket } from "@/lib/storage"
import { useCurrentUser, useUpdateProfile, useUpdateVendor, useCreateVendor, useVendor } from "@/hooks/use-user"

interface AccountSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const businessCategories = [
  { value: "salon", label: "Salon" },
  { value: "spa", label: "Spa" },
  { value: "barbershop", label: "Barbershop" },
  { value: "wellness", label: "Wellness Center" },
  { value: "beauty", label: "Beauty Studio" },
  { value: "other", label: "Other" },
]

export function AccountSheet({ isOpen, onOpenChange }: AccountSheetProps) {
  const supabase = createClient()
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const { data: vendor, isLoading: vendorLoading } = useVendor()
  const { mutate: updateProfile, isPending: isUpdatingProfile } = useUpdateProfile()
  const { mutate: updateVendor, isPending: isUpdatingVendor } = useUpdateVendor()
  const { mutate: createVendor } = useCreateVendor()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const vendorImageInputRef = useRef<HTMLInputElement>(null)

  // Editable states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [values, setValues] = useState({
    profileImage: user?.profile_image || "",
    email: user?.email || "",
    vendorName: vendor?.vendor_name || "",
    businessCategory: vendor?.category || "",
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
    phone: user?.phone || "",
    address: vendor?.address || "",
    vendorImage: vendor?.image1 || "",
  })

  // Sync values when user/vendor data loads
  useEffect(() => {
    if (user || vendor) {
      setValues({
        profileImage: user?.profile_image || "",
        email: user?.email || "",
        vendorName: vendor?.vendor_name || "",
        businessCategory: vendor?.category || "",
        firstName: user?.first_name || "",
        lastName: user?.last_name || "",
        phone: user?.phone || "",
        address: vendor?.address || "",
        vendorImage: vendor?.image1 || "",
      })
      console.log("[v0] Updated values with user data:", { user, vendor })
    }
  }, [user?.id, user?.first_name, user?.last_name, user?.phone, user?.email, user?.profile_image, vendor?.vendor_name, vendor?.category, vendor?.address, vendor?.image1])

  const handleImageUpload = async (
  e: React.ChangeEvent<HTMLInputElement>,
  bucketName: string,
  fieldName: string,
  dbColumnName: string
) => {
  const file = e.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith("image/")) {
    toast.error("Please select an image file")
    return
  }

  if (!user?.id) {
    toast.error("You must be logged in to upload")
    return
  }

  try {
    const loadingToast = toast.loading("Uploading image...")

    const fileExt = file.name.split(".").pop() || "jpg"
    const timestamp = Date.now()

    // This structure matches your RLS policy
    const filePath = `${user.id}/${fieldName}-${timestamp}.${fileExt}`

    const { publicUrl, error } = await uploadImageToBucket(
      file,
      bucketName,
      filePath
    )

    if (error) throw new Error(error)

    if (!publicUrl) throw new Error("Failed to get public URL")

    // Update database
    if (fieldName === "profile") {
      const { error: updateError } = await supabase
        .from("users")
        .update({ profile_image: publicUrl })
        .eq("id", user.id)

      if (updateError) throw updateError

      setValues((prev) => ({ ...prev, profileImage: publicUrl }))
    } 
    else if (fieldName === "vendor") {
      if (!vendor?.id) {
        toast.error("Vendor not found")
        return
      }

      const { error: updateError } = await supabase
        .from("vendors")
        .update({ image1: publicUrl })
        .eq("id", vendor.id)

      if (updateError) throw updateError

      setValues((prev) => ({ ...prev, vendorImage: publicUrl }))
    }

    toast.dismiss(loadingToast)
    toast.success("Image uploaded successfully!")
  } catch (error: any) {
    console.error("[v0] Upload error:", error)
    toast.dismiss()
    toast.error("Upload failed: " + (error.message || "Unknown error"))
  }
}

  // Handle field blur - update to database
  const handleFieldBlur = async (fieldName: string, newValue: string) => {
    if (!user?.id) return

    try {
      if (
        fieldName === "firstName" ||
        fieldName === "lastName" ||
        fieldName === "phone"
      ) {
        // Update user profile
        updateProfile({
          first_name: fieldName === "firstName" ? newValue : values.firstName,
          last_name: fieldName === "lastName" ? newValue : values.lastName,
          phone: fieldName === "phone" ? newValue : values.phone,
        })
        toast.success("Profile updated")
      } else if (
        fieldName === "vendorName" ||
        fieldName === "businessCategory" ||
        fieldName === "address"
      ) {
        // Update or create vendor
        const vendorData = {
          vendor_name:
            fieldName === "vendorName" ? newValue : values.vendorName,
          category:
            fieldName === "businessCategory" ? newValue : values.businessCategory,
          address: fieldName === "address" ? newValue : values.address,
        }

        if (vendor?.id) {
          console.log("[v0] Updating vendor:", vendor.id, vendorData)
          updateVendor(vendorData, {
            onError: (error) => {
              console.error("[v0] Vendor update failed:", error)
            },
          })
        } else {
          console.log("[v0] Creating new vendor:", vendorData)
          createVendor(vendorData, {
            onError: (error) => {
              console.error("[v0] Vendor create failed:", error)
            },
          })
        }
        toast.success("Business information updated")
      }

      setEditingField(null)
    } catch (error) {
      console.error("Error updating field:", error)
      toast.error("Failed to update information")
    }
  }

  const getInitials = () => {
    const first = user?.first_name?.[0] || ""
    const last = user?.last_name?.[0] || ""
    return (first + last).toUpperCase() || "U"
  }

  const EditableField = ({
    value,
    fieldName,
    isEditing,
    icon: Icon,
  }: {
    value: string
    fieldName: string
    isEditing: boolean
    icon?: any
  }) => {
    if (isEditing) {
      return (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValues((prev) => ({ ...prev, [fieldName]: e.target.value }))}
          onBlur={() => handleFieldBlur(fieldName, value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleFieldBlur(fieldName, value)
            }
          }}
          className="border border-input/50 focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/20"
          placeholder={fieldName}
        />
      )
    }

    return (
      <div
        onClick={() => setEditingField(fieldName)}
        className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/30 px-3 py-2.5 cursor-pointer hover:bg-muted/50 hover:border-border/50 transition-all duration-200"
      >
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-sm text-foreground flex-1">{value || "Click to add"}</p>
      </div>
    )
  }

  // Loading skeleton
  if (userLoading || vendorLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <div className="space-y-8 py-6">
            {/* Header skeleton */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>

            {/* Cards skeleton */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl bg-background">
        <SheetHeader className="border-b border-border/30 pb-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-2xl font-bold text-foreground">Account Settings</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage your profile and business information</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-8">
          {/* Profile Header Card - Vendor Focused */}
          <div className="relative rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 via-muted/20 to-muted/10 p-8">
            <div className="flex flex-col items-center text-center gap-6">
              {/* Large Profile Avatar */}
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                  <AvatarImage src={values.profileImage || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/20 text-3xl font-bold text-primary">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  title="Change profile image"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "profile_images", "profile", "profile_image")}
                  className="hidden"
                />
              </div>

              {/* Vendor Name - Main Focus */}
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-foreground">
                  {values.vendorName || "Business Name"}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Mail className="h-4 w-4" />
                  {values.email}
                </p>
                {values.businessCategory && (
                  <p className="text-sm text-primary font-medium mt-2 flex items-center justify-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {businessCategories.find((c) => c.value === values.businessCategory)?.label || values.businessCategory}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Personal Information</h4>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  First Name
                </label>
                <EditableField
                  value={values.firstName}
                  fieldName="firstName"
                  isEditing={editingField === "firstName"}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Last Name
                </label>
                <EditableField
                  value={values.lastName}
                  fieldName="lastName"
                  isEditing={editingField === "lastName"}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Phone Number
                </label>
                <EditableField
                  value={values.phone}
                  fieldName="phone"
                  isEditing={editingField === "phone"}
                  icon={Edit2}
                />
              </div>
            </div>
          </div>

          {/* Business Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h4 className="font-semibold text-foreground text-sm uppercase tracking-wider">Business Information</h4>
            </div>

            <div className="grid gap-4">
              {/* Vendor Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Business Name
                </label>
                <EditableField
                  value={values.vendorName}
                  fieldName="vendorName"
                  isEditing={editingField === "vendorName"}
                  icon={Building2}
                />
              </div>

              {/* Business Category */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Business Category
                </label>
                {!values.businessCategory ? (
                  <Select value={values.businessCategory} onValueChange={(val) => {
                    setValues((prev) => ({ ...prev, businessCategory: val }))
                    handleFieldBlur("businessCategory", val)
                  }}>
                    <SelectTrigger className="border border-input/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg border border-border/30 bg-muted/30 px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">
                      {businessCategories.find((c) => c.value === values.businessCategory)?.label || values.businessCategory}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cannot be changed after creation
                    </p>
                  </div>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                  Business Address
                </label>
                <EditableField
                  value={values.address}
                  fieldName="address"
                  isEditing={editingField === "address"}
                  icon={MapPin}
                />
              </div>

          {/* Vendor Image - After Business Section */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
              Business Image
            </label>
            <div className="flex items-center gap-4">
              {values.vendorImage ? (
                <div className="relative group">
                  <img
                    src={values.vendorImage}
                    alt="Vendor"
                    className="h-28 w-28 rounded-lg object-cover border-2 border-border/50 shadow-md"
                  />
                  <button
                    onClick={() => vendorImageInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    <Plus className="h-6 w-6 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => vendorImageInputRef.current?.click()}
                  className="h-28 w-28 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 bg-muted/20"
                >
                  <Plus className="h-7 w-7 text-primary/60" />
                </button>
              )}
              <input
                ref={vendorImageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "vendor_images", "vendor", "image1")}
                className="hidden"
              />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Upload business image</p>
                <p className="mt-2">Recommended size: 1200x800px</p>
                <p className="mt-1">This image represents your business</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Vendor Name Again */}
        <div className="border-t border-border/30 mt-8 pt-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Business</p>
          <p className="text-lg font-semibold text-foreground mt-2">{values.vendorName || "Your Business Name"}</p>
          {values.address && (
            <p className="text-sm text-muted-foreground mt-2 flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {values.address}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
