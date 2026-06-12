import { uploadImage } from './uploadImage';
import { uploadVideo } from './uploadVideo';
import { CloudinaryUploadResponse, UploadOptions } from './cloudinary.types';

export async function uploadMedia(
  uri: string,
  resourceType: 'image' | 'video',
  options?: UploadOptions
): Promise<CloudinaryUploadResponse> {
  if (resourceType === 'video') {
    return uploadVideo(uri, options);
  } else {
    return uploadImage(uri, options);
  }
}
