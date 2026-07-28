import axios from 'axios';
import { Readable } from 'stream';
import cloudinary from '../utils/cloudinary';
import { getGraphApiVersion } from '../config/graphApi';

// Ported from backend/src/services/whatsappMediaService.js.

const buildAuthHeaders = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

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

export const downloadMediaBinary = async ({ mediaUrl, accessToken }: { mediaUrl: string; accessToken: string }) => {
  const response = await axios.get(mediaUrl, {
    headers: buildAuthHeaders(accessToken),
    responseType: 'arraybuffer',
    timeout: 60000,
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

  const downloaded = await downloadMediaBinary({ mediaUrl: metadata.url, accessToken });
  const upload = await uploadBufferToCloudinary({
    buffer: downloaded.buffer,
    mimeType: metadata.mimeType || downloaded.mimeType,
    folder,
  });

  return {
    mediaUrl: upload.secure_url,
    mimeType: metadata.mimeType || downloaded.mimeType || '',
    provider: 'cloudinary',
    bytes: downloaded.buffer.length,
    metadata,
  };
};
