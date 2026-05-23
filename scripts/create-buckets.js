import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createBuckets() {
  try {
    console.log('Creating storage buckets...');

    // Create profile-images bucket
    try {
      const { data: profileBucket } = await supabase.storage.createBucket('profile-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880, // 5MB
      });
      console.log('✓ profile-images bucket created');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✓ profile-images bucket already exists');
      } else {
        throw err;
      }
    }

    // Create vendor-images bucket
    try {
      const { data: vendorBucket } = await supabase.storage.createBucket('vendor-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880, // 5MB
      });
      console.log('✓ vendor-images bucket created');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✓ vendor-images bucket already exists');
      } else {
        throw err;
      }
    }

    console.log('\n✅ All buckets ready!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating buckets:', error.message);
    process.exit(1);
  }
}

createBuckets();
