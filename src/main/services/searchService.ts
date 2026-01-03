import { dbService } from './dbService';
import { Image } from '../../shared/types';

class SearchService {
  searchByTags(tagIds: number[]): Image[] {
    if (tagIds.length === 0) {
      // Return all images if no tags selected
      return dbService.getAllImages();
    }

    // Get images that have ANY of the selected tags (OR logic)
    // Returns all images that contain at least one of the selected tags
    return dbService.getImagesByTags(tagIds);
  }
}

export const searchService = new SearchService();

