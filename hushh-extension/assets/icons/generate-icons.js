// generate-icons.js
// Run this once with Node.js + canvas package to produce the PNG icons:
//   npm install canvas
//   node generate-icons.js
//
// Or open generate-icons.html in a browser to download them.

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = [16, 32, 48, 128];
const PURPLE = '#7F77DD';
const WHITE = '#FFFFFF';

for (const size of SIZES) {
  for (const active of [false, true]) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background circle
    const r = size / 2;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#5A52B5' : PURPLE;
    ctx.fill();

    // "H" letter
    ctx.fillStyle = WHITE;
    ctx.font = `bold ${Math.round(size * 0.55)}px -apple-system, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', r, r + 0.5);

    const suffix = active ? '-active' : '';
    const filename = path.join(__dirname, `${size}${suffix}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`Written: ${filename}`);
  }
}
