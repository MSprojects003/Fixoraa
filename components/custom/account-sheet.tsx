"use client"

import { useState, useRef } from "react"
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
import { Edit2, Plus } from "lucide-react"
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

  // Handle image upload to Supabase bucket
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

    try {
      const loadingToast = toast.loading("Uploading image...")

      const fileExt = file.name.split(".").pop()
      const fileName = `${fieldName}-${user?.id}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload using helper function
      const { publicUrl, error } = await uploadImageToBucket(
        file,
        bucketName,
        filePath
      )

      if (error) {
        throw new Error(error)
      }

      if (!publicUrl) {
        throw new Error("Failed to get public URL")
      }

      // Update appropriate table
      if (fieldName === "profile") {
        if (user?.id) {
          const { error: updateError } = await supabase
            .from("users")
            .update({ profile_image: publicUrl })
            .eq("id", user.id)

          if (updateError) throw updateError
        }
        setValues((prev) => ({ ...prev, profileImage: publicUrl }))
      } else if (fieldName === "vendor") {
        if (vendor?.id) {
          const { error: updateError } = await supabase
            .from("vendors")
            .update({ image1: publicUrl })
            .eq("id", vendor.id)

          if (updateError) throw updateError
        }
        setValues((prev) => ({ ...prev, vendorImage: publicUrl }))
      }

      toast.dismiss(loadingToast)
      toast.success("Image updated successfully")
    } catch (error) {
      console.error("[v0] Error uploading image:", error)
      toast.dismiss()
      toast.error("Failed to upload image: " + (error instanceof Error ? error.message : "Unknown error"))
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
          updateVendor(vendorData)
        } else {
          createVendor(vendorData)
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
  }: {
    value: string
    fieldName: string
    isEditing: boolean
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
          className="border-primary/30 focus-visible:border-primary"
          placeholder={fieldName}
        />
      )
    }

    return (
      <div
        onClick={() => setEditingField(fieldName)}
        className="cursor-pointer rounded-md p-2 transition-colors hover:bg-muted"
      >
        <p className="text-sm text-foreground">{value || "Click to add"}</p>
      </div>
    )
  }

  // Loading skeleton
  if (userLoading || vendorLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <div className="space-y-6 py-6">
            {/* Profile section skeleton */}
            <div className="flex items-start gap-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>

            {/* Personal info skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>

            {/* Business info skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-2xl">{vendor?.vendor_name || "Account Settings"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-2 px-2">
          {/* Profile & Vendor Info Section */}
          <div className="flex items-start justify-between gap-6">
            {/* Profile Image */}
            <div className="relative group">
              <Avatar className="h-28 w-28 border-2 border-primary/20">
                <AvatarImage src={values.profileImage || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-2xl font-semibold text-primary">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 rounded-full bg-primary p-2 text-primary-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                title="Change profile image"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "profile-images", "profile", "profile_image")}
                className="hidden"
              />
            </div>

            {/* Vendor Name and Category */}
            <div className="flex-1 space-y-2">
              {/* Vendor Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Vendor Name
                </label>
                <EditableField
                  value={values.vendorName}
                  fieldName="vendorName"
                  isEditing={editingField === "vendorName"}
                />
              </div>

              {/* Business Category */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Business Category
                </label>
                {!values.businessCategory ? (
                  <Select value={values.businessCategory} onValueChange={(val) => {
                    setValues((prev) => ({ ...prev, businessCategory: val }))
                    handleFieldBlur("businessCategory", val)
                  }}>
                    <SelectTrigger className="border-primary/30">
                      <SelectValue placeholder="Select category" />
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
                  <div className="rounded-md p-2 bg-muted/50">
                    <p className="text-sm text-foreground">
                      {businessCategories.find((c) => c.value === values.businessCategory)?.label || values.businessCategory}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      (Cannot be changed after creation)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Personal Information
            </h3>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Email
              </label>
              <div className="rounded-md p-2 bg-muted/50">
                <p className="text-sm text-foreground">{values.email}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                First Name
              </label>
              <EditableField
                value={values.firstName}
                fieldName="firstName"
                isEditing={editingField === "firstName"}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Last Name
              </label>
              <EditableField
                value={values.lastName}
                fieldName="lastName"
                isEditing={editingField === "lastName"}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Phone
              </label>
              <EditableField
                value={values.phone}
                fieldName="phone"
                isEditing={editingField === "phone"}
              />
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Business Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Business Information
            </h3>

            {/* Address */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Address
              </label>
              <EditableField
                value={values.address}
                fieldName="address"
                isEditing={editingField === "address"}
              />
            </div>

            {/* Vendor Image */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Vendor Image
              </label>
              <div className="flex items-center gap-3 mt-2">
                {values.vendorImage ? (
                  <div className="relative group">
                    <img
                      src={values.vendorImage}
                      alt="Vendor"
                      className="h-20 w-20 rounded-md object-cover border-2 border-primary/20"
                    />
                    <button
                      onClick={() => vendorImageInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 className="h-5 w-5 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => vendorImageInputRef.current?.click()}
                    className="h-20 w-20 rounded-md border-2 border-dashed border-primary/30 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="h-6 w-6 text-primary/50" />
                  </button>
                )}
                <input
                  ref={vendorImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "vendor-images", "vendor", "vendor_image")}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">Click to upload vendor image</p>
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Action Button */}
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
