import { dbService } from './dbService';
import { imageService } from './imageService';
import { Album } from '../../shared/types';

class AlbumService {
  createAlbum(name: string): Album {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Album name cannot be empty');
    }

    const albumId = dbService.insertAlbum(trimmedName);
    const album = dbService.getAlbumById(albumId);
    
    if (!album) {
      throw new Error('Failed to create album');
    }

    return album as Album;
  }

  getAllAlbums(): Album[] {
    return dbService.getAllAlbums() as Album[];
  }

  addImageToAlbum(imageId: number, albumId: number): boolean {
    // Verify image exists
    const image = dbService.getImageById(imageId);
    if (!image) {
      throw new Error(`Image with id ${imageId} not found`);
    }

    // Verify album exists
    const albums = dbService.getAllAlbums();
    const album = albums.find(a => a.id === albumId);
    if (!album) {
      throw new Error(`Album with id ${albumId} not found`);
    }

    return dbService.addImageToAlbum(imageId, albumId);
  }

  removeImageFromAlbum(imageId: number, albumId: number): boolean {
    return dbService.removeImageFromAlbum(imageId, albumId);
  }

  getImagesByAlbum(albumId: number) {
    return dbService.getImagesByAlbum(albumId);
  }

  getAlbumsByImage(imageId: number): Album[] {
    return dbService.getAlbumsByImage(imageId) as Album[];
  }

  getImagesNotInAnyAlbum() {
    return dbService.getImagesNotInAnyAlbum();
  }

  async deleteAlbum(albumId: number, deletePhotos: boolean): Promise<boolean> {
    // Verify album exists
    const album = dbService.getAlbumById(albumId);
    if (!album) {
      throw new Error(`Album with id ${albumId} not found`);
    }

    // Get all images in the album
    const images = dbService.getImagesByAlbum(albumId);

    if (deletePhotos) {
      // Delete all photos in the album
      for (const image of images) {
        await imageService.deleteImage(image.id);
      }
    } else {
      // Just remove the album associations (unassign photos)
      dbService.removeAllImagesFromAlbum(albumId);
    }

    // Delete the album record
    return dbService.deleteAlbum(albumId);
  }
}

export const albumService = new AlbumService();

