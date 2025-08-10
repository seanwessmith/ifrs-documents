#!/usr/bin/env bun
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

async function setupS3() {
  console.log('🔗 Connecting to MinIO...');
  
  const s3 = new S3Client({
    endpoint: 'http://localhost:9000',
    region: 'us-west-2',
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    },
    forcePathStyle: true,
  });

  const bucketName = 'ifrs-document-system';

  try {
    // Check if bucket exists
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`✅ Bucket '${bucketName}' already exists`);
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      console.log(`📦 Creating bucket '${bucketName}'...`);
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`✅ Bucket '${bucketName}' created successfully!`);
    } else {
      throw error;
    }
  }
}

setupS3().catch((error) => {
  console.error('❌ S3 setup failed:', error);
  process.exit(1);
});