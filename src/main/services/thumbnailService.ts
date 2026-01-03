import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import sharp from 'sharp';

class ThumbnailService {
  private getThumbnailsDirectory(): string {
    const dataDir = path.join(app.getPath('userData'), 'data');
    return path.join(dataDir, 'thumbnails');
  }

  private ensureThumbnailsDirectoryExists() {
    const thumbnailsDir = this.getThumbnailsDirectory();
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }
  }

  private getThumbnailPath(imageFilename: string): string {
    // Use the same filename but in thumbnails directory
    const ext = path.extname(imageFilename);
    const baseName = path.basename(imageFilename, ext);
    return path.join('thumbnails', `${baseName}_thumb.jpg`);
  }

  async generateThumbnail(sourceImagePath: string, maxWidth: number = 300, maxHeight: number = 300): Promise<string | null> {
    try {
      this.ensureThumbnailsDirectoryExists();
      
      if (!fs.existsSync(sourceImagePath)) {
        console.warn(`Source image not found: ${sourceImagePath}`);
        return null;
      }

      const imageFilename = path.basename(sourceImagePath);
      const thumbnailPath = this.getThumbnailPath(imageFilename);
      const fullThumbnailPath = path.join(this.getThumbnailsDirectory(), path.basename(thumbnailPath));

      // Check if thumbnail already exists
      if (fs.existsSync(fullThumbnailPath)) {
        return thumbnailPath;
      }

      // Use Sharp to resize the image
      await sharp(sourceImagePath)
        .resize(maxWidth, maxHeight, {
          fit: 'cover',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(fullThumbnailPath);

      return thumbnailPath;
    } catch (error) {
      console.error(`Error generating thumbnail for ${sourceImagePath}:`, error);
      return null;
    }
  }

  getFullThumbnailPath(thumbnailPath: string): string {
    const dataDir = path.join(app.getPath('userData'), 'data');
    return path.join(dataDir, thumbnailPath);
  }
}

export const thumbnailService = new ThumbnailService();

