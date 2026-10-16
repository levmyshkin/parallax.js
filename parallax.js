/*!
 * parallax.js v2.0.0 (http://pixelcog.github.io/parallax.js/)
 * @copyright 2016 PixelCog, Inc.
 * @license MIT (https://github.com/pixelcog/parallax.js/blob/master/LICENSE)
 *
 * Dependency-free rewrite of parallax.js 1.5.0. jQuery is optional: when it
 * is present, $(el).parallax() and $.fn.parallax keep working unchanged.
 */

;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    var Parallax = factory(root);
    root.ParallaxScroll = Parallax;
    if (!root.Parallax) {
      root.Parallax = Parallax;
    }
  }
}(typeof window !== 'undefined' ? window : this, function (window) {
  'use strict';

  var document = window.document;
  var instances = new WeakMap();
  // Hooks set by the jQuery bridge.
  var bridge = {};

  // ---------------------------------------------------------------------------
  // DOM helpers (replacements for the jQuery calls used by 1.x)
  // ---------------------------------------------------------------------------

  // Like $.extend(target, ...): shallow merge that skips undefined values.
  function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src || typeof src !== 'object') { continue; }
      for (var key in src) {
        if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) { target[key] = src[key]; }
      }
    }
    return target;
  }

  function resolve(target) {
    if (!target) { return []; }
    if (typeof target === 'string') { return Array.prototype.slice.call(document.querySelectorAll(target)); }
    if (target.nodeType || target === window) { return [target]; }
    if (typeof target.length === 'number') {
      return Array.prototype.filter.call(target, function (node) { return node && (node.nodeType || node === window); });
    }
    return [];
  }

  // Like $(el).css(props): numbers get "px" (except unitless properties) and
  // null/undefined/NaN values are skipped.
  var unitless = { zIndex: true, opacity: true };

  function css(nodes, props) {
    nodes.forEach(function (node) {
      for (var key in props) {
        var value = props[key];
        if (value == null || value !== value) { continue; }
        if (typeof value === 'number' && !unitless[key]) { value += 'px'; }
        node.style[key] = value;
      }
    });
  }

  // jQuery measures display:none elements by temporarily showing them.
  var rDisplaySwap = /^(none|table(?!-c[ea]).+)/;

  function measure(node, fn) {
    var styles = window.getComputedStyle(node);
    if (rDisplaySwap.test(styles.display) &&
        (!node.getClientRects().length || !node.getBoundingClientRect().width)) {
      var old = { position: node.style.position, visibility: node.style.visibility, display: node.style.display };
      node.style.position = 'absolute';
      node.style.visibility = 'hidden';
      node.style.display = 'block';
      try {
        return fn(window.getComputedStyle(node));
      } finally {
        node.style.position = old.position;
        node.style.visibility = old.visibility;
        node.style.display = old.display;
      }
    }
    return fn(styles);
  }

  // Equivalent of $(node).outerWidth() / .outerHeight().
  function outerSize(node, dim) {
    return measure(node, function (styles) {
      var sides = dim === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
      var extra = 0;
      sides.forEach(function (side) {
        extra += (parseFloat(styles['padding' + side]) || 0) + (parseFloat(styles['border' + side + 'Width']) || 0);
      });
      var val = parseFloat(styles[dim]);
      if (isNaN(val)) {
        return dim === 'width' ? node.offsetWidth : node.offsetHeight;
      }
      return styles.boxSizing === 'border-box' ? val : val + extra;
    });
  }

  // Equivalent of $(node).offset().
  function offset(node) {
    if (!node.getClientRects().length) { return { top: 0, left: 0 }; }
    var rect = node.getBoundingClientRect();
    return { top: rect.top + window.pageYOffset, left: rect.left + window.pageXOffset };
  }

  // Equivalent of $(document).height() / .width().
  function documentSize(dim) {
    var name = dim === 'width' ? 'Width' : 'Height';
    var doc = document.documentElement, body = document.body || {};
    return Math.max(body['scroll' + name] || 0, doc['scroll' + name], body['offset' + name] || 0, doc['offset' + name], doc['client' + name]);
  }

  // Reads data-* attributes the way $(el).data() does ("true" -> true,
  // "0.5" -> 0.5, JSON objects/arrays parsed).
  var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/;

  function readData(node) {
    var out = {};
    if (!node.attributes) { return out; }
    Array.prototype.forEach.call(node.attributes, function (attr) {
      if (attr.name.indexOf('data-') !== 0) { return; }
      var key = attr.name.slice(5).replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
      var value = attr.value;
      if (value === 'true') { value = true; }
      else if (value === 'false') { value = false; }
      else if (value === 'null') { value = null; }
      else if (value === +value + '') { value = +value; }
      else if (rbrace.test(value)) {
        try { value = JSON.parse(value); } catch (e) { /* keep the string */ }
      }
      out[key] = value;
    });
    return out;
  }

  function listen(target, types, handler) {
    var offs = types.split(' ').map(function (type) {
      target.addEventListener(type, handler);
      var offBridge = bridge.listen ? bridge.listen(target, type, handler) : null;
      return function () {
        target.removeEventListener(type, handler);
        if (offBridge) { offBridge(); }
      };
    });
    return function () { offs.forEach(function (off) { off(); }); };
  }

  // ---------------------------------------------------------------------------
  // Parallax Constructor
  // ---------------------------------------------------------------------------

  /**
   * @param {Element|string} element  Element (or selector, first match).
   * @param {Object} [options]        See the prototype defaults below.
   */
  function Parallax(element, options) {
    if (!(this instanceof Parallax)) { return new Parallax(element, options); }
    var el = resolve(element)[0];
    if (!el) { throw new Error('Parallax: element not found'); }
    if (instances.has(el)) { return instances.get(el); }

    var self = this;

    if (options && typeof options == 'object') {
      options = extend({}, options);
      delete options.refresh;
      delete options.render;
      delete options.destroy;
      extend(this, options);
    }

    this.element = el;
    instances.set(el, this);

    if (!this.imageSrc && el.tagName === 'IMG') {
      this.imageSrc = el.getAttribute('src');
    }

    var positions = (this.position + '').toLowerCase().match(/\S+/g) || [];

    if (positions.length < 1) {
      positions.push('center');
    }
    if (positions.length == 1) {
      positions.push(positions[0]);
    }

    if (positions[0] == 'top' || positions[0] == 'bottom' || positions[1] == 'left' || positions[1] == 'right') {
      positions = [positions[1], positions[0]];
    }

    if (this.positionX !== undefined) positions[0] = this.positionX.toLowerCase();
    if (this.positionY !== undefined) positions[1] = this.positionY.toLowerCase();

    self.positionX = positions[0];
    self.positionY = positions[1];

    if (this.positionX != 'left' && this.positionX != 'right') {
      if (isNaN(parseInt(this.positionX))) {
        this.positionX = 'center';
      } else {
        this.positionX = parseInt(this.positionX);
      }
    }

    if (this.positionY != 'top' && this.positionY != 'bottom') {
      if (isNaN(parseInt(this.positionY))) {
        this.positionY = 'center';
      } else {
        this.positionY = parseInt(this.positionY);
      }
    }

    this.position =
      this.positionX + (isNaN(this.positionX)? '' : 'px') + ' ' +
      this.positionY + (isNaN(this.positionY)? '' : 'px');

    // Mobile browsers: plain background image instead of the effect.
    var isIOS = !!window.navigator.userAgent.match(/(iPod|iPhone|iPad)/);
    var isAndroid = !isIOS && !!window.navigator.userAgent.match(/(Android)/);
    if (isIOS || isAndroid) {
      var mobileFix = isIOS ? this.iosFix : this.androidFix;
      if (this.imageSrc && mobileFix && el.tagName !== 'IMG') {
        css([el], {
          backgroundImage: 'url("' + this.imageSrc + '")',
          backgroundSize: 'cover',
          backgroundPosition: this.position
        });
      }
      return this;
    }

    var container = resolve(this.mirrorContainer)[0];
    this.mirror = document.createElement('div');
    container.insertBefore(this.mirror, container.firstChild);

    var existing = Array.prototype.filter.call(el.children, function (child) {
      return child.classList.contains('parallax-slider');
    });

    if (existing.length == 0) {
      this.sliderElements = [document.createElement('img')];
    } else {
      this.sliderElements = existing;
      // Remember where the slider came from so destroy() can put it back.
      this._restore = existing.map(function (node) { return [node, node.getAttribute('style')]; });
    }
    for (var i = this.sliderElements.length - 1; i >= 0; i--) {
      this.mirror.insertBefore(this.sliderElements[i], this.mirror.firstChild);
    }
    this.slider = this.sliderElements[0];

    this.mirror.classList.add('parallax-mirror');
    css([this.mirror], {
      visibility: 'hidden',
      zIndex: this.zIndex,
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'hidden'
    });

    var loaded = false;
    var onLoad = function () {
      if (loaded) { return; }
      loaded = true;
      self.sliderElements.forEach(function (node) { node.removeEventListener('load', onLoad); });
      if (!self.naturalHeight || !self.naturalWidth) {
        self.naturalHeight = this.naturalHeight || this.height || 1;
        self.naturalWidth  = this.naturalWidth  || this.width  || 1;
      }
      self.aspectRatio = self.naturalWidth / self.naturalHeight;

      Parallax.isSetup || Parallax.setup();
      Parallax.sliders.push(self);
      Parallax.isFresh = false;
      Parallax.requestRender();
    };
    this.sliderElements.forEach(function (node) {
      node.classList.add('parallax-slider');
      node.addEventListener('load', onLoad);
    });

    if (existing.length == 0)
      this.slider.src = this.imageSrc;

    if (this.naturalHeight && this.naturalWidth || this.slider.complete || existing.length > 0) {
      onLoad.call(this.slider);
    }
  }


  // ---------------------------------------------------------------------------
  // Parallax Instance Methods
  // ---------------------------------------------------------------------------

  extend(Parallax.prototype, {
    speed:    0.2,
    bleed:    0,
    zIndex:   -100,
    iosFix:   true,
    androidFix: true,
    position: 'center',
    overScrollFix: false,
    mirrorContainer: 'body',

    refresh: function() {
      var el = this.element;
      var boxOffset = offset(el);
      this.boxWidth        = outerSize(el, 'width');
      this.boxHeight       = outerSize(el, 'height') + this.bleed * 2;
      this.boxOffsetTop    = boxOffset.top - this.bleed;
      this.boxOffsetLeft   = boxOffset.left;
      this.boxOffsetBottom = this.boxOffsetTop + this.boxHeight;

      var winHeight = Parallax.winHeight;
      var docHeight = Parallax.docHeight;
      var maxOffset = Math.min(this.boxOffsetTop, docHeight - winHeight);
      var minOffset = Math.max(this.boxOffsetTop + this.boxHeight - winHeight, 0);
      var imageHeightMin = this.boxHeight + (maxOffset - minOffset) * (1 - this.speed) | 0;
      var imageOffsetMin = (this.boxOffsetTop - maxOffset) * (1 - this.speed) | 0;
      var margin;

      if (imageHeightMin * this.aspectRatio >= this.boxWidth) {
        this.imageWidth    = imageHeightMin * this.aspectRatio | 0;
        this.imageHeight   = imageHeightMin;
        this.offsetBaseTop = imageOffsetMin;

        margin = this.imageWidth - this.boxWidth;

        if (this.positionX == 'left') {
          this.offsetLeft = 0;
        } else if (this.positionX == 'right') {
          this.offsetLeft = - margin;
        } else if (!isNaN(this.positionX)) {
          this.offsetLeft = Math.max(this.positionX, - margin);
        } else {
          this.offsetLeft = - margin / 2 | 0;
        }
      } else {
        this.imageWidth    = this.boxWidth;
        this.imageHeight   = this.boxWidth / this.aspectRatio | 0;
        this.offsetLeft    = 0;

        margin = this.imageHeight - imageHeightMin;

        if (this.positionY == 'top') {
          this.offsetBaseTop = imageOffsetMin;
        } else if (this.positionY == 'bottom') {
          this.offsetBaseTop = imageOffsetMin - margin;
        } else if (!isNaN(this.positionY)) {
          this.offsetBaseTop = imageOffsetMin + Math.max(this.positionY, - margin);
        } else {
          this.offsetBaseTop = imageOffsetMin - margin / 2 | 0;
        }
      }
    },

    render: function() {
      var scrollTop    = Parallax.scrollTop;
      var scrollLeft   = Parallax.scrollLeft;
      var overScroll   = this.overScrollFix ? Parallax.overScroll : 0;
      var scrollBottom = scrollTop + Parallax.winHeight;

      if (this.boxOffsetBottom > scrollTop && this.boxOffsetTop <= scrollBottom) {
        this.visibility = 'visible';
        this.mirrorTop = this.boxOffsetTop  - scrollTop;
        this.mirrorLeft = this.boxOffsetLeft - scrollLeft;
        this.offsetTop = this.offsetBaseTop - this.mirrorTop * (1 - this.speed);
      } else {
        this.visibility = 'hidden';
      }

      css([this.mirror], {
        transform: 'translate3d('+this.mirrorLeft+'px, '+(this.mirrorTop - overScroll)+'px, 0px)',
        visibility: this.visibility,
        height: this.boxHeight,
        width: this.boxWidth
      });

      css(this.sliderElements, {
        transform: 'translate3d('+this.offsetLeft+'px, '+this.offsetTop+'px, 0px)',
        position: 'absolute',
        height: this.imageHeight,
        width: this.imageWidth,
        maxWidth: 'none'
      });
    },

    /** Removes the effect from this element (same as Parallax.destroy(el)). */
    destroy: function() {
      Parallax.destroy(this.element);
    }
  });


  // ---------------------------------------------------------------------------
  // Parallax Static Methods
  // ---------------------------------------------------------------------------

  var offWindow = null, frame = null;

  extend(Parallax, {
    scrollTop:    0,
    scrollLeft:   0,
    winHeight:    0,
    winWidth:     0,
    docHeight:    1 << 30,
    docWidth:     1 << 30,
    sliders:      [],
    isReady:      false,
    isFresh:      false,
    isBusy:       false,

    setup: function() {
      if (this.isReady) return;

      var self = this;

      var loadDimensions = function() {
        Parallax.winHeight = document.documentElement.clientHeight;
        Parallax.winWidth  = document.documentElement.clientWidth;
        Parallax.docHeight = documentSize('height');
        Parallax.docWidth  = documentSize('width');
      };

      var loadScrollPosition = function() {
        var winScrollTop  = window.pageYOffset;
        var scrollTopMax  = Parallax.docHeight - Parallax.winHeight;
        var scrollLeftMax = Parallax.docWidth  - Parallax.winWidth;
        Parallax.scrollTop  = Math.max(0, Math.min(scrollTopMax,  winScrollTop));
        Parallax.scrollLeft = Math.max(0, Math.min(scrollLeftMax, window.pageXOffset));
        Parallax.overScroll = Math.max(winScrollTop - scrollTopMax, Math.min(winScrollTop, 0));
      };

      var offResize = listen(window, 'resize load', function() {
        loadDimensions();
        self.refresh();
        Parallax.isFresh = false;
        Parallax.requestRender();
      });
      var offScroll = listen(window, 'scroll load', function() {
        loadScrollPosition();
        Parallax.requestRender();
      });
      offWindow = function () { offResize(); offScroll(); };

      loadDimensions();
      loadScrollPosition();

      this.isReady = true;

      var lastPosition = -1;

      function frameLoop() {
        if (lastPosition == window.pageYOffset) {   // Avoid overcalculations
          frame = window.requestAnimationFrame(frameLoop);
          return false;
        } else lastPosition = window.pageYOffset;

        self.render();
        frame = window.requestAnimationFrame(frameLoop);
      }

      frameLoop();
    },

    /** Changes the defaults for sliders created afterwards. */
    configure: function(options) {
      if (options && typeof options == 'object') {
        options = extend({}, options);
        delete options.refresh;
        delete options.render;
        delete options.destroy;
        extend(this.prototype, options);
      }
    },

    refresh: function() {
      this.sliders.forEach(function (slider) { slider.refresh(); });
      this.isFresh = true;
    },

    render: function() {
      this.isFresh || this.refresh();
      this.sliders.forEach(function (slider) { slider.render(); });
    },

    requestRender: function() {
      var self = this;
      self.render();
      self.isBusy = false;
    },

    /** Removes the effect from an element. */
    destroy: function(el){
      var i,
          node = resolve(el)[0],
          parallaxElement = node && instances.get(node);
      if (!parallaxElement) { return; }
      if (parallaxElement.mirror) {
        // Put a .parallax-slider that came from the element's markup back.
        (parallaxElement._restore || []).forEach(function (entry) {
          if (entry[1] === null) { entry[0].removeAttribute('style'); } else { entry[0].setAttribute('style', entry[1]); }
          node.appendChild(entry[0]);
        });
        if (parallaxElement.mirror.parentNode) { parallaxElement.mirror.parentNode.removeChild(parallaxElement.mirror); }
      }
      for(i=0; i < this.sliders.length; i+=1){
        if(this.sliders[i] == parallaxElement){
          this.sliders.splice(i, 1);
        }
      }
      instances.delete(node);
      if (bridge.forget) { bridge.forget(node); }
      if(this.sliders.length === 0){
        if (offWindow) { offWindow(); offWindow = null; }
        if (frame !== null) { window.cancelAnimationFrame(frame); frame = null; }
        this.isReady = false;
        Parallax.isSetup = false;
      }
    },

    /** Returns the instance attached to an element (or selector). */
    getInstance: function(el) {
      var node = resolve(el)[0];
      return node ? instances.get(node) : undefined;
    },

    /**
     * Same as $(target).parallax(option) in 1.x: creates the effect on each
     * element (reading data-* attributes as options), updates the options of
     * elements that already have it, or runs a command ('refresh', 'render',
     * 'destroy'). Passing window, document or body changes the defaults.
     * Returns the instances.
     */
    init: function(target, option) {
      var options = typeof option == 'object' && option;
      var list = [];
      resolve(target).forEach(function (node) {
        if (node == window || node == document || node === document.body) {
          Parallax.configure(options);
        } else if (!instances.has(node)) {
          list.push(new Parallax(node, extend({}, readData(node), options)));
        } else {
          if (typeof option == 'object') { extend(instances.get(node), options); }
          list.push(instances.get(node));
        }
        if (typeof option == 'string') {
          if (option == 'destroy') {
            Parallax.destroy(node);
          } else {
            Parallax[option]();
          }
        }
      });
      return list;
    }
  });

  Parallax.version = '2.0.0';


  // ---------------------------------------------------------------------------
  // jQuery bridge: $(el).parallax(), $.fn.parallax.Constructor,
  // $.fn.parallax.noConflict() and $(el).data('px.parallax') keep working.
  // ---------------------------------------------------------------------------

  var ELEMENT_PROPS = { $element: 'element', $mirror: 'mirror', $slider: 'sliderElements' };

  Parallax.installJQuery = function ($) {
    if (!$ || !$.fn || ($.fn.parallax && $.fn.parallax.Constructor === Parallax)) { return; }

    // 1.x instances carried jQuery objects for the element, mirror and slider.
    Object.keys(ELEMENT_PROPS).forEach(function (key) {
      Object.defineProperty(Parallax.prototype, key, {
        configurable: true,
        get: function () { return this[ELEMENT_PROPS[key]] ? $(this[ELEMENT_PROPS[key]]) : undefined; },
        set: function (value) {
          var nodes = value && value.jquery ? Array.prototype.slice.call(value) : value;
          if (key === '$slider') {
            this.sliderElements = resolve(nodes);
            this.slider = this.sliderElements[0];
          } else {
            this[ELEMENT_PROPS[key]] = resolve(nodes)[0];
          }
        }
      });
    });

    // 1.x bound its window handlers with jQuery, so $(window).trigger('resize')
    // or 'scroll' reached them. Mirror the native listeners with jQuery
    // handlers that only run for triggered events.
    bridge.listen = function (target, type, handler) {
      var mirror = function (ev) {
        if (ev.originalEvent) { return; }
        return handler.call(this, ev);
      };
      $(target).on(type + '.px.parallax', mirror);
      return function () { $(target).off(type + '.px.parallax', mirror); };
    };
    bridge.forget = function (node) {
      if ($.data(node, 'px.parallax')) { $.data(node, 'px.parallax', false); }
    };

    // Parallax Plugin Definition
    function Plugin(option) {
      return this.each(function () {
        var $this = $(this);
        var options = typeof option == 'object' && option;

        if (this == window || this == document || $this.is('body')) {
          Parallax.configure(options);
        }
        else if (!$this.data('px.parallax')) {
          options = $.extend({}, $this.data(), options);
          $this.data('px.parallax', new Parallax(this, options));
        }
        else if (typeof option == 'object')
        {
          $.extend($this.data('px.parallax'), options);
        }
        if (typeof option == 'string') {
          if(option == 'destroy'){
              Parallax.destroy(this);
          }else{
            Parallax[option]();
          }
        }
      });
    }

    var old = $.fn.parallax;

    $.fn.parallax             = Plugin;
    $.fn.parallax.Constructor = Parallax;

    // Parallax No Conflict
    $.fn.parallax.noConflict = function () {
      $.fn.parallax = old;
      return this;
    };

    // Parallax Data-API
    $(function () {
      $('[data-parallax="scroll"]').parallax();
    });
  };

  if (window.jQuery) {
    Parallax.installJQuery(window.jQuery);
  } else if (document) {
    // Parallax Data-API without jQuery.
    var autoInit = function () { Parallax.init('[data-parallax="scroll"]'); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoInit);
    } else {
      setTimeout(autoInit);
    }
  }

  return Parallax;
}));
