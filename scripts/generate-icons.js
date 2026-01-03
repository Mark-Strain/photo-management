const sharp = require('sharp');
const toIco = require('to-ico');
const png2icons = require('png2icons');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const svgPath = path.join(buildDir, 'icon.svg');

async function generateIcons() {
  console.log('Generating icon files...');

  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Check if SVG exists
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG icon not found at ${svgPath}`);
    process.exit(1);
  }

  try {
    // Generate PNG for Linux (512x512)
    console.log('Generating icon.png (512x512) for Linux...');
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(buildDir, 'icon.png'));

    // Generate PNGs for ICO (multiple sizes)
    console.log('Generating PNGs for ICO...');
    const icoSizes = [16, 32, 48, 64, 128, 256];
    const icoBuffers = [];

    for (const size of icoSizes) {
      const buffer = await sharp(svgPath)
        .resize(size, size)
        .png()
        .toBuffer();
      icoBuffers.push(buffer);
    }

    // Create ICO file
    console.log('Creating icon.ico for Windows...');
    const icoBuffer = await toIco(icoBuffers);
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);

    // Generate ICNS for macOS
    console.log('Creating icon.icns for macOS...');
    const icnsSource = await sharp(svgPath)
      .resize(1024, 1024)
      .png()
      .toBuffer();
    
    const icnsBuffer = png2icons.createICNS(icnsSource, png2icons.BILINEAR, 0);
    fs.writeFileSync(path.join(buildDir, 'icon.icns'), icnsBuffer);

    console.log('\n✅ Icon generation complete!');
    console.log('\nGenerated files:');
    console.log('  - build/icon.ico (Windows)');
    console.log('  - build/icon.icns (macOS)');
    console.log('  - build/icon.png (Linux)');
    
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

