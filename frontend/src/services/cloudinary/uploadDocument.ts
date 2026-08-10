import { CloudinaryUploadResponse, UploadOptions } from './cloudinary.types';

export async function uploadDocument(
  fileUri: string,
  fileName: string,
  options?: UploadOptions
): Promise<CloudinaryUploadResponse> {
  const cloudName = process.env.EXPO_PUBLIC_CLOUD_NAME;
  const presetName = process.env.EXPO_PUBLIC_PRESET_NAME;

  if (!cloudName || !presetName) {
    throw new Error('Cloudinary environment variables (EXPO_PUBLIC_CLOUD_NAME, EXPO_PUBLIC_PRESET_NAME) are not properly configured.');
  }

  // Raw file upload endpoint for non-media attachments in Cloudinary
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: 'application/octet-stream',
    name: fileName,
  } as any);
  formData.append('upload_preset', presetName);

  const timeoutMs = options?.timeoutMs || 60000; // 60 seconds timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = null;
      }
      const message = parsedError?.error?.message || errorText || `HTTP ${response.status}`;
      throw new Error(`Cloudinary document upload failed: ${message}`);
    }

    const data = await response.json();

    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      resource_type: data.resource_type,
      bytes: data.bytes,
      width: 0,
      height: 0,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Cloudinary document upload timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}
