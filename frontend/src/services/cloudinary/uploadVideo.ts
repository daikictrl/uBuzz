import * as FileSystem from 'expo-file-system/legacy';
import { CloudinaryUploadResponse, UploadOptions } from './cloudinary.types';

export async function uploadVideo(
  videoUri: string,
  options?: UploadOptions
): Promise<CloudinaryUploadResponse> {
  const cloudName = process.env.EXPO_PUBLIC_CLOUD_NAME;
  const presetName = process.env.EXPO_PUBLIC_PRESET_NAME;

  if (!cloudName || !presetName) {
    throw new Error('Cloudinary environment variables (EXPO_PUBLIC_CLOUD_NAME, EXPO_PUBLIC_PRESET_NAME) are not properly configured.');
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  const timeoutMs = options?.timeoutMs || 120000; // 120 seconds default for videos

  let isCompleted = false;
  let timeoutId: NodeJS.Timeout | null = null;

  const uploadTask = FileSystem.createUploadTask(
    url,
    videoUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      parameters: {
        upload_preset: presetName,
      },
    },
    (p) => {
      if (options?.onProgress && p.totalBytesExpectedToSend > 0) {
        const progress = Math.min(
          100,
          Math.max(0, Math.round((p.totalBytesSent / p.totalBytesExpectedToSend) * 100))
        );
        options.onProgress(progress);
      }
    }
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(async () => {
      if (!isCompleted) {
        try {
          await uploadTask.cancelAsync();
        } catch (e) {
          console.warn('[Cloudinary Service] Failed to cancel upload task on timeout:', e);
        }
        reject(new Error(`Cloudinary video upload timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });

  const uploadPromise = (async (): Promise<CloudinaryUploadResponse> => {
    try {
      const result = await uploadTask.uploadAsync();
      isCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);

      if (!result || result.status !== 200) {
        let errorMessage = 'Unknown error';
        if (result?.body) {
          try {
            const parsed = JSON.parse(result.body);
            errorMessage = parsed?.error?.message || result.body;
          } catch {
            errorMessage = result.body;
          }
        }
        throw new Error(`Cloudinary video upload failed: ${errorMessage}`);
      }

      const data = JSON.parse(result.body);

      return {
        secure_url: data.secure_url,
        public_id: data.public_id,
        format: data.format,
        resource_type: data.resource_type,
        bytes: data.bytes,
        duration: data.duration,
        width: data.width,
        height: data.height,
      };
    } catch (error) {
      isCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  })();

  return Promise.race([uploadPromise, timeoutPromise]);
}
