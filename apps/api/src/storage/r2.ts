import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
    forcePathStyle: true,
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
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'm4v':
      return 'video/x-m4v';
    case 'm3u8':
      return 'application/vnd.apple.mpegurl';
    case 'ts':
      return 'video/mp2t';
    case 'm4s':
      return 'video/iso.segment';
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

export async function getR2ObjectBuffer(
  r2: R2Config,
  key: string,
): Promise<Buffer> {
  const res = await r2.client.send(
    new GetObjectCommand({
      Bucket: r2.bucket,
      Key: key.replace(/^\//, ''),
    }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes?.length) {
    throw new Error(`Objet R2 vide : ${key}`);
  }
  return unwrapPdfBuffer(Buffer.from(bytes));
}

/** Stream brut R2 (images WebP pages) — sans charger tout en mémoire. */
export async function getR2ObjectStream(
  r2: R2Config,
  key: string,
): Promise<{
  body: import('stream').Readable;
  contentType: string | undefined;
  contentLength: number | undefined;
}> {
  const res = await r2.client.send(
    new GetObjectCommand({
      Bucket: r2.bucket,
      Key: key.replace(/^\//, ''),
    }),
  );
  const body = res.Body as import('stream').Readable | undefined;
  if (!body) {
    throw new Error(`Objet R2 vide : ${key}`);
  }
  return {
    body,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}

/**
 * Certains PDF legacy ont été stockés tels quels depuis un POST multipart
 * (corps WebKitFormBoundary…). On extrait la plage %PDF … %%EOF.
 */
export function unwrapPdfBuffer(buf: Buffer): Buffer {
  if (buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return buf;
  }
  const start = buf.indexOf('%PDF');
  if (start < 0) return buf;
  const endMarker = buf.lastIndexOf('%%EOF');
  if (endMarker > start) {
    return buf.subarray(start, endMarker + 5);
  }
  return buf.subarray(start);
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

/** TTL par défaut des URLs de lecture des pages WebP (15 min). */
export const MAGAZINE_PAGES_SIGNED_URL_TTL_SECONDS = 900;

/**
 * Presigned GET (R2) — lecture pages WebP sans CDN public permanent.
 */
export async function presignR2GetObject(
  r2: R2Config,
  input: {
    key: string;
    expiresInSeconds?: number;
  },
): Promise<string> {
  const key = input.key.replace(/^\//, '');
  const expiresIn =
    input.expiresInSeconds ?? MAGAZINE_PAGES_SIGNED_URL_TTL_SECONDS;
  return getSignedUrl(
    // Versions @aws-sdk/* peuvent diverger dans le monorepo — cast sûr runtime.
    r2.client as never,
    new GetObjectCommand({
      Bucket: r2.bucket,
      Key: key,
    }),
    { expiresIn },
  );
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

export async function listR2Keys(
  r2: R2Config,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2.client.send(
      new ListObjectsV2Command({
        Bucket: r2.bucket,
        Prefix: prefix.replace(/^\//, ''),
        ContinuationToken: token,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function deleteR2Keys(
  r2: R2Config,
  keys: string[],
): Promise<void> {
  const unique = [...new Set(keys.map((k) => k.replace(/^\//, '')))].filter(
    Boolean,
  );
  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    if (chunk.length === 0) continue;
    await r2.client.send(
      new DeleteObjectsCommand({
        Bucket: r2.bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
  }
}

export async function deleteR2Prefix(
  r2: R2Config,
  prefix: string,
): Promise<number> {
  const keys = await listR2Keys(r2, prefix);
  if (keys.length === 0) return 0;
  await deleteR2Keys(r2, keys);
  return keys.length;
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
            AllowedOrigins: ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedHeaders: ['Range', 'Content-Type', 'Origin', 'Accept'],
            ExposeHeaders: [
              'ETag',
              'Content-Length',
              'Content-Range',
              'Accept-Ranges',
            ],
            MaxAgeSeconds: 86400,
          },
          {
            AllowedOrigins: uniqueOrigins,
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: [
              'ETag',
              'Content-Length',
              'Content-Range',
              'Accept-Ranges',
            ],
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
