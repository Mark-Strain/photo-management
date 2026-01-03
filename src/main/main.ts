import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { dbService } from './services/dbService';
import { importService } from './services/importService';
import { tagService } from './services/tagService';
import { searchService } from './services/searchService';
import { thumbnailService } from './services/thumbnailService';
import { imageService } from './services/imageService';
import { albumService } from './services/albumService';
import { exportService } from './services/exportService';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  const htmlPath = path.join(__dirname, '../renderer/index.html');
  
  // Verify paths exist
  if (!fs.existsSync(preloadPath)) {
    console.error('Preload script not found at:', preloadPath);
  }
  if (!fs.existsSync(htmlPath)) {
    console.error('HTML file not found at:', htmlPath);
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app
  mainWindow.loadFile(htmlPath).catch((error) => {
    console.error('Failed to load HTML file:', error);
    dialog.showErrorBox('Load Error', `Failed to load application: ${error.message}`);
  });
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  
  // Log any renderer process errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
}

// Initialize database and data directories
async function initializeApp() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const imagesDir = path.join(dataDir, 'images');
  
  // Create directories if they don't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  // Initialize database
  const dbPath = path.join(dataDir, 'database.db');
  await dbService.initialize(dbPath);
}

// IPC Handlers

// Helper function to recursively find all image files in a directory
function findImageFiles(dirPath: string, fileList: string[] = []): string[] {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively search subdirectories
        findImageFiles(fullPath, fileList);
      } else if (stat.isFile()) {
        // Check if file has an image extension (case-insensitive)
        const ext = path.extname(item).toLowerCase();
        if (imageExtensions.includes(ext)) {
          fileList.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return fileList;
}

// Import handlers
ipcMain.handle('import:from-files', async (_, albumId?: number) => {
  if (!mainWindow) return { success: false, error: 'Window not available' };
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
    ],
    title: 'Select image files to import',
  });
  
  if (result.canceled) {
    return { success: false, error: 'User canceled' };
  }
  
  if (result.filePaths.length === 0) {
    return { success: false, error: 'No files selected' };
  }
  
  try {
    const imageIds = await importService.importFromLocalFiles(
      result.filePaths, 
      albumId,
      (current, total, filename) => {
        // Send progress update to renderer
        if (mainWindow) {
          mainWindow.webContents.send('import:progress', {
            current,
            total,
            filename,
            type: 'local'
          });
        }
      }
    );
    return { success: true, count: imageIds.length, imageIds };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('import:from-folder', async (_, albumId?: number) => {
  if (!mainWindow) return { success: false, error: 'Window not available' };
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select folder to import photos from',
  });
  
  if (result.canceled) {
    return { success: false, error: 'User canceled' };
  }
  
  if (result.filePaths.length === 0) {
    return { success: false, error: 'No folder selected' };
  }
  
  const selectedFolder = result.filePaths[0];
  
  try {
    // Recursively find all image files in the selected folder
    const imageFiles = findImageFiles(selectedFolder);
    
    if (imageFiles.length === 0) {
      return { success: false, error: 'No image files found in the selected folder' };
    }
    
    const imageIds = await importService.importFromLocalFiles(
      imageFiles, 
      albumId,
      (current, total, filename) => {
        // Send progress update to renderer
        if (mainWindow) {
          mainWindow.webContents.send('import:progress', {
            current,
            total,
            filename,
            type: 'local'
          });
        }
      }
    );
    return { success: true, count: imageIds.length, imageIds };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('import:from-google-photos', async (_, albumId?: number) => {
  if (!mainWindow) return { success: false, error: 'Window not available' };
  
  try {
    const imageIds = await importService.importFromGooglePhotos(
      albumId,
      (current, total, filename) => {
        // Send progress update to renderer
        if (mainWindow) {
          mainWindow.webContents.send('import:progress', {
            current,
            total,
            filename,
            type: 'google'
          });
        }
      }
    );
    return { success: true, count: imageIds.length, imageIds };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Image handlers
ipcMain.handle('images:get-all', async () => {
  return dbService.getAllImages();
});

ipcMain.handle('images:get-by-id', async (_, id: number) => {
  return dbService.getImageById(id);
});

ipcMain.handle('images:delete', async (_, id: number) => {
  try {
    const deleted = await imageService.deleteImage(id);
    return { success: deleted };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('images:rename', async (_, id: number, newFilename: string) => {
  try {
    const updated = dbService.updateImageFilename(id, newFilename);
    return { success: updated };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('images:bulk-delete', async (_, imageIds: number[]) => {
  try {
    const result = await imageService.deleteImages(imageIds);
    return { success: true, deletedCount: result.success, failedCount: result.failed, errors: result.errors };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('images:get-all-with-tags', async () => {
  const images = dbService.getAllImages();
  const dataDir = path.join(app.getPath('userData'), 'data');
  
  // Batch get all tags and albums for all images
  return images.map(image => {
    const imagePath = path.join(dataDir, image.stored_path);
    const thumbnailPath = image.thumbnail_path 
      ? path.join(dataDir, image.thumbnail_path)
      : null;
    const tags = dbService.getImageTags(image.id);
    const albums = dbService.getAlbumsByImage(image.id);
    return {
      ...image,
      fullPath: imagePath,
      thumbnailPath: thumbnailPath,
      tags: tags,
      albums: albums
    };
  });
});

// Tag handlers
ipcMain.handle('tags:get-all', async () => {
  return dbService.getAllTags();
});

ipcMain.handle('tags:get-used', async () => {
  return dbService.getUsedTags();
});

ipcMain.handle('tags:create', async (_, name: string) => {
  return tagService.createTag(name);
});

ipcMain.handle('tags:add-to-image', async (_, imageId: number, tagId: number) => {
  return tagService.addTagToImage(imageId, tagId);
});

ipcMain.handle('tags:remove-from-image', async (_, imageId: number, tagId: number) => {
  return tagService.removeTagFromImage(imageId, tagId);
});

ipcMain.handle('tags:get-by-image', async (_, imageId: number) => {
  return dbService.getImageTags(imageId);
});

// Album handlers
ipcMain.handle('albums:get-all', async () => {
  return albumService.getAllAlbums();
});

ipcMain.handle('albums:create', async (_, name: string) => {
  return albumService.createAlbum(name);
});

ipcMain.handle('albums:get-images', async (_, albumId: number) => {
  const images = albumService.getImagesByAlbum(albumId);
  const dataDir = path.join(app.getPath('userData'), 'data');
  
  return images.map(image => {
    const imagePath = path.join(dataDir, image.stored_path);
    const thumbnailPath = image.thumbnail_path 
      ? path.join(dataDir, image.thumbnail_path)
      : null;
    const tags = dbService.getImageTags(image.id);
    return {
      ...image,
      fullPath: imagePath,
      thumbnailPath: thumbnailPath,
      tags: tags
    };
  });
});

ipcMain.handle('albums:add-image', async (_, imageId: number, albumId: number) => {
  return albumService.addImageToAlbum(imageId, albumId);
});

ipcMain.handle('albums:get-by-image', async (_, imageId: number) => {
  return albumService.getAlbumsByImage(imageId);
});

ipcMain.handle('albums:get-unassigned-images', async () => {
  const images = albumService.getImagesNotInAnyAlbum();
  const dataDir = path.join(app.getPath('userData'), 'data');
  
  return images.map(image => {
    const imagePath = path.join(dataDir, image.stored_path);
    const thumbnailPath = image.thumbnail_path 
      ? path.join(dataDir, image.thumbnail_path)
      : null;
    const tags = dbService.getImageTags(image.id);
    return {
      ...image,
      fullPath: imagePath,
      thumbnailPath: thumbnailPath,
      tags: tags
    };
  });
});

ipcMain.handle('albums:delete', async (_, albumId: number, deletePhotos: boolean) => {
  try {
    const deleted = await albumService.deleteAlbum(albumId, deletePhotos);
    return { success: deleted };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Search handlers
ipcMain.handle('search:by-tags', async (_, tagIds: number[]) => {
  const images = searchService.searchByTags(tagIds);
  const dataDir = path.join(app.getPath('userData'), 'data');
  
  // Return images with tags and paths for better performance
  return images.map(image => {
    const imagePath = path.join(dataDir, image.stored_path);
    const thumbnailPath = image.thumbnail_path 
      ? path.join(dataDir, image.thumbnail_path)
      : null;
    const tags = dbService.getImageTags(image.id);
    return {
      ...image,
      fullPath: imagePath,
      thumbnailPath: thumbnailPath,
      tags: tags
    };
  });
});

// Export handlers
ipcMain.handle('export:images-as-zip', async (_, imageIds: number[]) => {
  return await exportService.exportImagesAsZip(imageIds, mainWindow);
});

// Utility handlers
ipcMain.handle('utils:get-image-path', async (_, storedPath: string) => {
  // Return the full path to the image file
  const dataDir = path.join(app.getPath('userData'), 'data');
  return path.join(dataDir, storedPath);
});

ipcMain.handle('utils:generate-missing-thumbnails', async () => {
  // Generate thumbnails for images that don't have them
  const images = dbService.getAllImages();
  const dataDir = path.join(app.getPath('userData'), 'data');
  let generated = 0;
  
  for (const image of images) {
    if (!image.thumbnail_path) {
      const fullImagePath = path.join(dataDir, image.stored_path);
      const thumbnailPath = await thumbnailService.generateThumbnail(fullImagePath);
      
      if (thumbnailPath) {
        dbService.updateImageThumbnail(image.id, thumbnailPath);
        generated++;
      }
    }
  }
  
  return { generated };
});

app.whenReady().then(async () => {
  try {
    await initializeApp();
    createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Show error dialog
    dialog.showErrorBox('Initialization Error', `Failed to initialize application: ${error instanceof Error ? error.message : String(error)}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

