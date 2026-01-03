import * as fs from 'fs';
import * as path from 'path';
import { app, dialog, BrowserWindow } from 'electron';
import { dbService } from './dbService';
import { googlePhotosService } from './googlePhotosService';
import { thumbnailService } from './thumbnailService';

class ImportService {
  private getImagesDirectory(): string {
    const dataDir = path.join(app.getPath('userData'), 'data');
    return path.join(dataDir, 'images');
  }

  private getDataDirectory(): string {
    return path.join(app.getPath('userData'), 'data');
  }

  private ensureDirectoriesExist() {
    const imagesDir = this.getImagesDirectory();
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
  }

  private copyFile(sourcePath: string, destPath: string): void {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, destPath);
  }

  private generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedBase}_${timestamp}${ext}`;
  }

  async importFromLocalFiles(
    filePaths: string[], 
    albumId?: number,
    onProgress?: (current: number, total: number, filename: string) => void
  ): Promise<number[]> {
    this.ensureDirectoriesExist();
    const imagesDir = this.getImagesDirectory();
    const importedImageIds: number[] = [];
    const total = filePaths.length;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.warn(`File not found: ${filePath}`);
          if (onProgress) {
            onProgress(i + 1, total, path.basename(filePath));
          }
          continue;
        }

        // Generate unique filename
        const originalFilename = path.basename(filePath);
        const uniqueFilename = this.generateUniqueFilename(originalFilename);
        const storedPath = path.join('images', uniqueFilename);
        const fullStoredPath = path.join(imagesDir, uniqueFilename);

        // Copy file to storage
        this.copyFile(filePath, fullStoredPath);

        // Generate thumbnail
        const thumbnailPath = await thumbnailService.generateThumbnail(fullStoredPath);

        // Split filename into name and extension
        const extMatch = originalFilename.match(/\.([^.]+)$/);
        const extension = extMatch ? '.' + extMatch[1] : '';
        const filenameWithoutExt = extMatch ? originalFilename.substring(0, originalFilename.length - extMatch[0].length) : originalFilename;

        // Record in database
        const imageId = dbService.insertImage({
          original_path: filePath,
          stored_path: storedPath,
          thumbnail_path: thumbnailPath || undefined,
          filename: filenameWithoutExt,
          extension: extension,
          imported_from: 'local',
        });

        // Add to album if specified
        if (albumId) {
          dbService.addImageToAlbum(imageId, albumId);
        }

        importedImageIds.push(imageId);
        
        // Report progress
        if (onProgress) {
          onProgress(i + 1, total, originalFilename);
        }
      } catch (error) {
        console.error(`Error importing file ${filePath}:`, error);
        if (onProgress) {
          onProgress(i + 1, total, path.basename(filePath));
        }
      }
    }

    return importedImageIds;
  }

  async importFromGooglePhotos(
    albumId?: number,
    onProgress?: (current: number, total: number, filename: string) => void
  ): Promise<number[]> {
    this.ensureDirectoriesExist();
    const imagesDir = this.getImagesDirectory();

    try {
      // Check if already authenticated
      try {
        await googlePhotosService.ensureAuthenticated();
      } catch (authError) {
        // Need to authenticate - prompt for credentials
        if (!BrowserWindow.getAllWindows().length) {
          throw new Error('No window available for authentication');
        }

        const mainWindow = BrowserWindow.getAllWindows()[0];
        const credentialsResult = await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Google Photos Setup',
          message: 'Google Photos integration requires OAuth credentials.',
          detail: 'To use Google Photos import:\n\n1. Create a Google Cloud project\n2. Enable Google Photos Library API\n3. Create OAuth 2.0 credentials\n4. Enter your Client ID and Client Secret',
          buttons: ['Enter Credentials', 'Cancel'],
        });

        if (credentialsResult.response === 0) {
          // For now, we'll use a simple approach - in production, you'd want a proper settings UI
          // This is a basic implementation that requires manual credential entry
          throw new Error('Please configure Google Photos credentials in the application settings. For now, you can manually add credentials to the data/google-credentials.json file with format: {"clientId": "...", "clientSecret": "...", "redirectUri": "http://localhost:PORT/oauth2callback"}');
        } else {
          throw new Error('Authentication cancelled');
        }
      }

      // Fetch media items
      const mediaItems = await googlePhotosService.fetchMediaItems(50);
      
      if (mediaItems.length === 0) {
        return [];
      }

      // Filter to only images
      const imageItems = mediaItems.filter(item => 
        !item.mimeType || item.mimeType.startsWith('image/')
      );
      const total = imageItems.length;
      const importedImageIds: number[] = [];

      // Download and import each item
      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        try {
          // Generate filename
          const originalFilename = item.filename || `google_photo_${item.id}.jpg`;
          const uniqueFilename = this.generateUniqueFilename(originalFilename);
          const storedPath = path.join('images', uniqueFilename);
          const fullStoredPath = path.join(imagesDir, uniqueFilename);

          // Download the image
          await googlePhotosService.downloadMediaItem(item, fullStoredPath);

          // Generate thumbnail
          const thumbnailPath = await thumbnailService.generateThumbnail(fullStoredPath);

          // Split filename into name and extension
          const extMatch = originalFilename.match(/\.([^.]+)$/);
          const extension = extMatch ? '.' + extMatch[1] : '';
          const filenameWithoutExt = extMatch ? originalFilename.substring(0, originalFilename.length - extMatch[0].length) : originalFilename;

          // Record in database
          const imageId = dbService.insertImage({
            original_path: item.baseUrl || '',
            stored_path: storedPath,
            thumbnail_path: thumbnailPath || undefined,
            filename: filenameWithoutExt,
            extension: extension,
            imported_from: 'google_photos',
          });

          // Add to album if specified
          if (albumId) {
            dbService.addImageToAlbum(imageId, albumId);
          }

          importedImageIds.push(imageId);
          
          // Report progress
          if (onProgress) {
            onProgress(i + 1, total, originalFilename);
          }
        } catch (error) {
          console.error(`Error importing Google Photos item ${item.id}:`, error);
          if (onProgress) {
            onProgress(i + 1, total, item.filename || `google_photo_${item.id}.jpg`);
          }
        }
      }

      return importedImageIds;
    } catch (error) {
      console.error('Error importing from Google Photos:', error);
      throw error;
    }
  }
}

export const importService = new ImportService();

