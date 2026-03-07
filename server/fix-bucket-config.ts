import { createClient } from '@supabase/supabase-js';

async function fixBucketConfiguration() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const bucketName = 'gamefolio-media';

  try {
    console.log(`🔧 Checking bucket configuration for: ${bucketName}`);
    
    // First, try to list files from the bucket to check if it exists
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 1 });
    
    if (listError && listError.message.includes('not found')) {
      console.log(`📦 Creating bucket: ${bucketName}`);
      // Create bucket with proper configuration
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/*', 'video/*'],
        fileSizeLimit: 1073741824 // 1GB
      });
      
      if (createError) {
        console.error('❌ Failed to create bucket:', createError);
        throw createError;
      }
      
      console.log('✅ Bucket created successfully with video support');
    } else {
      console.log(`📦 Bucket exists, attempting to update configuration...`);
      
      // Try to update bucket configuration to allow videos
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/*', 'video/*'],
        fileSizeLimit: 1073741824 // 1GB
      });
      
      if (updateError) {
        console.warn('⚠️  Update bucket failed:', updateError.message);
        console.log('📝 Note: Bucket exists but cannot be updated programmatically.');
        console.log('📝 Please manually update the bucket configuration in Supabase dashboard:');
        console.log('   1. Go to Storage > Buckets in your Supabase dashboard');
        console.log(`   2. Find the "${bucketName}" bucket`);
        console.log('   3. Click on the bucket settings');
        console.log('   4. Update "Allowed MIME types" to include: image/*, video/*');
        console.log('   5. Set file size limit to 1GB');
        console.log('   6. Make sure the bucket is public');
      } else {
        console.log('✅ Bucket configuration updated successfully');
      }
    }

    // Test upload to verify configuration
    console.log('🧪 Testing video upload capability...');
    const testBuffer = Buffer.from('test video content');
    const testPath = 'test-video.mp4';
    
    const { error: testUploadError } = await supabase.storage
      .from(bucketName)
      .upload(testPath, testBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });
    
    if (testUploadError) {
      console.error('❌ Test upload failed:', testUploadError);
      throw testUploadError;
    }
    
    // Clean up test file
    await supabase.storage.from(bucketName).remove([testPath]);
    
    console.log('✅ Video upload test successful - bucket is properly configured');
    
  } catch (error) {
    console.error('❌ Failed to fix bucket configuration:', error);
    throw error;
  }
}

// Run the fix immediately when script is executed
fixBucketConfiguration()
  .then(() => {
    console.log('🎉 Bucket configuration fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Bucket configuration fix failed:', error);
    process.exit(1);
  });

export { fixBucketConfiguration };