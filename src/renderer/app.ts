import './styles.css';
import { Image, Tag, Album } from '../shared/types';

// State
let allImages: Image[] = [];
let allTags: Tag[] = [];
let allAlbums: Album[] = [];
let selectedTags: Tag[] = [];
let currentImageId: number | null = null;
let currentAlbumId: number | null = null;
let currentSearchResults: Image[] = [];
let selectedImageIds: Set<number> = new Set();
let currentModalImageList: Image[] = [];
let currentModalImageIndex: number = -1;

// DOM Elements
const gallerySection = document.getElementById('gallery-section')!;
const searchSection = document.getElementById('search-section')!;

const importFilesBtn = document.getElementById('import-files-btn')!;
const importFolderBtn = document.getElementById('import-folder-btn')!;
const importGoogleBtn = document.getElementById('import-google-btn')!;
const importStatus = document.getElementById('import-status')!;
const importProgressContainer = document.getElementById('import-progress-container')!;
const importProgressBar = document.getElementById('import-progress-bar')!;
const importProgressText = document.getElementById('import-progress-text')!;

const galleryGrid = document.getElementById('gallery-grid')!;
const albumsGrid = document.getElementById('albums-grid')!;
const galleryStatus = document.getElementById('gallery-status')!;
const galleryTitle = document.getElementById('gallery-title')!;
const backToAlbumsBtn = document.getElementById('back-to-albums-btn')!;
const bulkDeleteBtn = document.getElementById('bulk-delete-btn')!;
const selectAllBtn = document.getElementById('select-all-btn')!;
const deselectAllBtn = document.getElementById('deselect-all-btn')!;
const searchBulkDeleteBtn = document.getElementById('search-bulk-delete-btn')!;
const searchSelectAllBtn = document.getElementById('search-select-all-btn')!;
const searchDeselectAllBtn = document.getElementById('search-deselect-all-btn')!;
const searchResultsHeader = document.querySelector('.search-results-header') as HTMLElement;

// Album selection elements
const albumSelect = document.getElementById('album-select') as HTMLSelectElement;
const createAlbumBtn = document.getElementById('create-album-btn')!;
const newAlbumInputContainer = document.getElementById('new-album-input-container')!;
const newAlbumNameInput = document.getElementById('new-album-name') as HTMLInputElement;
const confirmAlbumBtn = document.getElementById('confirm-album-btn')!;
const cancelAlbumBtn = document.getElementById('cancel-album-btn')!;

const tagList = document.getElementById('tag-list')!;
const tagInput = document.getElementById('tag-input') as HTMLInputElement;
const tagSuggestions = document.getElementById('tag-suggestions')!;
const selectedTagsContainer = document.getElementById('selected-tags')!;
const searchBtn = document.getElementById('search-btn')!;
const clearSearchBtn = document.getElementById('clear-search-btn')!;
const searchResults = document.getElementById('search-results')!;
const searchStatus = document.getElementById('search-status')!;
const exportResultsBtn = document.getElementById('export-results-btn')!;

const imageModal = document.getElementById('image-modal')!;
const modalImage = document.getElementById('modal-image') as HTMLImageElement;
const modalFilename = document.getElementById('modal-filename')!;
const modalTags = document.getElementById('modal-tags')!;
const modalTagInput = document.getElementById('modal-tag-input') as HTMLInputElement;
const modalTagSuggestions = document.getElementById('modal-tag-suggestions')!;
const modalDeleteBtn = document.getElementById('modal-delete-btn')!;
const modalClose = document.querySelector('.modal-close')!;
const modalPrevBtn = document.getElementById('modal-prev-btn')!;
const modalNextBtn = document.getElementById('modal-next-btn')!;

// Bulk delete preview modal elements
const bulkDeletePreviewModal = document.getElementById('bulk-delete-preview-modal')!;
const previewImagesGrid = document.getElementById('preview-images-grid')!;
const previewCount = document.getElementById('preview-count')!;
const previewCancelBtn = document.getElementById('preview-cancel-btn')!;
const previewDeleteBtn = document.getElementById('preview-delete-btn')!;
const previewModalClose = document.getElementById('preview-modal-close')!;

// Tab Navigation
document.querySelectorAll('.nav-button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const button = e.target as HTMLElement;
    const tabId = button.id.replace('-tab', '-section');
    
    // Update active tab
    document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    
    // Update active section
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    
    // Load data for active section
    if (tabId === 'gallery-section') {
      loadGallery();
    } else if (tabId === 'search-section') {
      loadTagsForSearch();
    }
  });
});

// Import section toggle
const importSection = document.querySelector('.gallery-import-section')!;
const toggleImportBtn = document.getElementById('toggle-import-section')!;
const importSectionHeader = document.querySelector('.import-section-header')!;

function toggleImportSection() {
  importSection.classList.toggle('collapsed');
}

toggleImportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleImportSection();
});

importSectionHeader.addEventListener('click', (e) => {
  // Toggle when clicking on the header, but not on the button (which has its own handler)
  if (e.target !== toggleImportBtn && !toggleImportBtn.contains(e.target as Node)) {
    toggleImportSection();
  }
});

// Search section toggle
const searchSectionElement = document.querySelector('.search-options-section')!;
const toggleSearchBtn = document.getElementById('toggle-search-section')!;
const searchSectionHeader = document.querySelector('.search-section-header')!;

function toggleSearchSection() {
  searchSectionElement.classList.toggle('collapsed');
}

toggleSearchBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSearchSection();
});

searchSectionHeader.addEventListener('click', (e) => {
  // Toggle when clicking on the header, but not on buttons (which have their own handlers)
  const target = e.target as HTMLElement;
  if (target !== toggleSearchBtn && 
      !toggleSearchBtn.contains(target) && 
      target !== exportResultsBtn && 
      !exportResultsBtn.contains(target)) {
    toggleSearchSection();
  }
});

// Album selection handlers
createAlbumBtn.addEventListener('click', () => {
  newAlbumInputContainer.style.display = 'flex';
  newAlbumNameInput.focus();
});

confirmAlbumBtn.addEventListener('click', async () => {
  const albumName = newAlbumNameInput.value.trim();
  if (!albumName) {
    alert('Please enter an album name');
    return;
  }
  
  try {
    const album = await window.electronAPI.createAlbum(albumName);
    allAlbums.push(album);
    await loadAlbums();
    albumSelect.value = album.id.toString();
    newAlbumInputContainer.style.display = 'none';
    newAlbumNameInput.value = '';
  } catch (error) {
    alert(`Error creating album: ${error}`);
  }
});

cancelAlbumBtn.addEventListener('click', () => {
  newAlbumInputContainer.style.display = 'none';
  newAlbumNameInput.value = '';
});

// Import Handlers
async function handleImport(importFunction: (albumId?: number) => Promise<{ success: boolean; count?: number; imageIds?: number[]; error?: string }>, button: HTMLElement, buttonText: string) {
  (button as HTMLButtonElement).disabled = true;
  button.textContent = 'Importing...';
  importProgressContainer.style.display = 'block';
  importProgressBar.style.width = '0%';
  importProgressText.textContent = 'Starting import...';
  hideStatus(importStatus);
  
  // Remove any existing listeners first
  window.electronAPI.removeImportProgressListener();
  
  // Set up progress listener
  window.electronAPI.onImportProgress((progress) => {
    const percentage = Math.round((progress.current / progress.total) * 100);
    importProgressBar.style.width = `${percentage}%`;
    importProgressText.textContent = `Importing ${progress.current} of ${progress.total}: ${progress.filename}`;
  });
  
  try {
    const selectedAlbumId = albumSelect.value ? parseInt(albumSelect.value) : undefined;
    const result = await importFunction(selectedAlbumId);
    
    // Remove progress listener
    window.electronAPI.removeImportProgressListener();
    
    if (result.success) {
      importProgressBar.style.width = '100%';
      importProgressText.textContent = 'Import complete!';
      showStatus(importStatus, `Successfully imported ${result.count} image(s)`, 'success');
      if (gallerySection.classList.contains('active')) {
        if (currentAlbumId) {
          await loadAlbumImages(currentAlbumId);
        } else {
          await loadGallery();
        }
      }
      // Hide progress after a short delay
      setTimeout(() => {
        importProgressContainer.style.display = 'none';
      }, 2000);
    } else {
      importProgressContainer.style.display = 'none';
      showStatus(importStatus, result.error || 'Import failed', 'error');
    }
  } catch (error) {
    window.electronAPI.removeImportProgressListener();
    importProgressContainer.style.display = 'none';
    showStatus(importStatus, `Error: ${error}`, 'error');
  } finally {
    (button as HTMLButtonElement).disabled = false;
    button.textContent = buttonText;
  }
}

importFilesBtn.addEventListener('click', async () => {
  await handleImport(window.electronAPI.importFromFiles, importFilesBtn, 'Import Files');
});

importFolderBtn.addEventListener('click', async () => {
  await handleImport(window.electronAPI.importFromFolder, importFolderBtn, 'Import Folder');
});

importGoogleBtn.addEventListener('click', async () => {
  (importGoogleBtn as HTMLButtonElement).disabled = true;
  importGoogleBtn.textContent = 'Importing...';
  importProgressContainer.style.display = 'block';
  importProgressBar.style.width = '0%';
  importProgressText.textContent = 'Starting import from Google Photos...';
  hideStatus(importStatus);
  
  // Remove any existing listeners first
  window.electronAPI.removeImportProgressListener();
  
  // Set up progress listener
  window.electronAPI.onImportProgress((progress) => {
    const percentage = Math.round((progress.current / progress.total) * 100);
    importProgressBar.style.width = `${percentage}%`;
    importProgressText.textContent = `Importing ${progress.current} of ${progress.total}: ${progress.filename}`;
  });
  
  try {
    const selectedAlbumId = albumSelect.value ? parseInt(albumSelect.value) : undefined;
    const result = await window.electronAPI.importFromGooglePhotos(selectedAlbumId);
    
    // Remove progress listener
    window.electronAPI.removeImportProgressListener();
    
    if (result.success) {
      importProgressBar.style.width = '100%';
      importProgressText.textContent = 'Import complete!';
      showStatus(importStatus, `Successfully imported ${result.count} image(s) from Google Photos`, 'success');
      if (gallerySection.classList.contains('active')) {
        if (currentAlbumId) {
          await loadAlbumImages(currentAlbumId);
        } else {
          await loadGallery();
        }
      }
      // Hide progress after a short delay
      setTimeout(() => {
        importProgressContainer.style.display = 'none';
      }, 2000);
    } else {
      importProgressContainer.style.display = 'none';
      showStatus(importStatus, result.error || 'Import failed', 'error');
    }
  } catch (error) {
    window.electronAPI.removeImportProgressListener();
    importProgressContainer.style.display = 'none';
    showStatus(importStatus, `Error: ${error}`, 'error');
  } finally {
    (importGoogleBtn as HTMLButtonElement).disabled = false;
    importGoogleBtn.textContent = 'Import from Google Photos';
  }
});

// Album Functions
async function loadAlbums() {
  try {
    allAlbums = await window.electronAPI.getAllAlbums();
    
    // Update album select dropdown
    albumSelect.innerHTML = '<option value="">-- No Album --</option>';
    allAlbums.forEach(album => {
      const option = document.createElement('option');
      option.value = album.id.toString();
      option.textContent = album.name;
      albumSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading albums:', error);
  }
}

async function renderAlbums() {
  albumsGrid.innerHTML = '';
  galleryGrid.innerHTML = '';
  
  const allImages = await window.electronAPI.getAllImagesWithTags();
  const unassignedImages = await window.electronAPI.getUnassignedImages();
  
  // Add "All Photos" option first
  const allPhotosItem = document.createElement('div');
  allPhotosItem.className = 'album-item';
  
  if (allImages.length > 0) {
    const img = document.createElement('img');
    const imageSrc = allImages[0].thumbnailPath 
      ? `file://${allImages[0].thumbnailPath}`
      : (allImages[0].fullPath ? `file://${allImages[0].fullPath}` : '');
    if (imageSrc) {
      img.src = imageSrc;
    }
    img.alt = 'All Photos';
    img.onerror = () => {
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999">No image</text></svg>';
    };
    allPhotosItem.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'album-placeholder';
    placeholder.innerHTML = '📷';
    allPhotosItem.appendChild(placeholder);
  }
  
  const allPhotosInfo = document.createElement('div');
  allPhotosInfo.className = 'album-item-info';
  
  const allPhotosName = document.createElement('div');
  allPhotosName.className = 'album-item-name';
  allPhotosName.textContent = 'All Photos';
  
  const allPhotosCount = document.createElement('div');
  allPhotosCount.className = 'album-item-count';
  allPhotosCount.textContent = `${allImages.length} photo${allImages.length !== 1 ? 's' : ''}`;
  
  allPhotosInfo.appendChild(allPhotosName);
  allPhotosInfo.appendChild(allPhotosCount);
  allPhotosItem.appendChild(allPhotosInfo);
  
  allPhotosItem.addEventListener('click', async () => {
    currentAlbumId = null;
    albumsGrid.style.display = 'none';
    galleryGrid.style.display = 'grid';
    backToAlbumsBtn.style.display = 'block';
    galleryTitle.textContent = 'All Photos';
    selectedImageIds.clear();
    updateSelectionUI();
    await renderImagesToContainer(allImages, galleryGrid);
    if (allImages.length === 0) {
      showStatus(galleryStatus, 'No images found.', 'error');
    } else {
      hideStatus(galleryStatus);
    }
  });
  
  albumsGrid.appendChild(allPhotosItem);
  
  // Add "Unassigned Photos" option (always show, even if empty)
  const unassignedItem = document.createElement('div');
  unassignedItem.className = 'album-item';
  
  if (unassignedImages.length > 0) {
    const img = document.createElement('img');
    const imageSrc = unassignedImages[0].thumbnailPath 
      ? `file://${unassignedImages[0].thumbnailPath}`
      : (unassignedImages[0].fullPath ? `file://${unassignedImages[0].fullPath}` : '');
    if (imageSrc) {
      img.src = imageSrc;
    }
    img.alt = 'Unassigned Photos';
    img.onerror = () => {
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999">No image</text></svg>';
    };
    unassignedItem.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'album-placeholder';
    placeholder.innerHTML = '📷';
    unassignedItem.appendChild(placeholder);
  }
  
  const unassignedInfo = document.createElement('div');
  unassignedInfo.className = 'album-item-info';
  
  const unassignedName = document.createElement('div');
  unassignedName.className = 'album-item-name';
  unassignedName.textContent = 'Unassigned Photos';
  
  const unassignedCount = document.createElement('div');
  unassignedCount.className = 'album-item-count';
  unassignedCount.textContent = `${unassignedImages.length} photo${unassignedImages.length !== 1 ? 's' : ''}`;
  
  unassignedInfo.appendChild(unassignedName);
  unassignedInfo.appendChild(unassignedCount);
  unassignedItem.appendChild(unassignedInfo);
  
    unassignedItem.addEventListener('click', async () => {
      currentAlbumId = null;
      albumsGrid.style.display = 'none';
      galleryGrid.style.display = 'grid';
      backToAlbumsBtn.style.display = 'block';
      galleryTitle.textContent = 'Unassigned Photos';
      selectedImageIds.clear();
      updateSelectionUI();
      await renderImagesToContainer(unassignedImages, galleryGrid);
      if (unassignedImages.length === 0) {
        showStatus(galleryStatus, 'No unassigned photos.', 'error');
      } else {
        hideStatus(galleryStatus);
      }
    });
  
  albumsGrid.appendChild(unassignedItem);
  
  // Add regular albums
  for (const album of allAlbums) {
    const albumItem = document.createElement('div');
    albumItem.className = 'album-item';
    
    // Get first image from album for thumbnail
    const images = await window.electronAPI.getAlbumImages(album.id);
    if (images.length > 0) {
      const img = document.createElement('img');
      const imageSrc = images[0].thumbnailPath 
        ? `file://${images[0].thumbnailPath}`
        : (images[0].fullPath ? `file://${images[0].fullPath}` : '');
      if (imageSrc) {
        img.src = imageSrc;
      }
      img.alt = album.name;
      img.onerror = () => {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999">No image</text></svg>';
      };
      albumItem.appendChild(img);
    } else {
      // Placeholder for empty album
      const placeholder = document.createElement('div');
      placeholder.className = 'album-placeholder';
      placeholder.innerHTML = '📁';
      albumItem.appendChild(placeholder);
    }
    
    const info = document.createElement('div');
    info.className = 'album-item-info';
    
    const name = document.createElement('div');
    name.className = 'album-item-name';
    name.textContent = album.name;
    
    const count = document.createElement('div');
    count.className = 'album-item-count';
    count.textContent = `${images.length} photo${images.length !== 1 ? 's' : ''}`;
    
    info.appendChild(name);
    info.appendChild(count);
    albumItem.appendChild(info);
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'album-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete album';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent album click event
      await handleDeleteAlbum(album.id, album.name, images.length);
    });
    albumItem.appendChild(deleteBtn);
    
    albumItem.addEventListener('click', () => {
      currentAlbumId = album.id;
      loadAlbumImages(album.id);
    });
    
    albumsGrid.appendChild(albumItem);
  }
}

async function loadAlbumImages(albumId: number) {
  try {
    const imagesWithData = await window.electronAPI.getAlbumImages(albumId);
    albumsGrid.style.display = 'none';
    galleryGrid.style.display = 'grid';
    backToAlbumsBtn.style.display = 'block';
    
    // Clear selection when loading album
    selectedImageIds.clear();
    updateSelectionUI();
    
    const album = allAlbums.find(a => a.id === albumId);
    galleryTitle.textContent = album ? `Album: ${album.name}` : 'Album';
    
    await renderImagesToContainer(imagesWithData, galleryGrid);
    if (imagesWithData.length === 0) {
      showStatus(galleryStatus, 'No images in this album.', 'error');
    } else {
      hideStatus(galleryStatus);
    }
  } catch (error) {
    showStatus(galleryStatus, `Error loading album: ${error}`, 'error');
  }
}

async function handleDeleteAlbum(albumId: number, albumName: string, photoCount: number) {
  let deletePhotos = false;
  
  if (photoCount > 0) {
    // First, confirm album deletion
    if (!confirm(`Delete album "${albumName}"?\n\nThis album contains ${photoCount} photo${photoCount !== 1 ? 's' : ''}.`)) {
      return; // User canceled
    }
    
    // Then ask what to do with photos
    const deleteChoice = confirm(
      `What would you like to do with the ${photoCount} photo${photoCount !== 1 ? 's' : ''} in this album?\n\n` +
      `Click OK to DELETE the photos (this cannot be undone).\n` +
      `Click Cancel to UNASSIGN the photos from the album (photos will be kept).`
    );
    
    if (deleteChoice) {
      // User wants to delete photos - double confirmation
      if (!confirm(`Are you sure you want to DELETE ${photoCount} photo${photoCount !== 1 ? 's' : ''}? This action cannot be undone.`)) {
        return; // User canceled
      }
      deletePhotos = true;
    } else {
      // User wants to unassign photos
      deletePhotos = false;
    }
  } else {
    // Empty album, just confirm deletion
    if (!confirm(`Delete album "${albumName}"?`)) {
      return; // User canceled
    }
  }
  
  try {
    const result = await window.electronAPI.deleteAlbum(albumId, deletePhotos);
    if (result.success) {
      // Remove from local state
      allAlbums = allAlbums.filter(a => a.id !== albumId);
      
      // If we're currently viewing this album, go back to albums view
      if (currentAlbumId === albumId) {
        currentAlbumId = null;
        await loadGallery();
      } else {
        // Refresh albums view
        await renderAlbums();
      }
      
      // If photos were deleted, refresh gallery if it's showing all photos
      if (deletePhotos && gallerySection.classList.contains('active') && currentAlbumId === null) {
        await loadGallery();
      }
      
      // Refresh album select dropdown
      await loadAlbums();
    } else {
      alert(`Error deleting album: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error deleting album:', error);
    alert(`Error deleting album: ${error}`);
  }
}

// Gallery Functions
async function loadGallery() {
  try {
    currentAlbumId = null;
    albumsGrid.style.display = 'grid';
    galleryGrid.style.display = 'none';
    backToAlbumsBtn.style.display = 'none';
    galleryTitle.textContent = 'Photo Gallery';
    
    // Always show albums grid with "All Photos" and "Unassigned Photos" cards
    await renderAlbums();
    hideStatus(galleryStatus);
  } catch (error) {
    showStatus(galleryStatus, `Error loading gallery: ${error}`, 'error');
  }
}

backToAlbumsBtn.addEventListener('click', () => {
  selectedImageIds.clear();
  updateSelectionUI();
  loadGallery();
});

// Selection management
function toggleImageSelection(imageId: number) {
  if (selectedImageIds.has(imageId)) {
    selectedImageIds.delete(imageId);
  } else {
    selectedImageIds.add(imageId);
  }
  updateSelectionUI();
}

function selectAllImages(container: HTMLElement) {
  const items = container.querySelectorAll('.gallery-item') as NodeListOf<HTMLElement>;
  items.forEach(item => {
    const imageId = parseInt(item.getAttribute('data-image-id') || '0');
    if (imageId > 0) {
      selectedImageIds.add(imageId);
      const checkbox = item.querySelector('.gallery-item-checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = true;
      }
    }
  });
  updateSelectionUI();
}

function deselectAllImages() {
  selectedImageIds.clear();
  const checkboxes = document.querySelectorAll('.gallery-item-checkbox') as NodeListOf<HTMLInputElement>;
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selectedImageIds.size;
  const isGalleryView = gallerySection.classList.contains('active') && galleryGrid.style.display !== 'none';
  const isSearchView = searchSection.classList.contains('active');
  
  if (isGalleryView) {
    if (count > 0) {
      bulkDeleteBtn.style.display = 'inline-block';
      selectAllBtn.style.display = 'inline-block';
      deselectAllBtn.style.display = 'inline-block';
      bulkDeleteBtn.textContent = `Delete Selected (${count})`;
    } else {
      bulkDeleteBtn.style.display = 'none';
      selectAllBtn.style.display = 'none';
      deselectAllBtn.style.display = 'none';
    }
  }
  
  if (isSearchView) {
    if (count > 0) {
      searchResultsHeader.style.display = 'block';
      searchBulkDeleteBtn.textContent = `Delete Selected (${count})`;
    } else {
      searchResultsHeader.style.display = 'none';
    }
  }
  
  // Update checkbox states
  const checkboxes = document.querySelectorAll('.gallery-item-checkbox') as NodeListOf<HTMLInputElement>;
  checkboxes.forEach(checkbox => {
    const imageId = parseInt(checkbox.closest('.gallery-item')?.getAttribute('data-image-id') || '0');
    checkbox.checked = selectedImageIds.has(imageId);
  });
}

// Lazy loading with Intersection Observer
let imageObserver: IntersectionObserver | null = null;

function createImageObserver() {
  if (imageObserver) return imageObserver;
  
  imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
          img.src = dataSrc;
          img.removeAttribute('data-src');
          imageObserver!.unobserve(img);
        }
      }
    });
  }, {
    rootMargin: '50px' // Start loading 50px before image is visible
  });
  
  return imageObserver;
}

async function renderImagesToContainer(images: any[], container: HTMLElement) {
  container.innerHTML = '';
  
  if (images.length === 0) return;
  
  const observer = createImageObserver();
  
  // Batch render in chunks to avoid blocking the UI
  const BATCH_SIZE = 20;
  let currentIndex = 0;
  
  const renderBatch = () => {
    const endIndex = Math.min(currentIndex + BATCH_SIZE, images.length);
    const fragment = document.createDocumentFragment();
    
    for (let i = currentIndex; i < endIndex; i++) {
      const image = images[i];
      const item = document.createElement('div');
      item.className = 'gallery-item';
      
      // Add checkbox for selection
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'gallery-item-checkbox';
      checkbox.checked = selectedImageIds.has(image.id);
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening modal when clicking checkbox
        toggleImageSelection(image.id);
      });
      item.appendChild(checkbox);
      
      const img = document.createElement('img');
      // Use thumbnail for gallery view, fallback to full image if no thumbnail
      // Use data-src for lazy loading
      const imageSrc = image.thumbnailPath 
        ? `file://${image.thumbnailPath}`
        : (image.fullPath ? `file://${image.fullPath}` : '');
      if (imageSrc) {
        img.setAttribute('data-src', imageSrc);
      }
      const fullFilename = getFullFilename(image);
      img.alt = fullFilename;
      img.loading = 'lazy'; // Native lazy loading as fallback
      img.onerror = () => {
        img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999">Image not found</text></svg>';
      };
      
      const info = document.createElement('div');
      info.className = 'gallery-item-info';
      
      const filename = document.createElement('div');
      filename.className = 'gallery-item-filename';
      filename.textContent = fullFilename;
      
      const tags = document.createElement('div');
      tags.className = 'gallery-item-tags';
      
      // Tags are already loaded in the batch call, or load them if not
      if (image.tags && image.tags.length > 0) {
        image.tags.forEach((tag: Tag) => {
          const tagSpan = document.createElement('span');
          tagSpan.className = 'tag';
          tagSpan.textContent = tag.name;
          tags.appendChild(tagSpan);
        });
      }
      
      info.appendChild(filename);
      info.appendChild(tags);
      
      // Show albums in "All Photos" view (when currentAlbumId is null)
      if (currentAlbumId === null && image.albums && image.albums.length > 0) {
        const albums = document.createElement('div');
        albums.className = 'gallery-item-albums';
        image.albums.forEach((album: Album) => {
          const albumSpan = document.createElement('span');
          albumSpan.className = 'album-badge';
          albumSpan.textContent = album.name;
          albums.appendChild(albumSpan);
        });
        info.appendChild(albums);
      }
      
      item.appendChild(img);
      item.appendChild(info);
      item.setAttribute('data-image-id', image.id.toString());
      
      item.addEventListener('click', (e) => {
        // Don't open modal if clicking on checkbox
        if ((e.target as HTMLElement).classList.contains('gallery-item-checkbox')) {
          return;
        }
        openImageModal(image.id);
      });
      fragment.appendChild(item);
      
      // Observe the image for lazy loading
      observer.observe(img);
    }
    
    container.appendChild(fragment);
    currentIndex = endIndex;
    
    // Continue with next batch if there are more images
    if (currentIndex < images.length) {
      // Use requestAnimationFrame to allow UI to update between batches
      requestAnimationFrame(renderBatch);
    }
  };
  
  // Start rendering
  renderBatch();
}

// Search Functions
async function loadTagsForSearch() {
  try {
    // Only load tags that are actually attached to images
    allTags = await window.electronAPI.getUsedTags();
    renderTagList();
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

function renderTagList() {
  tagList.innerHTML = '';
  
  if (allTags.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'tag-list-empty';
    emptyMessage.textContent = 'No tags available. Add tags to images to search by them.';
    tagList.appendChild(emptyMessage);
    return;
  }
  
  allTags.forEach(tag => {
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';
    tagItem.textContent = tag.name;
    
    tagItem.addEventListener('click', () => {
      addSelectedTag(tag);
    });
    
    tagList.appendChild(tagItem);
  });
}

function addSelectedTag(tag: Tag) {
  if (!selectedTags.find(t => t.id === tag.id)) {
    selectedTags.push(tag);
    renderSelectedTags();
  }
}

function removeSelectedTag(tagId: number) {
  selectedTags = selectedTags.filter(t => t.id !== tagId);
  renderSelectedTags();
}

function renderSelectedTags() {
  selectedTagsContainer.innerHTML = '';
  selectedTags.forEach(tag => {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'tag';
    tagSpan.innerHTML = `${tag.name} <span style="cursor: pointer; margin-left: 4px;">×</span>`;
    tagSpan.addEventListener('click', () => removeSelectedTag(tag.id));
    selectedTagsContainer.appendChild(tagSpan);
  });
}

// Tag input with autocomplete
tagInput.addEventListener('input', () => {
  const query = tagInput.value.toLowerCase().trim();
  if (query.length === 0) {
    tagSuggestions.classList.remove('active');
    return;
  }
  
  const filtered = allTags.filter(tag => 
    tag.name.toLowerCase().includes(query) && 
    !selectedTags.find(st => st.id === tag.id)
  );
  
  if (filtered.length > 0) {
    tagSuggestions.innerHTML = '';
    filtered.forEach(tag => {
      const suggestion = document.createElement('div');
      suggestion.className = 'tag-suggestion';
      suggestion.textContent = tag.name;
      suggestion.addEventListener('click', () => {
        addSelectedTag(tag);
        tagInput.value = '';
        tagSuggestions.classList.remove('active');
      });
      tagSuggestions.appendChild(suggestion);
    });
    tagSuggestions.classList.add('active');
  } else {
    tagSuggestions.classList.remove('active');
  }
});

tagInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && tagInput.value.trim()) {
    e.preventDefault();
    const tagName = tagInput.value.trim();
    try {
      const tag = await window.electronAPI.createTag(tagName);
      allTags.push(tag);
      addSelectedTag(tag);
      tagInput.value = '';
      tagSuggestions.classList.remove('active');
      renderTagList();
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  }
});

// Search button
searchBtn.addEventListener('click', async () => {
  (searchBtn as HTMLButtonElement).disabled = true;
  searchBtn.textContent = 'Searching...';
  const tagIds = selectedTags.map(t => t.id);
  try {
    const results = await window.electronAPI.searchByTags(tagIds);
    searchResults.innerHTML = '';
    currentSearchResults = results;
    
    if (results.length === 0) {
      showStatus(searchStatus, 'No images found with selected tags.', 'error');
      exportResultsBtn.style.display = 'none';
      (searchBtn as HTMLButtonElement).disabled = false;
      searchBtn.textContent = 'Search';
      return;
    }
    
    hideStatus(searchStatus);
    selectedImageIds.clear();
    await renderImagesToContainer(results, searchResults);
    exportResultsBtn.style.display = 'block';
    updateSelectionUI();
    
    if (results.length === 0) {
      showStatus(searchStatus, 'No images found with selected tags.', 'error');
    } else {
      hideStatus(searchStatus);
    }
  } catch (error) {
    showStatus(searchStatus, `Error searching: ${error}`, 'error');
    exportResultsBtn.style.display = 'none';
  } finally {
    (searchBtn as HTMLButtonElement).disabled = false;
    searchBtn.textContent = 'Search';
  }
});

clearSearchBtn.addEventListener('click', () => {
  selectedTags = [];
  renderSelectedTags();
  searchResults.innerHTML = '';
  tagInput.value = '';
  tagSuggestions.classList.remove('active');
  hideStatus(searchStatus);
  currentSearchResults = [];
  exportResultsBtn.style.display = 'none';
  selectedImageIds.clear();
  updateSelectionUI();
});

// Bulk delete handlers
async function showBulkDeletePreview() {
  if (selectedImageIds.size === 0) {
    alert('No images selected.');
    return;
  }

  // Get all images that are currently displayed (for preview)
  let allDisplayedImages: any[] = [];
  
  if (gallerySection.classList.contains('active') && galleryGrid.style.display === 'grid') {
    // Get images from current gallery view
    if (currentAlbumId !== null) {
      allDisplayedImages = await window.electronAPI.getAlbumImages(currentAlbumId);
    } else {
      const title = galleryTitle.textContent || '';
      if (title === 'All Photos') {
        allDisplayedImages = await window.electronAPI.getAllImagesWithTags();
      } else if (title === 'Unassigned Photos') {
        allDisplayedImages = await window.electronAPI.getUnassignedImages();
      }
    }
  } else if (searchSection.classList.contains('active')) {
    allDisplayedImages = currentSearchResults;
  }

  // Filter to only show selected images
  const selectedImages = allDisplayedImages.filter(img => selectedImageIds.has(img.id));
  
  // Update preview count
  previewCount.textContent = selectedImages.length.toString();
  
  // Render preview images
  previewImagesGrid.innerHTML = '';
  selectedImages.forEach(image => {
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-image-item';
    previewItem.setAttribute('data-image-id', image.id.toString());
    
    if (selectedImageIds.has(image.id)) {
      previewItem.classList.add('selected');
    }
    
    const img = document.createElement('img');
    const imageSrc = image.thumbnailPath 
      ? `file://${image.thumbnailPath}`
      : (image.fullPath ? `file://${image.fullPath}` : '');
    if (imageSrc) {
      img.src = imageSrc;
    }
    const fullFilename = getFullFilename(image);
    img.alt = fullFilename;
    img.onerror = () => {
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999">Image not found</text></svg>';
    };
    
    const overlay = document.createElement('div');
    overlay.className = 'preview-image-overlay';
    const checkmark = document.createElement('div');
    checkmark.className = 'preview-checkmark';
    checkmark.innerHTML = '✓';
    overlay.appendChild(checkmark);
    
    previewItem.appendChild(img);
    previewItem.appendChild(overlay);
    
    previewItem.addEventListener('click', () => {
      toggleImageSelection(image.id);
      // Update preview to reflect current selection
      if (selectedImageIds.has(image.id)) {
        previewItem.classList.add('selected');
      } else {
        previewItem.classList.remove('selected');
      }
      previewCount.textContent = selectedImageIds.size.toString();
    });
    
    previewImagesGrid.appendChild(previewItem);
  });
  
  // Show modal
  bulkDeletePreviewModal.classList.add('active');
}

async function handleBulkDelete(container: HTMLElement, statusElement: HTMLElement) {
  if (selectedImageIds.size === 0) {
    alert('No images selected.');
    return;
  }

  const imageIds = Array.from(selectedImageIds);
  
  try {
    const result = await window.electronAPI.bulkDeleteImages(imageIds);
    
    if (result.success) {
      const successCount = result.deletedCount || 0;
      const failedCount = result.failedCount || 0;
      
      // Clear all selections since images are deleted
      selectedImageIds.clear();
      updateSelectionUI();
      
      if (failedCount > 0) {
        showStatus(statusElement, `Deleted ${successCount} image${successCount !== 1 ? 's' : ''}, ${failedCount} failed.`, 'error');
      } else {
        showStatus(statusElement, `Successfully deleted ${successCount} image${successCount !== 1 ? 's' : ''}.`, 'success');
      }
      
      // Refresh the current view while preserving the current level
      if (gallerySection.classList.contains('active')) {
        // Check if we're viewing images (not albums)
        const isViewingImages = galleryGrid.style.display === 'grid' && albumsGrid.style.display === 'none';
        
        if (isViewingImages) {
          // We're in a photo view, preserve the current view
          if (currentAlbumId !== null) {
            // Viewing an album - reload that album
            await loadAlbumImages(currentAlbumId);
          } else {
            // Check which view we're in based on title
            const title = galleryTitle.textContent || '';
            if (title === 'All Photos') {
              // Refresh "All Photos" view
              const allImages = await window.electronAPI.getAllImagesWithTags();
              selectedImageIds.clear();
              updateSelectionUI();
              await renderImagesToContainer(allImages, galleryGrid);
              if (allImages.length === 0) {
                showStatus(galleryStatus, 'No images found.', 'error');
              } else {
                hideStatus(galleryStatus);
              }
            } else if (title === 'Unassigned Photos') {
              // Refresh "Unassigned Photos" view
              const unassignedImages = await window.electronAPI.getUnassignedImages();
              selectedImageIds.clear();
              updateSelectionUI();
              await renderImagesToContainer(unassignedImages, galleryGrid);
              if (unassignedImages.length === 0) {
                showStatus(galleryStatus, 'No unassigned photos.', 'error');
              } else {
                hideStatus(galleryStatus);
              }
            } else {
              // Fallback to albums view if we can't determine
              await loadGallery();
            }
          }
        } else {
          // We're in albums view (root level), stay there
          await loadGallery();
        }
      } else if (searchSection.classList.contains('active')) {
        // Re-run search to refresh results
        const tagIds = selectedTags.map(t => t.id);
        if (tagIds.length > 0) {
          searchBtn.click();
        } else {
          searchResults.innerHTML = '';
          selectedImageIds.clear();
          updateSelectionUI();
        }
      }
      
      // Ensure UI is updated after refresh
      updateSelectionUI();
      
      // Clear search results if active
      if (searchSection.classList.contains('active')) {
        await loadTagsForSearch();
      }
    } else {
      alert(`Error deleting images: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error deleting images:', error);
    alert(`Error deleting images: ${error}`);
  }
}

bulkDeleteBtn.addEventListener('click', () => {
  showBulkDeletePreview();
});

searchBulkDeleteBtn.addEventListener('click', () => {
  showBulkDeletePreview();
});

// Preview modal handlers
previewCancelBtn.addEventListener('click', () => {
  bulkDeletePreviewModal.classList.remove('active');
  // Keep selections as they are
});

previewModalClose.addEventListener('click', () => {
  bulkDeletePreviewModal.classList.remove('active');
  // Keep selections as they are
});

bulkDeletePreviewModal.addEventListener('click', (e) => {
  if (e.target === bulkDeletePreviewModal) {
    bulkDeletePreviewModal.classList.remove('active');
    // Keep selections as they are
  }
});

previewDeleteBtn.addEventListener('click', async () => {
  if (selectedImageIds.size === 0) {
    alert('No images selected.');
    bulkDeletePreviewModal.classList.remove('active');
    return;
  }

  // Close preview modal
  bulkDeletePreviewModal.classList.remove('active');
  
  // Determine which container and status element to use
  const container = gallerySection.classList.contains('active') ? galleryGrid : searchResults;
  const statusElement = gallerySection.classList.contains('active') ? galleryStatus : searchStatus;
  
  // Proceed with deletion
  await handleBulkDelete(container, statusElement);
});

selectAllBtn.addEventListener('click', () => {
  selectAllImages(galleryGrid);
});

searchSelectAllBtn.addEventListener('click', () => {
  selectAllImages(searchResults);
});

deselectAllBtn.addEventListener('click', () => {
  deselectAllImages();
});

searchDeselectAllBtn.addEventListener('click', () => {
  deselectAllImages();
});

// Export button
exportResultsBtn.addEventListener('click', async () => {
  if (currentSearchResults.length === 0) {
    alert('No search results to export.');
    return;
  }

  const imageIds = currentSearchResults.map(img => img.id);
  
  try {
    (exportResultsBtn as HTMLButtonElement).disabled = true;
    exportResultsBtn.textContent = 'Exporting...';
    
    const result = await window.electronAPI.exportImagesAsZip(imageIds);
    
    if (result.success) {
      showStatus(searchStatus, `Successfully exported ${imageIds.length} image${imageIds.length !== 1 ? 's' : ''} to ${result.filePath}`, 'success');
      // Hide success message after 5 seconds
      setTimeout(() => {
        hideStatus(searchStatus);
      }, 5000);
    } else {
      if (result.error !== 'User canceled') {
        alert(`Error exporting images: ${result.error || 'Unknown error'}`);
      }
    }
  } catch (error) {
    console.error('Error exporting images:', error);
    alert(`Error exporting images: ${error}`);
  } finally {
    (exportResultsBtn as HTMLButtonElement).disabled = false;
    exportResultsBtn.textContent = 'Export Results as ZIP';
  }
});

// Image Modal
async function openImageModal(imageId: number) {
  currentImageId = imageId;
  const image = await window.electronAPI.getImageById(imageId);
  if (!image) return;
  
  // Determine which image list we're viewing and find the current index
  let imageList: Image[] = [];
  
  if (searchSection.classList.contains('active')) {
    // We're in search results
    imageList = currentSearchResults;
  } else if (gallerySection.classList.contains('active')) {
    // We're in gallery view
    if (currentAlbumId !== null) {
      // Viewing an album
      imageList = await window.electronAPI.getAlbumImages(currentAlbumId);
    } else {
      // Check which view we're in based on title
      const title = galleryTitle.textContent || '';
      if (title === 'All Photos') {
        imageList = await window.electronAPI.getAllImagesWithTags();
      } else if (title === 'Unassigned Photos') {
        imageList = await window.electronAPI.getUnassignedImages();
      }
    }
  }
  
  // Find the current index in the list
  currentModalImageList = imageList;
  currentModalImageIndex = imageList.findIndex(img => img.id === imageId);
  
  const imagePath = await window.electronAPI.getImagePath(image.stored_path);
  modalImage.src = `file://${imagePath}`;
  modalFilename.textContent = image.filename;
  
  // Remove any existing input if present
  const existingInput = modalFilename.querySelector('input');
  if (existingInput) {
    modalFilename.textContent = image.filename;
  }
  
  // Add double-click handler for inline editing
  modalFilename.style.cursor = 'pointer';
  modalFilename.title = 'Double-click to rename';
  
  const handleDoubleClick = async () => {
    if (!currentImageId) return;
    
    const currentFilename = image.filename;
    const currentFullFilename = getFullFilename(image);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentFilename;
    input.className = 'filename-input';
    input.style.width = '100%';
    input.style.padding = '0.25rem';
    input.style.fontSize = '1.25rem';
    input.style.fontWeight = '600';
    input.style.border = '2px solid #3498db';
    input.style.borderRadius = '4px';
    input.style.outline = 'none';
    
    // Replace text with input
    modalFilename.innerHTML = '';
    modalFilename.appendChild(input);
    input.focus();
    input.select();
    
    const finishEditing = async () => {
      let newFilename = input.value.trim();
      
      // Remove input and restore text
      const currentFullFilename = getFullFilename(image);
      modalFilename.innerHTML = '';
      modalFilename.textContent = currentFullFilename;
      
      if (!newFilename || newFilename === currentFilename) {
        return; // No change or empty
      }
      
      // Validate filename (only the name part, extension is preserved automatically)
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(newFilename)) {
        alert('Filename contains invalid characters. Please avoid: < > : " / \\ | ? *');
        modalFilename.textContent = currentFullFilename;
        return;
      }
      
      try {
        if (!currentImageId) return;
        // Only update the filename part, extension stays the same
        const result = await window.electronAPI.renameImage(currentImageId, newFilename);
        if (result.success) {
          // Refresh image data to get updated filename
          const updatedImage = await window.electronAPI.getImageById(currentImageId);
          if (updatedImage) {
            const updatedFullFilename = getFullFilename(updatedImage);
            modalFilename.textContent = updatedFullFilename;
          }
          
          // Refresh gallery if active
          if (gallerySection.classList.contains('active')) {
            if (currentAlbumId !== null) {
              await loadAlbumImages(currentAlbumId);
            } else {
              const title = galleryTitle.textContent || '';
              if (title === 'All Photos') {
                const allImages = await window.electronAPI.getAllImagesWithTags();
                selectedImageIds.clear();
                updateSelectionUI();
                await renderImagesToContainer(allImages, galleryGrid);
              } else if (title === 'Unassigned Photos') {
                const unassignedImages = await window.electronAPI.getUnassignedImages();
                selectedImageIds.clear();
                updateSelectionUI();
                await renderImagesToContainer(unassignedImages, galleryGrid);
              } else {
                await loadGallery();
              }
            }
          }
          
          // Refresh search results if active
          if (searchSection.classList.contains('active')) {
            const tagIds = selectedTags.map(t => t.id);
            if (tagIds.length > 0) {
              searchBtn.click();
            }
          }
        } else {
          alert(`Error renaming photo: ${result.error || 'Unknown error'}`);
          modalFilename.textContent = currentFullFilename;
        }
      } catch (error) {
        console.error('Error renaming photo:', error);
        alert(`Error renaming photo: ${error}`);
        modalFilename.textContent = currentFullFilename;
      }
    };
    
    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await finishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Prevent global ESC handler from closing modal
        modalFilename.innerHTML = '';
        modalFilename.textContent = currentFullFilename;
      }
    });
  };
  
  // Remove old listener if exists and add new one
  modalFilename.removeEventListener('dblclick', handleDoubleClick);
  modalFilename.addEventListener('dblclick', handleDoubleClick);
  
  const tags = await window.electronAPI.getImageTags(imageId);
  modalTags.innerHTML = '';
  tags.forEach(tag => {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'tag';
    tagSpan.innerHTML = `${tag.name} <span class="tag-remove" data-tag-id="${tag.id}" style="cursor: pointer; margin-left: 4px; font-weight: bold;">×</span>`;
    tagSpan.querySelector('.tag-remove')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (currentImageId) {
        try {
          await window.electronAPI.removeTagFromImage(currentImageId, tag.id);
          openImageModal(currentImageId); // Refresh modal
          if (gallerySection.classList.contains('active')) {
            await refreshGalleryView();
          }
          // Refresh tag list in search section if it's active
          if (searchSection.classList.contains('active')) {
            await loadTagsForSearch();
          }
        } catch (error) {
          console.error('Error removing tag:', error);
          alert(`Error removing tag: ${error}`);
        }
      }
    });
    modalTags.appendChild(tagSpan);
  });
  
  imageModal.classList.add('active');
  updateModalNavigationButtons();
}

// Navigation functions for image modal
function goToNextImage() {
  if (currentModalImageList.length === 0 || currentModalImageIndex === -1) return;
  
  const nextIndex = (currentModalImageIndex + 1) % currentModalImageList.length;
  const nextImage = currentModalImageList[nextIndex];
  if (nextImage) {
    openImageModal(nextImage.id);
  }
}

function goToPreviousImage() {
  if (currentModalImageList.length === 0 || currentModalImageIndex === -1) return;
  
  const prevIndex = currentModalImageIndex === 0 
    ? currentModalImageList.length - 1 
    : currentModalImageIndex - 1;
  const prevImage = currentModalImageList[prevIndex];
  if (prevImage) {
    openImageModal(prevImage.id);
  }
}

function updateModalNavigationButtons() {
  const prevBtn = document.getElementById('modal-prev-btn');
  const nextBtn = document.getElementById('modal-next-btn');
  
  const hasMultipleImages = currentModalImageList.length > 1;
  
  if (prevBtn) {
    prevBtn.style.display = hasMultipleImages ? 'block' : 'none';
  }
  if (nextBtn) {
    nextBtn.style.display = hasMultipleImages ? 'block' : 'none';
  }
}

// Delete button handler
modalDeleteBtn.addEventListener('click', async () => {
  if (!currentImageId) return;
  
  // Confirm deletion
  if (!confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
    return;
  }
  
  try {
    const result = await window.electronAPI.deleteImage(currentImageId);
    if (result.success) {
      // Close modal
      imageModal.classList.remove('active');
      const deletedImageId = currentImageId;
      currentImageId = null;
      currentModalImageList = [];
      currentModalImageIndex = -1;
      
      // Remove from selection if it was selected
      selectedImageIds.delete(deletedImageId);
      updateSelectionUI();
      
      // Refresh the current view while preserving the current level
      if (gallerySection.classList.contains('active')) {
        // Check if we're viewing images (not albums)
        const isViewingImages = galleryGrid.style.display === 'grid' && albumsGrid.style.display === 'none';
        
        if (isViewingImages) {
          // We're in a photo view, preserve the current view
          if (currentAlbumId !== null) {
            // Viewing an album - reload that album
            await loadAlbumImages(currentAlbumId);
          } else {
            // Check which view we're in based on title
            const title = galleryTitle.textContent || '';
            if (title === 'All Photos') {
              // Refresh "All Photos" view
              const allImages = await window.electronAPI.getAllImagesWithTags();
              selectedImageIds.clear();
              updateSelectionUI();
              await renderImagesToContainer(allImages, galleryGrid);
              if (allImages.length === 0) {
                showStatus(galleryStatus, 'No images found.', 'error');
              } else {
                hideStatus(galleryStatus);
              }
            } else if (title === 'Unassigned Photos') {
              // Refresh "Unassigned Photos" view
              const unassignedImages = await window.electronAPI.getUnassignedImages();
              selectedImageIds.clear();
              updateSelectionUI();
              await renderImagesToContainer(unassignedImages, galleryGrid);
              if (unassignedImages.length === 0) {
                showStatus(galleryStatus, 'No unassigned photos.', 'error');
              } else {
                hideStatus(galleryStatus);
              }
            } else {
              // Fallback to albums view if we can't determine
              await loadGallery();
            }
          }
        } else {
          // We're in albums view (root level), stay there
          await loadGallery();
        }
      } else if (searchSection.classList.contains('active')) {
        // Re-run search to refresh results
        const tagIds = selectedTags.map(t => t.id);
        if (tagIds.length > 0) {
          searchBtn.click();
        } else {
          searchResults.innerHTML = '';
          selectedImageIds.clear();
          updateSelectionUI();
        }
        await loadTagsForSearch();
      }
    } else {
      alert(`Error deleting photo: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error deleting photo:', error);
    alert(`Error deleting photo: ${error}`);
  }
});

modalClose.addEventListener('click', () => {
  imageModal.classList.remove('active');
  currentImageId = null;
  currentModalImageList = [];
  currentModalImageIndex = -1;
});

// Navigation button handlers
modalPrevBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  goToPreviousImage();
});

modalNextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  goToNextImage();
});

imageModal.addEventListener('click', (e) => {
  if (e.target === imageModal) {
    imageModal.classList.remove('active');
    currentImageId = null;
    currentModalImageList = [];
    currentModalImageIndex = -1;
  }
});

// Modal tag input
modalTagInput.addEventListener('input', () => {
  const query = modalTagInput.value.toLowerCase().trim();
  if (query.length === 0) {
    modalTagSuggestions.classList.remove('active');
    return;
  }
  
  const filtered = allTags.filter(tag => 
    tag.name.toLowerCase().includes(query)
  );
  
  if (filtered.length > 0) {
    modalTagSuggestions.innerHTML = '';
    filtered.forEach(tag => {
      const suggestion = document.createElement('div');
      suggestion.className = 'tag-suggestion';
      suggestion.textContent = tag.name;
      suggestion.addEventListener('click', async () => {
        if (currentImageId) {
          try {
            await window.electronAPI.addTagToImage(currentImageId, tag.id);
            modalTagInput.value = '';
            modalTagSuggestions.classList.remove('active');
            openImageModal(currentImageId); // Refresh modal
            if (gallerySection.classList.contains('active')) {
              await refreshGalleryView();
            }
            // Refresh tag list in search section if it's active (in case this is a newly used tag)
            if (searchSection.classList.contains('active')) {
              await loadTagsForSearch();
            }
          } catch (error) {
            console.error('Error adding tag:', error);
            alert(`Error adding tag: ${error}`);
          }
        }
      });
      modalTagSuggestions.appendChild(suggestion);
    });
    modalTagSuggestions.classList.add('active');
  } else {
    modalTagSuggestions.classList.remove('active');
  }
});

modalTagInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && modalTagInput.value.trim() && currentImageId) {
    e.preventDefault();
    const tagName = modalTagInput.value.trim();
    try {
      let tag = allTags.find(t => t.name === tagName);
      if (!tag) {
        tag = await window.electronAPI.createTag(tagName);
        allTags.push(tag);
      }
      await window.electronAPI.addTagToImage(currentImageId, tag.id);
      modalTagInput.value = '';
      modalTagSuggestions.classList.remove('active');
      openImageModal(currentImageId); // Refresh modal
      if (gallerySection.classList.contains('active')) {
        await refreshGalleryView();
      }
      // Refresh tag list in search section if it's active (in case this is a newly used tag)
      if (searchSection.classList.contains('active')) {
        await loadTagsForSearch();
      }
    } catch (error) {
      console.error('Error creating/adding tag:', error);
      alert(`Error creating/adding tag: ${error}`);
    }
  }
});

// Utility Functions
async function refreshGalleryView() {
  // Refresh the current view while preserving the current level
  if (gallerySection.classList.contains('active')) {
    // Check if we're viewing images (not albums)
    const isViewingImages = galleryGrid.style.display === 'grid' && albumsGrid.style.display === 'none';
    
    if (isViewingImages) {
      // We're in a photo view, preserve the current view
      if (currentAlbumId !== null) {
        // Viewing an album - reload that album
        await loadAlbumImages(currentAlbumId);
      } else {
        // Check which view we're in based on title
        const title = galleryTitle.textContent || '';
        if (title === 'All Photos') {
          // Refresh "All Photos" view
          const allImages = await window.electronAPI.getAllImagesWithTags();
          selectedImageIds.clear();
          updateSelectionUI();
          await renderImagesToContainer(allImages, galleryGrid);
          if (allImages.length === 0) {
            showStatus(galleryStatus, 'No images found.', 'error');
          } else {
            hideStatus(galleryStatus);
          }
        } else if (title === 'Unassigned Photos') {
          // Refresh "Unassigned Photos" view
          const unassignedImages = await window.electronAPI.getUnassignedImages();
          selectedImageIds.clear();
          updateSelectionUI();
          await renderImagesToContainer(unassignedImages, galleryGrid);
          if (unassignedImages.length === 0) {
            showStatus(galleryStatus, 'No unassigned photos.', 'error');
          } else {
            hideStatus(galleryStatus);
          }
        } else {
          // Fallback to albums view if we can't determine
          await loadGallery();
        }
      }
    } else {
      // We're in albums view (root level), stay there
      await loadGallery();
    }
  }
}

function getFullFilename(image: any): string {
  return image.filename + (image.extension || '');
}

function showStatus(element: HTMLElement, message: string, type: 'success' | 'error') {
  element.textContent = message;
  element.className = `status-message ${type}`;
}

function hideStatus(element: HTMLElement) {
  element.className = 'status-message';
}

// Keyboard Navigation
document.addEventListener('keydown', (e) => {
  // Handle arrow keys for image navigation when modal is open
  if (imageModal.classList.contains('active')) {
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA'
    );
    
    // Don't navigate if typing in an input field
    if (!isInputFocused) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextImage();
        return;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPreviousImage();
        return;
      }
    }
  }
  
  // Only handle ESC key
  if (e.key !== 'Escape') return;
  
  // Don't handle ESC if user is typing in an input field (unless it's a modal input)
  const activeElement = document.activeElement;
  const isInputFocused = activeElement && (
    activeElement.tagName === 'INPUT' || 
    activeElement.tagName === 'TEXTAREA'
  );
  
  // Check if we're editing the filename (input inside modalFilename)
  const isEditingFilename = activeElement && 
    activeElement.tagName === 'INPUT' && 
    activeElement.closest('#modal-filename') !== null;
  
  // If editing filename, let that handler deal with it (it will stop propagation)
  if (isEditingFilename) return;
  
  // Allow ESC in modal tag input to close the modal
  const isModalTagInput = activeElement === modalTagInput;
  
  // If typing in a non-modal input, don't handle ESC
  if (isInputFocused && !isModalTagInput) return;
  
  // Priority 1: Close modals if they're open
  if (imageModal.classList.contains('active')) {
    e.preventDefault();
    imageModal.classList.remove('active');
    currentImageId = null;
    return;
  }
  
  if (bulkDeletePreviewModal.classList.contains('active')) {
    e.preventDefault();
    bulkDeletePreviewModal.classList.remove('active');
    return;
  }
  
  // Priority 2: Cancel album creation if input is visible
  if (newAlbumInputContainer.style.display !== 'none' && 
      newAlbumInputContainer.style.display !== '') {
    e.preventDefault();
    newAlbumInputContainer.style.display = 'none';
    newAlbumNameInput.value = '';
    return;
  }
  
  // Priority 3: Go back to albums view if viewing images
  if (gallerySection.classList.contains('active') && 
      backToAlbumsBtn.style.display !== 'none' &&
      backToAlbumsBtn.style.display !== '') {
    e.preventDefault();
    selectedImageIds.clear();
    updateSelectionUI();
    loadGallery();
    return;
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadAlbums();
  await loadTagsForSearch();
  if (gallerySection.classList.contains('active')) {
    loadGallery();
  }
});

