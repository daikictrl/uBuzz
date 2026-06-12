import { CloudinaryUploadResponse, UploadOptions } from './cloudinary.types';

export async function uploadImage(
  imageUri: string,
  options?: UploadOptions
): Promise<CloudinaryUploadResponse> {
  const cloudName = process.env.EXPO_PUBLIC_CLOUD_NAME;
  const presetName = process.env.EXPO_PUBLIC_PRESET_NAME;

  if (!cloudName || !presetName) {
    throw new Error('Cloudinary environment variables (EXPO_PUBLIC_CLOUD_NAME, EXPO_PUBLIC_PRESET_NAME) are not properly configured.');
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const fileExt = imageUri.split('.').pop() || 'jpg';
  const type = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

  const formData = new FormData();
  // In React Native, FormData requires an object with uri, type, and name for files
  formData.append('file', {
    uri: imageUri,
    type,
    name: `upload.${fileExt}`,
  } as any);
  formData.append('upload_preset', presetName);

  const timeoutMs = options?.timeoutMs || 30000; // 30 seconds default for images
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
      throw new Error(`Cloudinary image upload failed: ${message}`);
    }

    const data = await response.json();

    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      format: data.format,
      resource_type: data.resource_type,
      bytes: data.bytes,
      width: data.width,
      height: data.height,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Cloudinary image upload timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}
