import { dbService } from './dbService';
import { Tag } from '../../shared/types';

class TagService {
  createTag(name: string): Tag {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Tag name cannot be empty');
    }

    const tagId = dbService.insertTag(trimmedName);
    const tag = dbService.getTagByName(trimmedName);
    
    if (!tag) {
      throw new Error('Failed to create tag');
    }

    return tag;
  }

  addTagToImage(imageId: number, tagId: number): boolean {
    // Verify image exists
    const image = dbService.getImageById(imageId);
    if (!image) {
      throw new Error(`Image with id ${imageId} not found`);
    }

    // Verify tag exists
    const tags = dbService.getAllTags();
    const tag = tags.find(t => t.id === tagId);
    if (!tag) {
      throw new Error(`Tag with id ${tagId} not found`);
    }

    return dbService.addImageTag(imageId, tagId);
  }

  removeTagFromImage(imageId: number, tagId: number): boolean {
    return dbService.removeImageTag(imageId, tagId);
  }

  getImageTags(imageId: number): Tag[] {
    return dbService.getImageTags(imageId);
  }

  getAllTags(): Tag[] {
    return dbService.getAllTags();
  }
}

export const tagService = new TagService();

