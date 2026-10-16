/* global $, ParallaxScroll */
// Checks for behaviour that only exists in the rewrite. Run by test/run.js
// with and without jQuery, each check on a fresh page.
(function () {
  'use strict';

  var useJQ = window.JQ !== 'none';
  var WIDE = '/repo/test/fixtures/wide.svg';
  var P = window.ParallaxScroll;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function assert(cond, msg) { if (!cond) { throw new Error(msg); } }
  function stage(html) { document.getElementById('stage').innerHTML = '<div class="spacer"></div>' + html + '<div class="spacer"></div>'; }
  function mirrors() { return document.querySelectorAll('.parallax-mirror').length; }

  var tests = {
    'globals': async function () {
      assert(window.Parallax === P && typeof P.init === 'function' && P.version === '2.0.0', 'globals');
    },

    'native API: constructor, init, getInstance': async function () {
      stage('<div class="section" id="a"></div><div class="section" id="b"></div>');
      var a = new P('#a', { imageSrc: WIDE, speed: 0.5 });
      assert(P.getInstance('#a') === a && new P(document.getElementById('a')) === a, 'registry');
      assert(a.element.id === 'a' && a.mirror.classList.contains('parallax-mirror') && a.slider.tagName === 'IMG', 'element refs');
      var list = P.init('#a, #b', { imageSrc: WIDE });
      assert(list.length === 2 && list[0] === a && P.getInstance('#b') === list[1], 'init');
      assert(mirrors() === 2, 'mirrors: ' + mirrors());
      await sleep(100);
      window.scrollTo(0, 400);
      await sleep(150);
      assert(a.visibility === 'visible' && a.mirror.style.visibility === 'visible', 'not rendered on scroll');
    },

    'data attributes are read like $(el).data()': async function () {
      stage('<div class="section" id="a" data-image-src="' + WIDE + '" data-speed="0.5" data-bleed="12" data-over-scroll-fix="true" data-position="left top" data-z-index="-7"></div>');
      var a = P.init('#a')[0];
      assert(a.speed === 0.5 && a.bleed === 12 && a.overScrollFix === true && a.zIndex === -7 && a.positionX === 'left', 'data: ' +
        [a.speed, a.bleed, a.overScrollFix, a.zIndex, a.positionX].join());
      assert(a.mirror.style.zIndex === '-7', 'zIndex not applied');
    },

    'destroy removes the effect and restores slider markup': async function () {
      stage('<div class="section" id="a"><div class="parallax-slider" style="color: red;"><span>x</span></div></div><div class="section" id="b"></div>');
      var before = document.getElementById('a').outerHTML;
      var a = new P('#a', { naturalWidth: 100, naturalHeight: 50 });
      var b = new P('#b', { imageSrc: WIDE });
      await sleep(100);
      assert(document.getElementById('a').children.length === 0, 'slider not moved into the mirror');
      a.destroy();
      assert(document.getElementById('a').outerHTML === before, 'markup not restored:\n' + document.getElementById('a').outerHTML);
      assert(P.getInstance('#a') === undefined && P.sliders.length === 1 && mirrors() === 1, 'state after first destroy');
      P.destroy('#b');
      assert(P.sliders.length === 0 && mirrors() === 0 && !P.isReady, 'state after last destroy');
      P.destroy('#b');
      P.destroy('#nothing');
      // The frame loop stops once nothing is left, and only one runs after re-init.
      var calls = 0, raf = window.requestAnimationFrame;
      window.requestAnimationFrame = function (fn) { calls++; return raf.call(window, fn); };
      await sleep(200);
      assert(calls === 0, 'frame loop still running: ' + calls);
      new P('#b', { imageSrc: WIDE });
      await sleep(100);
      // Count real frames with our own loop (through the original function).
      var frames = 0, counting = true;
      (function tick() { if (counting) { frames++; raf.call(window, tick); } })();
      calls = 0;
      await sleep(500);
      counting = false;
      window.requestAnimationFrame = raf;
      assert(frames > 5 && calls > frames * 0.5 && calls < frames * 1.5, 'expected one frame loop: ' + calls + ' calls in ' + frames + ' frames');
      if (useJQ) { assert($('#a').data('px.parallax') === undefined || $('#a').data('px.parallax') === false, 'jQuery data'); }
    },

    'configure changes defaults; methods cannot be overridden': async function () {
      var original = P.prototype.refresh;
      P.configure({ speed: 0.6, refresh: 'x', render: 'y', destroy: 'z' });
      assert(P.prototype.speed === 0.6 && P.prototype.refresh === original && typeof P.prototype.destroy === 'function', 'configure');
      stage('<div class="section" id="a"></div>');
      var a = new P('#a', { imageSrc: WIDE, refresh: 'nope' });
      assert(a.speed === 0.6 && a.refresh === original, 'instance');
    },

    'commands through init()': async function () {
      stage('<div class="section" id="a"></div>');
      P.init('#a', { imageSrc: WIDE });
      P.init(window, { bleed: 3 });
      assert(P.prototype.bleed === 3, 'window configures');
      P.init('#a', { speed: 0.9 });
      assert(P.getInstance('#a').speed === 0.9, 'options update');
      P.init('#a', 'refresh');
      P.init('#a', 'destroy');
      assert(!P.getInstance('#a') && mirrors() === 0, 'destroy command');
    }
  };

  if (useJQ) {
    Object.assign(tests, {
      'jQuery: instance carries $element, $mirror, $slider': async function () {
        stage('<div class="section" id="a"></div>');
        $('#a').parallax({ imageSrc: WIDE });
        var inst = $('#a').data('px.parallax');
        assert(inst instanceof P && $.fn.parallax.Constructor === P, 'Constructor');
        assert(inst.$element.jquery && inst.$element[0].id === 'a', '$element');
        assert(inst.$mirror.jquery && inst.$mirror.hasClass('parallax-mirror'), '$mirror');
        assert(inst.$slider.jquery && inst.$slider.is('img.parallax-slider'), '$slider');
        $('#a').parallax('destroy');
        assert($('#a').data('px.parallax') === false && mirrors() === 0, 'destroy');
      },
      'jQuery: noConflict restores the previous plugin': async function () {
        var current = $.fn.parallax;
        var restored = $.fn.parallax.noConflict();
        assert(restored === current && $.fn.parallax !== current, 'noConflict');
        $.fn.parallax = current;
      },
      'jQuery: plugin can be installed after parallax.js loaded': async function () {
        var fake = function (x) { return $(x); };
        fake.fn = {};
        P.installJQuery(fake);
        assert(typeof fake.fn.parallax === 'function' && fake.fn.parallax.Constructor === P, 'not installed');
      }
    });
  }

  window.API_TESTS = tests;
}());
