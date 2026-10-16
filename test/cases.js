/* global $, ParallaxScroll */
// Test cases shared by every implementation. test/run.js performs the
// actions (scrolling, resizing, plugin calls) and compares snapshots between
// the original jQuery plugin and the rewrite.
(function () {
  'use strict';

  var useJQ = window.JQ !== 'none';
  var WIDE = '/repo/test/fixtures/wide.svg', TALL = '/repo/test/fixtures/tall.svg';
  var spacer = '<div class="spacer"></div>';
  function section(id, attrs, inner) {
    return '<div class="section" id="' + id + '"' + (attrs || '') + '>' + (inner || '') + '</div>';
  }

  var scrolls = [{ scroll: 0 }, { scroll: 250 }, { scroll: 700 }, { scroll: 1300 }, { scroll: 2100 }, { scroll: 99999 }];

  var cases = {
    dataApi: {
      html: spacer + section('a', ' data-parallax="scroll" data-image-src="' + WIDE + '" data-speed="0.4" data-position="left top"') + spacer +
        section('b', ' data-parallax="scroll" data-image-src="' + TALL + '" data-bleed="10" data-z-index="-3"') + spacer,
      init: [],
      actions: scrolls.concat([{ resize: [700, 500] }, { scroll: 900 }])
    },
    options: {
      html: spacer + section('a') + section('b') + section('c') + section('d') + section('e') + section('f') + section('g') + spacer,
      init: [
        ['#a', { imageSrc: WIDE, position: 'right bottom' }],
        ['#b', { imageSrc: WIDE, position: '20px 40px', speed: 0.7 }],
        ['#c', { imageSrc: TALL, position: 'top', positionX: 'Right' }],
        ['#d', { imageSrc: TALL, positionY: 'bottom', bleed: 30 }],
        ['#e', { imageSrc: WIDE, overScrollFix: true, zIndex: 5 }],
        ['#f', { imageSrc: TALL, position: 'center 25' }],
        ['#g', { imageSrc: WIDE, position: 'left', speed: -0.3 }]
      ],
      actions: scrolls.concat([{ scroll: 3100 }, { scroll: 4300 }])
    },
    existingSlider: {
      html: spacer + section('a', '', '<div class="parallax-slider" style="background:#c33"><span>Inner content</span></div>') +
        section('b', '', '<img class="parallax-slider" src="' + WIDE + '"><p>not a slider</p>') + spacer,
      init: [['#a', { naturalWidth: 1000, naturalHeight: 500 }], ['#b', {}]],
      actions: [{ scroll: 300 }, { scroll: 900 }]
    },
    imgTarget: {
      html: spacer + '<img id="a" src="' + WIDE + '" style="display:block;width:400px;height:300px">' + spacer,
      init: [['#a', {}]],
      actions: [{ scroll: 200 }, { scroll: 600 }]
    },
    reinit: {
      html: spacer + section('a') + spacer,
      init: [['#a', { imageSrc: WIDE }]],
      actions: [{ plugin: ['#a', { speed: 0.8 }] }, { scroll: 300 }, { plugin: ['#a', 'refresh'] }, { scroll: 400 }, { plugin: ['#a', 'render'] },
        { plugin: ['#a', { imageSrc: TALL, position: 'right' }] }, { plugin: ['#a', 'refresh'] }, { scroll: 450 }]
    },
    configure: {
      html: spacer + section('a') + section('b') + spacer,
      init: [['window', { speed: 0.9, bleed: 5, refresh: 'ignored' }], ['#a', { imageSrc: WIDE }]],
      actions: [{ plugin: ['body', { speed: 0.1 }] }, { plugin: ['#b', { imageSrc: TALL }] }, { scroll: 500 }, { plugin: ['document', { zIndex: 7 }] }, { scroll: 600 }]
    },
    destroy: {
      html: spacer + section('a') + section('b') + spacer,
      init: [['#a', { imageSrc: WIDE }], ['#b', { imageSrc: TALL }]],
      actions: [{ scroll: 300 }, { plugin: ['#a', 'destroy'] }, { scroll: 700 }, { plugin: ['#b', 'destroy'] }, { scroll: 800 },
        { plugin: ['#a', { imageSrc: WIDE, speed: 0.5 }] }, { scroll: 400 }, { resize: [900, 600] }]
    },
    commandOnNew: {
      html: spacer + section('a', ' data-image-src="' + WIDE + '"') + spacer,
      init: [['#a', 'refresh']],
      actions: [{ scroll: 300 }]
    },
    mirrorContainer: {
      html: '<div id="container"><p>first</p></div>' + spacer + section('a') + spacer,
      init: [['#a', { imageSrc: WIDE, mirrorContainer: '#container' }]],
      actions: [{ scroll: 300 }]
    },
    resize: {
      html: spacer + section('a') + section('b', ' style="width:50%"') + spacer,
      init: [['#a, #b', { imageSrc: WIDE }]],
      actions: [{ scroll: 500 }, { resize: [600, 900] }, { resize: [1400, 700] }, { scroll: 1200 }, { resize: [1000, 800] }]
    },
    hidden: {
      html: spacer + section('a', ' style="display:none"') + section('b') + spacer,
      init: [['#a', { imageSrc: WIDE }], ['#b', { imageSrc: WIDE }]],
      actions: [{ scroll: 200 }, { js: "document.getElementById('a').style.display = ''" }, { resize: [1001, 800] }, { scroll: 300 }]
    },
    jqTriggers: {
      jqOnly: true,
      html: spacer + section('a') + spacer,
      init: [['#a', { imageSrc: WIDE }]],
      actions: [{ scroll: 300 }, { js: "document.getElementById('a').style.height = '520px'; jQuery(window).trigger('resize')" },
        { js: "document.getElementById('a').style.height = '200px'; jQuery(window).resize()" },
        { js: "document.getElementById('a').style.marginTop = '50px'; jQuery(window).trigger('load')" }]
    },
    ios: {
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      html: spacer + section('a') + section('b') + '<img id="c" src="' + WIDE + '">' + spacer,
      init: [['#a', { imageSrc: WIDE, position: 'left 10px' }], ['#b', { imageSrc: WIDE, iosFix: false }], ['#c', {}]],
      actions: [{ scroll: 300 }]
    },
    android: {
      ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      html: spacer + section('a') + section('b') + spacer,
      init: [['#a', { imageSrc: TALL, position: 'right top' }], ['#b', { imageSrc: WIDE, androidFix: false }]],
      actions: [{ scroll: 300 }]
    }
  };

  function els(sel) {
    if (sel === 'window') { return [window]; }
    if (sel === 'document') { return [document]; }
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  function plugin(sel, opt) {
    if (useJQ) {
      $(els(sel)).parallax(opt);
    } else {
      ParallaxScroll.init(els(sel), opt);
    }
  }

  function Ctor() { return useJQ ? $.fn.parallax.Constructor : ParallaxScroll; }
  function instance(el) { return useJQ ? $(el).data('px.parallax') : ParallaxScroll.getInstance(el); }
  function r(n) { return typeof n === 'number' ? Math.round(n * 10) / 10 : n; }

  var PROPS = ['speed', 'bleed', 'zIndex', 'position', 'positionX', 'positionY', 'imageSrc', 'naturalWidth', 'naturalHeight', 'aspectRatio',
    'boxWidth', 'boxHeight', 'boxOffsetTop', 'boxOffsetLeft', 'imageWidth', 'imageHeight', 'offsetBaseTop', 'offsetLeft', 'offsetTop',
    'mirrorTop', 'mirrorLeft', 'visibility', 'overScrollFix', 'parallax'];

  window.T = {
    cases: cases,
    markup: function (name) {
      document.getElementById('stage').innerHTML = cases[name].html;
    },
    setup: function (name) {
      cases[name].init.forEach(function (i) { plugin(i[0], i[1]); });
      return cases[name].actions;
    },
    plugin: plugin,
    snap: function () {
      var P = Ctor();
      var mirrors = Array.prototype.map.call(document.querySelectorAll('.parallax-mirror'), function (m) {
        return [m.parentNode.id || m.parentNode.tagName, m.style.transform, m.style.visibility, m.style.width, m.style.height, m.style.zIndex, m.style.position]
          .concat(Array.prototype.map.call(m.children, function (s) {
            return [s.tagName, s.className, s.style.transform, s.style.width, s.style.height, s.style.position, s.style.maxWidth, (s.getAttribute('src') || '').split('/').pop()].join(',');
          })).join(' | ');
      });
      var targets = Array.prototype.map.call(document.querySelectorAll('#stage [id]'), function (el) {
        var inst = instance(el);
        return [el.id, el.style.backgroundImage.split('/').pop(), el.style.backgroundSize, el.style.backgroundPosition,
          Array.prototype.map.call(el.children, function (c) { return c.className || c.tagName; }).join('+'),
          inst ? PROPS.map(function (k) { return k + '=' + r(inst[k]); }).join(' ') : 'none'].join(' ; ');
      });
      return {
        mirrors: mirrors,
        targets: targets,
        statics: ['scrollTop', 'scrollLeft', 'winHeight', 'winWidth', 'docHeight', 'docWidth', 'isReady', 'isFresh', 'overScroll']
          .map(function (k) { return k + '=' + r(P[k]); }).join(' ') + ' sliders=' + P.sliders.length,
        defaults: ['speed', 'bleed', 'zIndex'].map(function (k) { return P.prototype[k]; }).join(',')
      };
    }
  };
}());
