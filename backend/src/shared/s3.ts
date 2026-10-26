import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export const s3 = new S3Client({});
export const uploadBucket = process.env.UPLOAD_BUCKET!;
export async function presignedPut(key: string, contentType: string) {
  if (!['image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(contentType)) throw new Error('Unsupported file type');
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: uploadBucket, Key: key, ContentType: contentType }), { expiresIn: 3600 });
}
export async function presignedGet(key: string) { return getSignedUrl(s3, new GetObjectCommand({ Bucket: uploadBucket, Key: key }), { expiresIn: 3600 }); }
