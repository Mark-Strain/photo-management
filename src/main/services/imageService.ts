import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { dbService } from './dbService';

class ImageService {
  private getDataDirectory(): string {
    return path.join(app.getPath('userData'), 'data');
  }

  async deleteImage(imageId: number): Promise<boolean> {
    // Get image info before deleting from database
    const image = dbService.getImageById(imageId);
    if (!image) {
      throw new Error(`Image with id ${imageId} not found`);
    }

    const dataDir = this.getDataDirectory();
    
    // Delete the full image file
    const fullImagePath = path.join(dataDir, image.stored_path);
    if (fs.existsSync(fullImagePath)) {
      try {
        fs.unlinkSync(fullImagePath);
      } catch (error) {
        console.error(`Error deleting image file ${fullImagePath}:`, error);
        // Continue even if file deletion fails
      }
    }

    // Delete the thumbnail file if it exists
    if (image.thumbnail_path) {
      const fullThumbnailPath = path.join(dataDir, image.thumbnail_path);
      if (fs.existsSync(fullThumbnailPath)) {
        try {
          fs.unlinkSync(fullThumbnailPath);
        } catch (error) {
          console.error(`Error deleting thumbnail file ${fullThumbnailPath}:`, error);
          // Continue even if thumbnail deletion fails
        }
      }
    }

    // Delete from database (this will cascade delete image_tags relationships)
    const deleted = dbService.deleteImage(imageId);
    
    return deleted;
  }

  async deleteImages(imageIds: number[]): Promise<{ success: number; failed: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const imageId of imageIds) {
      try {
        const deleted = await this.deleteImage(imageId);
        if (deleted) {
          successCount++;
        } else {
          failedCount++;
          errors.push(`Image ${imageId}: Failed to delete`);
        }
      } catch (error) {
        failedCount++;
        errors.push(`Image ${imageId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success: successCount, failed: failedCount, errors };
  }
}

export const imageService = new ImageService();

