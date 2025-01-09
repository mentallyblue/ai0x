const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs').promises;
const path = require('path');

async function generateFavicons() {
    const sourceImage = path.join(__dirname, '../public/images/image.jpg');
    const outputDir = path.join(__dirname, '../public/images');

    // Generate PNG favicons
    await sharp(sourceImage)
        .resize(32, 32)
        .toFile(path.join(outputDir, 'logo32.png'));

    await sharp(sourceImage)
        .resize(16, 16)
        .toFile(path.join(outputDir, 'logo16.png'));

    // Generate ICO file (contains both 16x16 and 32x32)
    const pngBuffers = await Promise.all([
        fs.readFile(path.join(outputDir, 'logo16.png')),
        fs.readFile(path.join(outputDir, 'logo32.png'))
    ]);

    const icoBuffer = await toIco(pngBuffers);
    await fs.writeFile(path.join(outputDir, 'favicon.ico'), icoBuffer);
}

generateFavicons().catch(console.error); 