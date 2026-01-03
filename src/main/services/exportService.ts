import * as fs from 'fs';
import * as path from 'path';
import { app, dialog, BrowserWindow } from 'electron';
import AdmZip from 'adm-zip';
import { dbService } from './dbService';

class ExportService {
  private getDataDirectory(): string {
    return path.join(app.getPath('userData'), 'data');
  }

  async exportImagesAsZip(imageIds: number[], window: BrowserWindow | null): Promise<{ success: boolean; error?: string; filePath?: string }> {
    if (!window) {
      return { success: false, error: 'Window not available' };
    }

    if (imageIds.length === 0) {
      return { success: false, error: 'No images to export' };
    }

    try {
      // Show save dialog
      const result = await dialog.showSaveDialog(window, {
        title: 'Export Images as ZIP',
        defaultPath: 'exported-photos.zip',
        filters: [
          { name: 'ZIP Files', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'User canceled' };
      }

      const zipPath = result.filePath;
      const dataDir = this.getDataDirectory();
      const zip = new AdmZip();

      // Track filenames to handle duplicates
      const filenameCounts = new Map<string, number>();

      // Add each image to the ZIP
      for (const imageId of imageIds) {
        const image = dbService.getImageById(imageId);
        if (!image) {
          console.warn(`Image with id ${imageId} not found, skipping`);
          continue;
        }

        const imagePath = path.join(dataDir, image.stored_path);
        if (fs.existsSync(imagePath)) {
          // Get extension - use from database, or extract from stored_path as fallback
          let extension = image.extension;
          
          // Handle null, undefined, or empty string
          if (!extension || extension === 'null' || extension === 'undefined') {
            // Fallback: extract extension from stored_path
            extension = path.extname(image.stored_path);
          }
          
          // Ensure extension starts with a dot if it exists and is not empty
          if (extension && extension.length > 0 && !extension.startsWith('.')) {
            extension = '.' + extension;
          }
          
          // If still no extension, try to get it from the actual file path
          if (!extension || extension.length === 0) {
            extension = path.extname(imagePath);
          }
          
          // Combine filename and extension
          const fullFilename = image.filename + (extension || '');
          
          // Handle duplicate filenames by adding a number suffix
          let zipFilename = fullFilename;
          const count = filenameCounts.get(fullFilename) || 0;
          if (count > 0) {
            zipFilename = `${image.filename}_${count}${extension}`;
          }
          filenameCounts.set(fullFilename, count + 1);

          // Read file and add to ZIP with the processed filename
          const fileBuffer = fs.readFileSync(imagePath);
          zip.addFile(zipFilename, fileBuffer);
        } else {
          console.warn(`Image file not found: ${imagePath}, skipping`);
        }
      }

      // Write ZIP file
      zip.writeZip(zipPath);

      return { success: true, filePath: zipPath };
    } catch (error) {
      console.error('Error exporting images:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const exportService = new ExportService();

