Fork from https://github.com/pixelcog/parallax.js/ for using as drupal-library

Parallax.js 2.0.0
=================

Simple parallax scrolling with **no dependencies**. Version 2.0.0 of this fork rewrites parallax.js 1.5.0 with native DOM APIs. jQuery is now **optional**: if a page loads jQuery, the 1.x plugin API (`$(el).parallax()`) keeps working unchanged.

(Not to be confused with the upstream [v2.0.0-alpha](https://github.com/pixelcog/parallax.js/tree/v2.0.0-alpha) branch, which is a separate, unfinished rewrite.)

## Upgrading from 1.x

Replace `parallax.js` / `parallax.min.js`. The file names are unchanged, so Drupal library definitions (`/libraries/parallaxjs/parallax.min.js`) keep working.

- **The site still loads jQuery:** nothing to change. All of these behave as before:
  - `$(el).parallax(options)`, the `'refresh'`, `'render'` and `'destroy'` commands, and `$(window).parallax(options)` for defaults
  - `$(el).data('px.parallax')`, whose instance still has `$element`, `$mirror` and `$slider`
  - `$.fn.parallax.Constructor`, `$.fn.parallax.noConflict()`
  - the `data-parallax="scroll"` data API
  - `$(window).trigger('resize')` / `('scroll')`
- **The site drops jQuery:** use the native API below. The `data-parallax="scroll"` data API works without jQuery too.

If jQuery is loaded *after* parallax.js, register the plugin manually: `ParallaxScroll.installJQuery(jQuery)`.

## Usage without jQuery

```html
<div class="parallax-window" data-parallax="scroll" data-image-src="/path/to/image.jpg"></div>
<script src="parallax.min.js"></script>
```

or from JavaScript:

```js
var p = new ParallaxScroll('.parallax-window', { imageSrc: '/path/to/image.jpg', speed: 0.3 });
ParallaxScroll.init('.parallax-window', options);  // every match; same rules as $(...).parallax(options)
ParallaxScroll.init(window, { speed: 0.5 });       // change the defaults (same as ParallaxScroll.configure)
ParallaxScroll.init('.parallax-window', 'refresh');
ParallaxScroll.getInstance(el);
p.destroy();                                       // or ParallaxScroll.destroy(el)
```

The global is `window.ParallaxScroll`. It is also exposed as `window.Parallax` unless another script (for example wagerfield's parallax) already defined that. With a bundler: `const Parallax = require('jquery-parallax.js');`.

Instances keep the 1.x properties (`speed`, `imageSrc`, `imageWidth`, `offsetTop`, …). Element references are `p.element`, `p.mirror` and `p.slider` (`p.sliderElements` if the markup holds several `.parallax-slider` children). With jQuery loaded, `$element`, `$mirror` and `$slider` are also available.

## Behaviour changes from 1.5.0

These are bug fixes. Everything else is intended to behave exactly as 1.5.0.

- `destroy` puts a `.parallax-slider` that came from the element's own markup back into the element (1.x deleted it with the mirror), restoring its inline style.
- Once the last instance is destroyed, the animation-frame loop stops. 1.x kept it running, and started another loop on every later re-init.
- `destroy` on an element without the effect, or one that only got the iOS/Android background fallback, is a no-op instead of throwing.
- Options named `destroy`, `refresh` or `render` can't overwrite the methods.
- The global `requestAnimationFrame` polyfill for very old browsers is gone.

## Development

```sh
npm install
npm run build   # parallax.js -> parallax.min.js
npm test        # compares the rewrite with the original 1.5.0 plugin in Chrome
```

`npm test` runs every case in `test/cases.js` against the original plugin (`test/original/`) on jQuery 1.12, 3 and 4, and against the rewrite with and without jQuery. The cases cover scrolling, resizing, data attributes, positions, bleed, speed, existing slider markup, `img` targets, re-init, configure, destroy, mirror containers, hidden elements, jQuery-triggered events and the iOS/Android fallbacks. After each step it compares the mirror and slider styles, the instance state and the global state. It also runs the API checks in `test/api-tests.js`. It needs a local Chrome (or set `CHROME_PATH`).

-----

# Parallax.js 1.5.0 (original README)

Simple parallax scrolling implemented as a jQuery plugin.  
[http://pixelcog.com/parallax.js/](http://pixelcog.com/parallax.js/)


Please also check our [v2.0.0-alpha](https://github.com/pixelcog/parallax.js/tree/v2.0.0-alpha)! We'd be happy to receive your feedback!

**ATTENTION:** please use the issue tracker for bug reports and feature requests ONLY! For questions and topics which go along the lines "I cannot get this to work" please turn to [stackoverflow.com](https://stackoverflow.com/questions/tagged/parallax.js) for help and use the tag [parallax.js](https://stackoverflow.com/questions/tagged/parallax.js). Thank you for your understanding!


## Installation

### NPM

```bash
npm i --save jquery-parallax.js
```

### Yarn

```bash
yarn add jquery-parallax.js
```

### Bower

Please note that although Bower is still maintained, they recommend Yarn for new projects.

```bash
$ bower i --save parallax.js
```

### Setup

Include `parallax.min.js` in your document after including jQuery (compatible with jQuery >= 1.7).

```html
<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<script src="/path/to/parallax.min.js"></script>
```

Use these CDN links, provided by jsDelivr.com
```html
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
<script src="https://cdn.jsdelivr.net/parallax.js/1.4.2/parallax.min.js"></script>
```

## Usage

Please note, that `<!DOCTYPE html>` on top of your document is required!

### Simple version via data attributes

*Note: for more complex requirements we recommend using the [inner HTML markup](#using-inner-html-for-complex-content) below! With that it's possible to use the parallax effect with almost any HTML content*

To easily add a parallax effect behind an element, add `data-parallax="scroll"` to the element you want to use, and specify an image with `data-image-src="/path/to/image.jpg"`.

```html
<div class="parallax-window" data-parallax="scroll" data-image-src="/path/to/image.jpg"></div>
```

### Via JavaScript

To call the parallax plugin manually, simply select your target element with jQuery and do the following:

```javascript
$('.parallax-window').parallax({imageSrc: '/path/to/image.jpg'});
```

### Notes

What parallax.js will do is create a fixed-position element for each parallax image at the start of the document's body (or another configurable container). This mirror element will sit behind the other elements and match the position and dimensions of its target object.

Due to the nature of this implementation, you must ensure that these parallax objects and any layers below them are transparent so that you can see the parallax effect underneath.  Also, if there is no other content in this element, you will need to ensure that it has some fixed dimensions otherwise you won't see anything.

```css
.parallax-window {
	min-height: 400px;
	background: transparent;
}
```

Also, keep in mind that once initialized, the parallax plugin presumes a fixed page layout unless it encounters a `scroll` or `resize` event.  If you have a dynamic page in which another javascript method may alter the DOM, you must manually refresh the parallax effect with the following commands:

```javascript
jQuery(window).trigger('resize').trigger('scroll');
```

### Using inner HTML for complex content

You can use the following syntax to enable complex content for the parallax:

```html
<div class="parallax-window">
  <div class="parallax-slider">
    <span style="position:absolute; top: 400px; left: 400px;">Some Text</span>
	<p>Some other Content</p>
  </div>
</div>
```
Please note, that the div with class "parallax-slider" is essential here.

You then need to initialize it through JS and provide the naturalWidth and naturalHeight options in order to be rendered correctly.

```
$('.parallax-window').parallax({
    naturalWidth: 600,
    naturalHeight: 400
  });
```

This also makes it possible to use responsive images in the slider:

```html
<div class="parallax-window">
  <div class="parallax-slider">
    <img src="/path/to/image.jpg" srcset="/path/to/image-400px.jpg 400w, /path/to/image-800px.jpg 800w, /path/to/image-1200px.jpg 1200w" sizes="100vw">
  </div>
</div>
```

## Options

Options can be passed in via data attributes of JavaScript.  For data attributes, append the option name to `data-`, as in `data-image-src=""`.

Note that when specifying these options as html data-attributes, you should convert "camelCased" variable names into "dash-separated" lower-case names (e.g. `zIndex` would be `data-z-index=""`).

<table class="table table-bordered table-striped">
	<thead>
		<tr>
			<th style="width: 100px;">Name</th>
			<th style="width: 100px;">type</th>
			<th style="width: 50px;">default</th>
			<th>description</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>imageSrc</td>
			<td>path</td>
			<td>null</td>
			<td>You must provide a path to the image you wish to apply to the parallax effect.</td>
		</tr>
		<tr>
			<td>naturalWidth</td>
			<td>number</td>
			<td>auto</td>
			<td rowspan="2">You can provide the natural width and natural height of an image to speed up loading and reduce error when determining the correct aspect ratio of the image.</td>
		</tr>
		<tr>
			<td>naturalHeight</td>
			<td>number</td>
			<td>auto</td>
		</tr>
		<tr>
			<td>position</td>
			<td>xPos yPos</td>
			<td>center center</td>
			<td rowspan="3">This is analogous to the background-position css property. Specify coordinates as top, bottom, right, left, center, or pixel values (e.g. -10px 0px). The parallax image will be positioned as close to these values as possible while still covering the target element.</td>
		</tr>
		<tr>
			<td>positionX</td>
			<td>xPos</td>
			<td>center</td>
		</tr>
		<tr>
			<td>positionY</td>
			<td>yPos</td>
			<td>center</td>
		</tr>
		<tr>
			<td>speed</td>
			<td>float</td>
			<td>0.2</td>
			<td>The speed at which the parallax effect runs. 0.0 means the image will appear fixed in place, and 1.0 the image will flow at the same speed as the page content.</td>
		</tr>
		<tr>
			<td>zIndex</td>
			<td>number</td>
			<td>-100</td>
			<td>The z-index value of the fixed-position elements.  By default these will be behind everything else on the page.</td>
		</tr>
		<tr>
			<td>bleed</td>
			<td>number</td>
			<td>0</td>
			<td>You can optionally set the parallax mirror element to extend a few pixels above and below the mirrored element.  This can hide slow or stuttering scroll events in certain browsers.</td>
		</tr>
		<tr>
			<td>iosFix</td>
			<td>boolean</td>
			<td>true</td>
			<td>iOS devices are incompatable with this plugin. If true, this option will set the parallax image as a static, centered background image whenever it detects an iOS user agent. Disable this if you wish to implement your own graceful degradation.</td>
		</tr>
		<tr>
			<td>androidFix</td>
			<td>boolean</td>
			<td>true</td>
			<td>If true, this option will set the parallax image as a static, centered background image whenever it detects an Android user agent. Disable this if you wish to enable the parallax scrolling effect on Android devices.</td>
		</tr>
		<tr>
			<td>overScrollFix</td>
			<td>boolean</td>
			<td>false</td>
			<td>(Experimental) If true, will freeze the parallax effect when "over scrolling" in browsers like Safari to prevent unexpected gaps caused by negative scroll positions.</td>
		</tr>
		<tr>
			<td>mirrorContainer</td>
			<td>jQuery Selector</td>
			<td>body</td>
			<td>The parallax mirror will be prepended into this container.</td>
		</tr>
	</tbody>
</table>

## Contributing

If you have a pull request you would like to submit, please ensure that you update the minified version of the library along with your code changes.  This project uses [uglifyjs](https://www.npmjs.com/package/uglify-js) to perform code compression.

Please use the following command:

	uglifyjs parallax.js --comments -m -c -o parallax.min.js


LICENSE
=======

The MIT License (MIT)

Copyright (c) 2016 PixelCog Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
