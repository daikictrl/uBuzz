export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  resource_type: 'image' | 'video';
  bytes: number;
  duration?: number;
  width: number;
  height: number;
}

export interface UploadOptions {
  onProgress?: (progress: number) => void;
  timeoutMs?: number;
}
