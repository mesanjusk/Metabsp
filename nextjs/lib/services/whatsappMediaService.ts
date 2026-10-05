import axios from 'axios';
import { Readable } from 'stream';
import cloudinary from '../utils/cloudinary';
import { getGraphApiVersion } from '../config/graphApi';

// Ported from backend/src/services/whatsappMediaService.js.

const buildAuthHeaders = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

export const WHATSAPP_MEDIA_MIRROR_MAX_BYTES = Math.max(
  1024 * 1024,
  Number(process.env.WHATSAPP_MEDIA_MIRROR_MAX_BYTES || 10 * 1024 * 1024)
);

export class MediaMirrorTooLargeError extends Error {
  code = 'MEDIA_MIRROR_TOO_LARGE';
  fileSize: number;
  maxBytes: number;

  constructor(fileSize: number, maxBytes = WHATSAPP_MEDIA_MIRROR_MAX_BYTES) {
    super(`Media is too large to mirror safely (${fileSize} bytes; limit ${maxBytes} bytes)`);
    this.name = 'MediaMirrorTooLargeError';
    this.fileSize = fileSize;
    this.maxBytes = maxBytes;
  }
}

export const isMediaMirrorTooLargeError = (error: any) =>
  error?.code === 'MEDIA_MIRROR_TOO_LARGE' || error?.name === 'MediaMirrorTooLargeError';

export const fetchMediaMetadata = async ({
  mediaId,
  accessToken,
  graphVersion = getGraphApiVersion(),
}: {
  mediaId: string;
  accessToken: string;
  graphVersion?: string;
}) => {
  const url = `https://graph.facebook.com/${graphVersion}/${mediaId}`;
  const response = await axios.get(url, { headers: buildAuthHeaders(accessToken), timeout: 30000 });

  return {
    url: response.data?.url || '',
    mimeType: response.data?.mime_type || '',
    sha256: response.data?.sha256 || '',
    fileSize: response.data?.file_size || 0,
  };
};

export const downloadMediaBinary = async ({
  mediaUrl,
  accessToken,
  maxBytes = WHATSAPP_MEDIA_MIRROR_MAX_BYTES,
}: {
  mediaUrl: string;
  accessToken: string;
  maxBytes?: number;
}) => {
  const response = await axios.get(mediaUrl, {
    headers: buildAuthHeaders(accessToken),
    responseType: 'arraybuffer',
    timeout: 60000,
    // axios aborts before an unexpectedly large provider response can consume
    // the remaining heap of a small production instance.
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
  });

  return {
    buffer: Buffer.from(response.data),
    mimeType: response.headers['content-type'] || '',
  };
};

export const uploadBufferToCloudinary = ({
  buffer,
  mimeType = '',
  folder = 'whatsapp_media',
}: {
  buffer: Buffer;
  mimeType?: string;
  folder?: string;
}): Promise<any> =>
  new Promise((resolve, reject) => {
    const isImage = mimeType.startsWith('image/');

    const uploadStream = (cloudinary as any).uploader.upload_stream(
      { folder, resource_type: isImage ? 'image' : 'raw' },
      (error: any, result: any) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });

export const uploadWhatsAppMediaToCloudinary = async ({
  mediaId,
  accessToken,
  graphVersion = getGraphApiVersion(),
  folder = 'whatsapp_media',
}: {
  mediaId: string;
  accessToken: string;
  graphVersion?: string;
  folder?: string;
}) => {
  const metadata = await fetchMediaMetadata({ mediaId, accessToken, graphVersion });
  if (!metadata.url) throw new Error(`Missing media URL for mediaId=${mediaId}`);

  const advertisedSize = Number(metadata.fileSize || 0);
  if (advertisedSize > WHATSAPP_MEDIA_MIRROR_MAX_BYTES) {
    throw new MediaMirrorTooLargeError(advertisedSize);
  }

  const downloaded = await downloadMediaBinary({
    mediaUrl: metadata.url,
    accessToken,
    maxBytes: WHATSAPP_MEDIA_MIRROR_MAX_BYTES,
  });
  if (downloaded.buffer.length > WHATSAPP_MEDIA_MIRROR_MAX_BYTES) {
    throw new MediaMirrorTooLargeError(downloaded.buffer.length);
  }
  const upload = await uploadBufferToCloudinary({
    buffer: downloaded.buffer,
    mimeType: metadata.mimeType || downloaded.mimeType,
    folder,
  });

  return {
    mediaUrl: upload.secure_url,
    // Cloudinary's own identifier for the asset. Persisted on the message
    // because a URL is not a handle: deleting the asset later needs the
    // public_id and the resource type, and deriving them back out of a URL is
    // guesswork the moment a folder or transformation is involved. Without
    // this, pruning a message under the retention policy would leave its
    // media file behind indefinitely — deletion that is not really deletion.
    mediaPublicId: upload.public_id || '',
    mediaResourceType: upload.resource_type || '',
    mimeType: metadata.mimeType || downloaded.mimeType || '',
    provider: 'cloudinary',
    bytes: downloaded.buffer.length,
    metadata,
  };
};
