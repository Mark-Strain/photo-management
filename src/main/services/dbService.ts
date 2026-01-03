import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Image, Tag } from '../../shared/types';

class DatabaseService {
  private db: Database | null = null;
  private dbPath: string = '';

  async initialize(dbPath: string) {
    this.dbPath = dbPath;
    
    // Get the correct path to the WASM file
    // In Electron, we need to use app.getAppPath() for reliable path resolution
    let wasmPath: string;
    try {
      const appPath = app.getAppPath();
      wasmPath = path.join(appPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      
      // Fallback to relative path if app.getAppPath() doesn't work
      if (!fs.existsSync(wasmPath)) {
        wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
      }
    } catch (error) {
      // Fallback to relative path
      wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
    }
    
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        return wasmPath;
      }
    });

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      this.createTables();
      this.save();
    }

    // Ensure tables exist (in case of new database)
    this.createTables();
    
    // Migrate existing databases to add thumbnail_path column
    this.migrateDatabase();
  }

  private migrateDatabase() {
    if (!this.db) return;
    
    try {
      const result = this.db.exec("PRAGMA table_info(images)");
      const columns = result[0]?.columns || [];
      const values = result[0]?.values || [];
      const columnIndex = columns.indexOf('name');
      
      // Check if thumbnail_path column exists
      const hasThumbnailPath = values.some((row: any[]) => row[columnIndex] === 'thumbnail_path');
      if (!hasThumbnailPath) {
        this.db.run('ALTER TABLE images ADD COLUMN thumbnail_path TEXT');
        this.save();
      }
      
      // Check if extension column exists
      const hasExtension = values.some((row: any[]) => row[columnIndex] === 'extension');
      if (!hasExtension) {
        this.db.run('ALTER TABLE images ADD COLUMN extension TEXT');
        
        // Migrate existing filenames: split filename into name and extension
        const images = this.getAllImages();
        for (const image of images) {
          const extMatch = image.filename.match(/\.([^.]+)$/);
          const extension = extMatch ? '.' + extMatch[1] : '';
          const filenameWithoutExt = extMatch ? image.filename.substring(0, image.filename.length - extMatch[0].length) : image.filename;
          
          const updateStmt = this.db.prepare('UPDATE images SET filename = ?, extension = ? WHERE id = ?');
          updateStmt.bind([filenameWithoutExt, extension, image.id]);
          updateStmt.step();
          updateStmt.free();
        }
        
        this.save();
      }
    } catch (error) {
      console.error('Error migrating database:', error);
    }
  }

  private createTables() {
    if (!this.db) throw new Error('Database not initialized');

    // Images table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_path TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        extension TEXT NOT NULL DEFAULT '',
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        imported_from TEXT
      )
    `);

    // Tags table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // Image-Tag relationship table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS image_tags (
        image_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (image_id, tag_id),
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Albums table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Album-Image relationship table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS album_images (
        album_id INTEGER,
        image_id INTEGER,
        PRIMARY KEY (album_id, image_id),
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
      )
    `);
  }

  private save() {
    if (!this.db || !this.dbPath) return;
    
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this.dbPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.dbPath, buffer);
  }

  // Image methods
  insertImage(image: Omit<Image, 'id' | 'imported_at'>): number {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO images (original_path, stored_path, thumbnail_path, filename, imported_from)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.bind([
      image.original_path, 
      image.stored_path, 
      image.thumbnail_path || null,
      image.filename, 
      image.imported_from
    ]);
    stmt.step();
    const id = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    stmt.free();
    this.save();
    return id;
  }

  getAllImages(): Image[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM images ORDER BY imported_at DESC');
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj as Image;
    });
  }

  getImageById(id: number): Image | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM images WHERE id = ?');
    stmt.bind([id]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return row as Image;
    }
    
    stmt.free();
    return null;
  }

  updateImageThumbnail(imageId: number, thumbnailPath: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?');
    stmt.bind([thumbnailPath, imageId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  updateImageFilename(imageId: number, filename: string): boolean {
    if (!this.db) throw new Error('Database not initialized');

    // Only update the filename (name part), keep extension unchanged
    const stmt = this.db.prepare('UPDATE images SET filename = ? WHERE id = ?');
    stmt.bind([filename, imageId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  deleteImage(imageId: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    // Delete image-tag relationships first (CASCADE should handle this, but being explicit)
    const deleteTagsStmt = this.db.prepare('DELETE FROM image_tags WHERE image_id = ?');
    deleteTagsStmt.bind([imageId]);
    deleteTagsStmt.step();
    deleteTagsStmt.free();

    // Delete the image record
    const stmt = this.db.prepare('DELETE FROM images WHERE id = ?');
    stmt.bind([imageId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  // Tag methods
  insertTag(name: string): number {
    if (!this.db) throw new Error('Database not initialized');

    // Try to insert
    const insertStmt = this.db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    insertStmt.bind([name]);
    insertStmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    insertStmt.free();
    
    if (changes === 0) {
      // Tag already exists, get its ID
      const getStmt = this.db.prepare('SELECT id FROM tags WHERE name = ?');
      getStmt.bind([name]);
      getStmt.step();
      const row = getStmt.getAsObject();
      getStmt.free();
      return row.id as number;
    }
    
    // Get the inserted ID
    const idResult = this.db.exec('SELECT last_insert_rowid() as id');
    const id = idResult[0].values[0][0] as number;
    this.save();
    return id;
  }

  getTagByName(name: string): Tag | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM tags WHERE name = ?');
    stmt.bind([name]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return row as Tag;
    }
    
    stmt.free();
    return null;
  }

  getAllTags(): Tag[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM tags ORDER BY name');
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj as Tag;
    });
  }

  getUsedTags(): Tag[] {
    if (!this.db) throw new Error('Database not initialized');

    // Get only tags that are attached to at least one image
    const result = this.db.exec(`
      SELECT DISTINCT t.* FROM tags t
      INNER JOIN image_tags it ON t.id = it.tag_id
      ORDER BY t.name
    `);
    
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj as Tag;
    });
  }

  // Image-Tag relationship methods
  addImageTag(imageId: number, tagId: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)
    `);
    stmt.bind([imageId, tagId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  removeImageTag(imageId: number, tagId: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?
    `);
    stmt.bind([imageId, tagId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  getImageTags(imageId: number): Tag[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
      ORDER BY t.name
    `);
    stmt.bind([imageId]);
    
    const tags: Tag[] = [];
    while (stmt.step()) {
      tags.push(stmt.getAsObject() as any as Tag);
    }
    stmt.free();
    
    return tags;
  }

  getImagesByTags(tagIds: number[]): Image[] {
    if (!this.db) throw new Error('Database not initialized');
    if (tagIds.length === 0) return [];

    const placeholders = tagIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT DISTINCT i.* FROM images i
      INNER JOIN image_tags it ON i.id = it.image_id
      WHERE it.tag_id IN (${placeholders})
      ORDER BY i.imported_at DESC
    `);
    stmt.bind(tagIds);
    
    const images: Image[] = [];
    while (stmt.step()) {
      images.push(stmt.getAsObject() as any as Image);
    }
    stmt.free();
    
    return images;
  }

  // Album methods
  insertAlbum(name: string): number {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('INSERT OR IGNORE INTO albums (name) VALUES (?)');
    stmt.bind([name]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes === 0) {
      // Album already exists, get its ID
      const getStmt = this.db.prepare('SELECT id FROM albums WHERE name = ?');
      getStmt.bind([name]);
      getStmt.step();
      const row = getStmt.getAsObject();
      getStmt.free();
      return row.id as number;
    }
    
    const idResult = this.db.exec('SELECT last_insert_rowid() as id');
    const id = idResult[0].values[0][0] as number;
    this.save();
    return id;
  }

  getAllAlbums(): any[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT * FROM albums ORDER BY name');
    if (result.length === 0) return [];
    
    const columns = result[0].columns;
    const values = result[0].values;
    
    return values.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  getAlbumById(id: number): any | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM albums WHERE id = ?');
    stmt.bind([id]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return row;
    }
    
    stmt.free();
    return null;
  }

  addImageToAlbum(imageId: number, albumId: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO album_images (album_id, image_id) VALUES (?, ?)
    `);
    stmt.bind([albumId, imageId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  getImagesByAlbum(albumId: number): Image[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT i.* FROM images i
      INNER JOIN album_images ai ON i.id = ai.image_id
      WHERE ai.album_id = ?
      ORDER BY i.imported_at DESC
    `);
    stmt.bind([albumId]);
    
    const images: Image[] = [];
    while (stmt.step()) {
      images.push(stmt.getAsObject() as any as Image);
    }
    stmt.free();
    
    return images;
  }

  getAlbumsByImage(imageId: number): any[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT a.* FROM albums a
      INNER JOIN album_images ai ON a.id = ai.album_id
      WHERE ai.image_id = ?
      ORDER BY a.name
    `);
    stmt.bind([imageId]);
    
    const albums: any[] = [];
    while (stmt.step()) {
      albums.push(stmt.getAsObject() as any);
    }
    stmt.free();
    
    return albums;
  }

  getImagesNotInAnyAlbum(): Image[] {
    if (!this.db) throw new Error('Database not initialized');

    // Get images that don't have any album associations
    const stmt = this.db.prepare(`
      SELECT i.* FROM images i
      LEFT JOIN album_images ai ON i.id = ai.image_id
      WHERE ai.image_id IS NULL
      ORDER BY i.imported_at DESC
    `);
    
    const images: Image[] = [];
    while (stmt.step()) {
      images.push(stmt.getAsObject() as any as Image);
    }
    stmt.free();
    
    return images;
  }

  removeImageFromAlbum(imageId: number, albumId: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM album_images WHERE image_id = ? AND album_id = ?
    `);
    stmt.bind([imageId, albumId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  removeAllImagesFromAlbum(albumId: number): number {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      DELETE FROM album_images WHERE album_id = ?
    `);
    stmt.bind([albumId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes;
  }

  deleteAlbum(albumId: number): boolean {
    if (!this.db) throw new Error('Database not initialized');

    // First, remove all image associations (CASCADE should handle this, but being explicit)
    this.removeAllImagesFromAlbum(albumId);

    // Delete the album record
    const stmt = this.db.prepare('DELETE FROM albums WHERE id = ?');
    stmt.bind([albumId]);
    stmt.step();
    const changes = this.db.exec('SELECT changes() as changes')[0].values[0][0] as number;
    stmt.free();
    
    if (changes > 0) {
      this.save();
    }
    
    return changes > 0;
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

export const dbService = new DatabaseService();
