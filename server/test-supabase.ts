import { createClient } from '@supabase/supabase-js';

async function testSupabaseStorage() {
  console.log('Testing Supabase Storage Configuration...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return;
  }
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key:', supabaseKey.substring(0, 20) + '...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: List all buckets
    console.log('\n=== Testing bucket listing ===');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
    } else {
      console.log('Available buckets:', buckets?.map(b => b.name) || []);
    }
    
    // Test 2: Get specific bucket
    console.log('\n=== Testing gamefolio-media bucket ===');
    const { data: bucket, error: bucketError } = await supabase.storage.getBucket('gamefolio-media');
    
    if (bucketError) {
      console.error('Error getting gamefolio-media bucket:', bucketError);
    } else {
      console.log('Bucket found:', bucket);
    }
    
    // Test 3: Try to upload a small test file
    console.log('\n=== Testing file upload ===');
    const testContent = Buffer.from('Hello, Supabase!', 'utf8');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('gamefolio-media')
      .upload('test/test.txt', testContent, {
        contentType: 'text/plain',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('Error uploading test file:', uploadError);
    } else {
      console.log('Upload successful:', uploadData);
      
      // Test 4: Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('gamefolio-media')
        .getPublicUrl('test/test.txt');
      
      console.log('Public URL:', publicUrl);
      
      // Test 5: Delete test file
      const { error: deleteError } = await supabase.storage
        .from('gamefolio-media')
        .remove(['test/test.txt']);
      
      if (deleteError) {
        console.error('Error deleting test file:', deleteError);
      } else {
        console.log('Test file deleted successfully');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSupabaseStorage().catch(console.error);