# Photo Management Desktop Application

A desktop photo management application built with Electron that allows users to:
- Import photos from local directories 
- Tag photos with custom tags (e.g., who is in the photo)
- Search for photos by tags

## Disclaimer

This application was built using AI assistance. While the code has been reviewed and tested, please be aware that AI-generated code may contain errors or require further refinement.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

3. Run the application:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Google Photos Integration `Under Development`

To use Google Photos import, you'll need to:
1. Create a Google Cloud project
2. Enable the Google Photos Library API
3. Create OAuth 2.0 credentials
4. Configure the credentials in the application

## Packaging for Distribution

To create distributable packages for users:

### Prerequisites

1. **Icons** (optional but recommended):
   - Icons are already generated in the `build/` directory
   - Run `npm run generate-icons` to regenerate if needed

2. **Build the application**:
   ```bash
   npm run build
   ```

### Windows Packaging Issue Fix

If you encounter a symlink error when packaging on Windows (error: "Cannot create symbolic link : A required privilege is not held by the client"), you have two options:

**Option 1: Enable Developer Mode (Recommended)**
1. Open Windows Settings (Win + I)
2. Go to **Update & Security** → **For developers**
3. Enable **Developer Mode**
4. Restart your computer if prompted
5. Run `npm run package` again

**Option 2: Run as Administrator**
1. Right-click PowerShell/Command Prompt
2. Select "Run as Administrator"
3. Navigate to your project directory
4. Run `npm run package`

### Packaging Commands

- **Package for current platform**:
  ```bash
  npm run package
  ```

- **Package for Windows** (creates NSIS installer and portable):
  ```bash
  npm run package:win
  ```

- **Package for macOS** (creates DMG):
  ```bash
  npm run package:mac
  ```

- **Package for Linux** (creates AppImage and DEB):
  ```bash
  npm run package:linux
  ```

- **Package for all platforms** (requires appropriate build tools for each):
  ```bash
  npm run package:all
  ```

### Output

Packaged applications will be in the `release/` directory:
- **Windows**: `.exe` installer (NSIS) and portable `.exe`
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` and `.deb` package

### Notes

- The first build may take longer as electron-builder downloads platform-specific tools
- For macOS builds, you may need to be on a Mac or use a CI/CD service
- For code signing (recommended for distribution), configure signing certificates in the `build` section of `package.json`
- Code signing is currently disabled for development builds

## Project Structure

- `src/main/` - Electron main process code
- `src/renderer/` - UI code (HTML, CSS, TypeScript)
- `src/shared/` - Shared types and utilities
- `data/` - Application data (images and database)
- `dist/` - Compiled output (created during build)
- `release/` - Packaged applications (created during packaging)
