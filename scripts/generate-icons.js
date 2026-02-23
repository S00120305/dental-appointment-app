// Generate PWA icons from SVG
// Usage: node scripts/generate-icons.js
// Requires: npm install sharp (one-time)

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('sharp not installed. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install sharp --save-dev', { stdio: 'inherit' });
    sharp = require('sharp');
  }

  const svgPath = path.join(__dirname, '..', 'public', 'icons', 'icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const sizes = [192, 512];

  for (const size of sizes) {
    const outputPath = path.join(__dirname, '..', 'public', 'icons', `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Apple touch icon (180x180)
  const applePath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(applePath);
  console.log('Generated: apple-touch-icon.png');

  console.log('Done!');
}

generateIcons().catch(console.error);
