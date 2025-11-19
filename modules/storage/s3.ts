import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// S3-compatible storage client (MinIO for local, AWS S3 for prod)
export function getStorageClient() {
  const isLocal = process.env.STORAGE_MODE === "local";

  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: isLocal ? process.env.MINIO_ENDPOINT : undefined,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: isLocal, // Required for MinIO
  });
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const client = getStorageClient();
    const bucket = process.env.S3_BUCKET || "draehi-assets";

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );

    // Generate public URL
    const isLocal = process.env.STORAGE_MODE === "local";
    const baseUrl = isLocal
      ? process.env.MINIO_PUBLIC_URL || "http://localhost:9000"
      : `https://${bucket}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;

    // For MinIO (local), include bucket in path; for S3 (prod), bucket is in subdomain
    const url = isLocal ? `${baseUrl}/${bucket}/${key}` : `${baseUrl}/${key}`;

    return {
      success: true,
      url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
