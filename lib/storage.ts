// lib/storage.ts
import { createClient } from "@/lib/supabase/client"

export async function uploadImageToBucket(
  file: File,
  bucketName: string,
  filePath: string
): Promise<{ publicUrl: string; error: string | null }> {
  const supabase = createClient()

  try {
    console.log("[v0] Starting upload to bucket:", bucketName, "path:", filePath)

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { 
        cacheControl: '3600',
        upsert: false   // Changed to false (safer with your current policy)
      })

    if (uploadError) {
      console.error("[v0] Upload error:", uploadError)
      return { publicUrl: "", error: uploadError.message }
    }

    console.log("[v0] Upload successful:", data)

    // Get public URL
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    const publicUrl = publicData?.publicUrl || ""

    console.log("[v0] Public URL:", publicUrl)

    return { publicUrl, error: null }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Unexpected error:", errorMessage)
    return { publicUrl: "", error: errorMessage }
  }
}