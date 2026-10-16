#!/usr/bin/env node
// Builds parallax.min.js from parallax.js.
'use strict';

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const root = path.resolve(__dirname, '..');

(async () => {
  const source = fs.readFileSync(path.join(root, 'parallax.js'), 'utf8');
  const version = (source.match(/parallax\.js v([\d.]+)/) || [])[1];
  const banner = '/*!\n * parallax.js v' + version + ' (http://pixelcog.github.io/parallax.js/)\n * @copyright 2016 PixelCog, Inc.\n * @license MIT (https://github.com/pixelcog/parallax.js/blob/master/LICENSE)\n */\n';
  const min = await minify(source, { compress: true, mangle: true, format: { comments: false } });
  fs.writeFileSync(path.join(root, 'parallax.min.js'), banner + min.code + '\n');
  console.log('wrote parallax.min.js (' + Buffer.byteLength(banner + min.code) + ' bytes)');
})().catch((e) => { console.error(e); process.exit(1); });
