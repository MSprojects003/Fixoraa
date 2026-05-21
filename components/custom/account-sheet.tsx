"use client"

import { useState, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { toast } from "sonner"
import { Edit2, Upload } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useCurrentUser, useUpdateProfile, useUpdateVendor, useCreateVendor, useVendor } from "@/hooks/use-user"

interface AccountSheetProps {
  open: boolean
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

export function AccountSheet({ open, onOpenChange }: AccountSheetProps) {
  const supabase = createClient()
  const { data: user, isLoading: userLoading } = useCurrentUser()
  const { data: vendor } = useVendor()
  const { mutate: updateProfile, isPending: isUpdatingProfile } = useUpdateProfile()
  const { mutate: updateVendor, isPending: isUpdatingVendor } = useUpdateVendor()
  const { mutate: createVendor } = useCreateVendor()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Editable states
  const [editingField, setEditingField] = useState<string | null>(null)
  const [values, setValues] = useState({
    profileImage: user?.profile_image || "",
    vendorName: vendor?.vendor_name || "",
    businessCategory: vendor?.branch || "",
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
    phone: user?.phone || "",
    address: vendor?.address || "",
  })

  // Handle profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    try {
      toast.loading("Uploading image...")

      const fileExt = file.name.split(".").pop()
      const fileName = `profile-${user?.id}-${Date.now()}.${fileExt}`
      const filePath = `profiles/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(filePath)

      // Update user profile in database
      if (user?.id) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ profile_image: publicUrl })
          .eq("id", user.id)

        if (updateError) throw updateError
      }

      setValues((prev) => ({ ...prev, profileImage: publicUrl }))
      toast.dismiss()
      toast.success("Profile image updated successfully")
    } catch (error) {
      toast.dismiss()
      console.error("Error uploading image:", error)
      toast.error("Failed to upload image")
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
        if (vendor?.id) {
          updateVendor({
            vendor_name:
              fieldName === "vendorName" ? newValue : values.vendorName,
            branch:
              fieldName === "businessCategory" ? newValue : values.businessCategory,
            address: fieldName === "address" ? newValue : values.address,
          })
        } else {
          createVendor({
            vendor_name:
              fieldName === "vendorName" ? newValue : values.vendorName,
            branch:
              fieldName === "businessCategory" ? newValue : values.businessCategory,
            address: fieldName === "address" ? newValue : values.address,
          })
        }
        toast.success("Vendor information updated")
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

  if (userLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Account Settings</SheetTitle>
          <SheetDescription>
            Manage your profile and business information
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Profile Section */}
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {/* Profile Image */}
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-primary/20">
                  <AvatarImage src={values.profileImage || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-lg font-semibold text-primary">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 rounded-full bg-primary p-2 text-primary-foreground shadow-md transition-transform hover:scale-110"
                  title="Change profile image"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Vendor Name and Category */}
              <div className="flex-1 space-y-3">
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
                  {editingField === "businessCategory" ? (
                    <Select value={values.businessCategory} onValueChange={(val) => {
                      setValues((prev) => ({ ...prev, businessCategory: val }))
                      handleFieldBlur("businessCategory", val)
                    }}>
                      <SelectTrigger className="border-primary/30">
                        <SelectValue />
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
                    <div
                      onClick={() => setEditingField("businessCategory")}
                      className="cursor-pointer rounded-md p-2 transition-colors hover:bg-muted"
                    >
                      <p className="text-sm text-foreground">
                        {businessCategories.find((c) => c.value === values.businessCategory)?.label || "Select category"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Personal Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Personal Information
            </h3>

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

          {/* Merchants Information Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Business Information
            </h3>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Business Address
              </label>
              <EditableField
                value={values.address}
                fieldName="address"
                isEditing={editingField === "address"}
              />
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Action Buttons */}
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
