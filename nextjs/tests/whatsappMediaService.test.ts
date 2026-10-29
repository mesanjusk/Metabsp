import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';

const uploadStream = vi.hoisted(() => vi.fn());
vi.mock('@/lib/utils/cloudinary', () => ({
  default: { uploader: { upload_stream: uploadStream } },
}));

import { uploadBufferToCloudinary } from '@/lib/services/whatsappMediaService';

describe('WhatsApp media mirroring', () => {
  beforeEach(() => {
    uploadStream.mockReset();
    uploadStream.mockImplementation((options, callback) => {
      const sink = new Writable({
        write(_chunk, _encoding, done) { done(); },
      });
      sink.on('finish', () => callback(null, {
        public_id: 'whatsapp_media/test',
        secure_url: 'https://res.cloudinary.com/example/test',
        resource_type: options.resource_type,
      }));
      return sink;
    });
  });

  it.each([
    ['audio/ogg; codecs=opus', 'video'],
    ['audio/mpeg', 'video'],
    ['video/mp4', 'video'],
    ['image/jpeg', 'image'],
    ['application/pdf', 'raw'],
  ])('uploads %s with Cloudinary resource_type %s', async (mimeType, resourceType) => {
    await expect(uploadBufferToCloudinary({
      buffer: Buffer.from('media bytes'),
      mimeType,
    })).resolves.toMatchObject({ resource_type: resourceType });
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'whatsapp_media', resource_type: resourceType }),
      expect.any(Function)
    );
  });
});
