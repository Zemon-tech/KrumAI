import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Singleton S3 client instance
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "Missing AWS credentials. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env.local"
      );
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3Client;
}

export function getBucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error("Missing AWS_S3_BUCKET_NAME in .env.local");
  }
  return bucket;
}

/**
 * Generate a presigned PUT URL for direct browser upload to S3.
 * The URL expires after `expiresIn` seconds (default 5 minutes).
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

/**
 * Construct the public URL for an object in the outputs/ prefix.
 * Objects in outputs/ are publicly readable via the bucket policy.
 */
export function getPublicOutputUrl(key: string): string {
  const bucket = getBucketName();
  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Generate a sanitized S3 key for input uploads.
 * Format: inputs/{timestamp}_{sanitized_filename}
 */
export function generateInputKey(filename: string): string {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  const timestamp = Date.now();
  return `inputs/${timestamp}_${sanitized}`;
}

/**
 * Extract just the filename portion from a full S3 key.
 * ComfyS3's LoadImageS3 lists files with a leading "/" but os.path.join
 * breaks with absolute paths on Linux. We pass without leading slash
 * and let ComfyS3 construct the path correctly.
 * e.g., "inputs/1234_style_ref.png" -> "1234_style_ref.png"
 * 
 * NOTE: If ComfyS3 validation rejects this, the S3_INPUT_DIR config
 * on the VM needs adjusting. See PLAN_S3_STYLE_REVERSE.md.
 */
export function getFilenameFromKey(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1];
}
