import { contextBridge, ipcRenderer } from 'electron';
import { Image, Tag, Album } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Import methods
  importFromFiles: (albumId?: number) => ipcRenderer.invoke('import:from-files', albumId),
  importFromFolder: (albumId?: number) => ipcRenderer.invoke('import:from-folder', albumId),
  importFromGooglePhotos: (albumId?: number) => ipcRenderer.invoke('import:from-google-photos', albumId),
  onImportProgress: (callback: (progress: { current: number; total: number; filename: string; type: string }) => void) => {
    ipcRenderer.on('import:progress', (_, progress) => callback(progress));
  },
  removeImportProgressListener: () => {
    ipcRenderer.removeAllListeners('import:progress');
  },
  
  // Image methods
  getAllImages: () => ipcRenderer.invoke('images:get-all'),
  getImageById: (id: number) => ipcRenderer.invoke('images:get-by-id', id),
  getAllImagesWithTags: () => ipcRenderer.invoke('images:get-all-with-tags'),
  deleteImage: (id: number) => ipcRenderer.invoke('images:delete', id),
  renameImage: (id: number, newFilename: string) => ipcRenderer.invoke('images:rename', id, newFilename),
  bulkDeleteImages: (imageIds: number[]) => ipcRenderer.invoke('images:bulk-delete', imageIds),
  
  // Tag methods
  getAllTags: () => ipcRenderer.invoke('tags:get-all'),
  getUsedTags: () => ipcRenderer.invoke('tags:get-used'),
  createTag: (name: string) => ipcRenderer.invoke('tags:create', name),
  addTagToImage: (imageId: number, tagId: number) => 
    ipcRenderer.invoke('tags:add-to-image', imageId, tagId),
  removeTagFromImage: (imageId: number, tagId: number) => 
    ipcRenderer.invoke('tags:remove-from-image', imageId, tagId),
  getImageTags: (imageId: number) => ipcRenderer.invoke('tags:get-by-image', imageId),
  
  // Search methods
  searchByTags: (tagIds: number[]) => ipcRenderer.invoke('search:by-tags', tagIds),
  
  // Export methods
  exportImagesAsZip: (imageIds: number[]) => ipcRenderer.invoke('export:images-as-zip', imageIds),
  
  // Album methods
  getAllAlbums: () => ipcRenderer.invoke('albums:get-all'),
  createAlbum: (name: string) => ipcRenderer.invoke('albums:create', name),
  getAlbumImages: (albumId: number) => ipcRenderer.invoke('albums:get-images', albumId),
  getUnassignedImages: () => ipcRenderer.invoke('albums:get-unassigned-images'),
  addImageToAlbum: (imageId: number, albumId: number) => ipcRenderer.invoke('albums:add-image', imageId, albumId),
  getImageAlbums: (imageId: number) => ipcRenderer.invoke('albums:get-by-image', imageId),
  deleteAlbum: (albumId: number, deletePhotos: boolean) => ipcRenderer.invoke('albums:delete', albumId, deletePhotos),
  
  // Utility methods
  getImagePath: (storedPath: string) => ipcRenderer.invoke('utils:get-image-path', storedPath),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      importFromFiles: (albumId?: number) => Promise<{ success: boolean; count?: number; imageIds?: number[]; error?: string }>;
      importFromFolder: (albumId?: number) => Promise<{ success: boolean; count?: number; imageIds?: number[]; error?: string }>;
      importFromGooglePhotos: (albumId?: number) => Promise<{ success: boolean; count?: number; imageIds?: number[]; error?: string }>;
      getAllImages: () => Promise<Image[]>;
      getImageById: (id: number) => Promise<Image | null>;
      getAllImagesWithTags: () => Promise<any[]>;
      deleteImage: (id: number) => Promise<{ success: boolean; error?: string }>;
      renameImage: (id: number, newFilename: string) => Promise<{ success: boolean; error?: string }>;
      bulkDeleteImages: (imageIds: number[]) => Promise<{ success: boolean; deletedCount?: number; failedCount?: number; errors?: string[]; error?: string }>;
      getAllTags: () => Promise<Tag[]>;
      getUsedTags: () => Promise<Tag[]>;
      createTag: (name: string) => Promise<Tag>;
      addTagToImage: (imageId: number, tagId: number) => Promise<boolean>;
      removeTagFromImage: (imageId: number, tagId: number) => Promise<boolean>;
      getImageTags: (imageId: number) => Promise<Tag[]>;
      searchByTags: (tagIds: number[]) => Promise<Image[]>;
      exportImagesAsZip: (imageIds: number[]) => Promise<{ success: boolean; error?: string; filePath?: string }>;
      getAllAlbums: () => Promise<Album[]>;
      createAlbum: (name: string) => Promise<Album>;
      getAlbumImages: (albumId: number) => Promise<any[]>;
      getUnassignedImages: () => Promise<any[]>;
      addImageToAlbum: (imageId: number, albumId: number) => Promise<boolean>;
      getImageAlbums: (imageId: number) => Promise<Album[]>;
      deleteAlbum: (albumId: number, deletePhotos: boolean) => Promise<{ success: boolean; error?: string }>;
      getImagePath: (storedPath: string) => Promise<string>;
      onImportProgress: (callback: (progress: { current: number; total: number; filename: string; type: string }) => void) => void;
      removeImportProgressListener: () => void;
    };
  }
}

