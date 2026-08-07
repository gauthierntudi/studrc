import {
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { createHash, createHmac } from 'crypto';

export type R2Config = {
  client: S3Client;
  bucket: string;
  publicUrl: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

function stripQuotes(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

/** R2 endpoint must be the account host — never include the bucket path. */
export function normalizeR2Endpoint(
  endpoint: string,
  bucket?: string,
): string {
  let e = endpoint.trim().replace(/\/$/, '');
  if (bucket && e.endsWith(`/${bucket}`)) {
    e = e.slice(0, -(bucket.length + 1));
  }
  return e;
}

export function createR2ClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): R2Config | null {
  const accountId = stripQuotes(env.R2_ACCOUNT_ID);
  const accessKeyId = stripQuotes(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = stripQuotes(env.R2_SECRET_ACCESS_KEY);
  const bucket = stripQuotes(env.R2_BUCKET);
  let endpoint = stripQuotes(env.R2_ENDPOINT);
  const publicUrl = stripQuotes(env.R2_PUBLIC_URL).replace(/\/$/, '');
  const region = 'auto';

  if (!accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }
  if (!endpoint) {
    return null;
  }

  endpoint = normalizeR2Endpoint(endpoint, bucket);

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    client,
    bucket,
    publicUrl,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region,
  };
}

export function contentTypeForExt(ext: string): string {
  switch (ext.toLowerCase().replace(/^\./, '')) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export async function putR2Object(
  r2: R2Config,
  input: {
    key: string;
    body: Buffer | Uint8Array;
    contentType?: string;
    cacheControl?: string;
  },
): Promise<string> {
  const params: PutObjectCommandInput = {
    Bucket: r2.bucket,
    Key: input.key.replace(/^\//, ''),
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: input.cacheControl ?? 'public, max-age=31536000, immutable',
  };

  await r2.client.send(new PutObjectCommand(params));
  return params.Key!;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmacSha256(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeS3Path(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/');
}

/**
 * Presigned PUT path-style (compatible R2), sans dépendance s3-request-presigner.
 * Le client DOIT envoyer le même Content-Type que celui signé.
 */
export function presignR2PutObject(
  r2: R2Config,
  input: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  },
): { uploadUrl: string; key: string; headers: Record<string, string> } {
  const key = input.key.replace(/^\//, '');
  const expiresIn = input.expiresInSeconds ?? 900;
  const headers = {
    'Content-Type': input.contentType,
  };

  const endpointUrl = new URL(r2.endpoint);
  const host = endpointUrl.host;
  const canonicalUri = `/${encodeRfc3986(r2.bucket)}/${encodeS3Path(key)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${r2.region}/s3/aws4_request`;
  const credential = `${r2.accessKeyId}/${credentialScope}`;

  const signedHeaders = 'content-type;host';
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k]!)}`)
    .join('&');

  const canonicalHeaders =
    `content-type:${input.contentType}\n` + `host:${host}\n`;

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${r2.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, r2.region);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const uploadUrl = `${r2.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

  return { uploadUrl, key, headers };
}

export async function headR2Object(
  r2: R2Config,
  key: string,
): Promise<{
  contentLength: number | undefined;
  contentType: string | undefined;
} | null> {
  try {
    const res = await r2.client.send(
      new HeadObjectCommand({
        Bucket: r2.bucket,
        Key: key.replace(/^\//, ''),
      }),
    );
    return {
      contentLength: res.ContentLength,
      contentType: res.ContentType,
    };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'NotFound' || name === 'NoSuchKey') return null;
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw err;
  }
}

export async function r2ObjectExists(
  r2: R2Config,
  key: string,
): Promise<boolean> {
  const meta = await headR2Object(r2, key);
  return meta != null;
}

export async function putR2BucketCors(
  r2: R2Config,
  origins: string[],
): Promise<void> {
  const uniqueOrigins = [...new Set(origins.map((o) => o.replace(/\/$/, '')))];
  await r2.client.send(
    new PutBucketCorsCommand({
      Bucket: r2.bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: uniqueOrigins,
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['Content-Type', 'Content-Length'],
            ExposeHeaders: ['ETag', 'Content-Length'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
}

export function publicUrlForKey(r2: R2Config, key: string): string | null {
  if (!r2.publicUrl) return null;
  return `${r2.publicUrl}/${key.replace(/^\//, '')}`;
}
