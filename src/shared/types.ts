export interface Image {
  id: number;
  original_path: string;
  stored_path: string;
  thumbnail_path?: string;
  filename: string; // Name without extension
  extension: string; // File extension (e.g., '.jpg', '.png')
  imported_at: string;
  imported_from: 'local' | 'google_photos';
  tags?: Tag[];
}

export interface Tag {
  id: number;
  name: string;
}

export interface Album {
  id: number;
  name: string;
  created_at: string;
}

export interface ImageWithTags extends Image {
  tags: Tag[];
}

