import { createClient } from "@/lib/supabase/client"

export async function uploadImageToBucket(
  file: File,
  bucketName: string,
  filePath: string
): Promise<{ publicUrl: string; error: string | null }> {
  const supabase = createClient()

  try {
    console.log("[v0] Starting upload to bucket:", bucketName, "path:", filePath)

    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error("[v0] Error listing buckets:", listError)
      return { publicUrl: "", error: "Failed to list buckets" }
    }

    const bucketExists = buckets?.some((b) => b.name === bucketName)
    console.log("[v0] Bucket exists:", bucketExists, "Available buckets:", buckets?.map((b) => b.name))

    if (!bucketExists) {
      return { publicUrl: "", error: `Bucket "${bucketName}" not found` }
    }

    // Upload file
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: true })

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
