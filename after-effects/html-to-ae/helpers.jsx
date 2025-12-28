  // ============================================================
  // HELPERS
  // ============================================================

  var AE2_DEBUG = typeof AE2_DEBUG !== "undefined" ? AE2_DEBUG : false;

  function debugLog(msg) {
    if (!AE2_DEBUG) return;
    try {
      $.writeln("[AE2] " + msg);
    } catch (e) {}
  }

  function getLocalBBox(node, origin) {
    return {
      x: node.bbox.x - origin.x,
      y: node.bbox.y - origin.y,
      w: node.bbox.w,
      h: node.bbox.h,
    };
  }

  function toAETracking(value) {
    if (value === undefined || value === null) return 0;
    var v = Number(value);
    if (isNaN(v)) return 0;
    return Math.round(v);
  }

  function parseCssColor(css) {
    // Supports rgb(r,g,b) or rgba(r,g,b,a). Returns [0..1,0..1,0..1]
    if (!css) return [1, 1, 1];
    var m = String(css).match(/[\d.]+/g);
    if (!m || m.length < 3) return [1, 1, 1];
    return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
  }

  function parseCssAlpha(css) {
    if (!css) return 1;
    var s = String(css).toLowerCase();
    if (s === "transparent") return 0;
    if (s.charAt(0) === "#") {
      var hex = s.slice(1);
      if (hex.length === 4) {
        var a4 = parseInt(hex.charAt(3) + hex.charAt(3), 16);
        if (!isNaN(a4)) return a4 / 255;
      }
      if (hex.length === 8) {
        var a8 = parseInt(hex.slice(6, 8), 16);
        if (!isNaN(a8)) return a8 / 255;
      }
      return 1;
    }
    var slash = s.match(/\/\s*([0-9.]+%?)/);
    if (slash && slash[1]) {
      var raw = slash[1];
      if (raw.indexOf("%") > -1) {
        var pct = parseFloat(raw);
        if (!isNaN(pct)) return Math.max(0, Math.min(1, pct / 100));
      }
      var num = parseFloat(raw);
      if (!isNaN(num)) return Math.max(0, Math.min(1, num));
    }
    if (s.indexOf("rgba") === 0 || s.indexOf("hsla") === 0) {
      var m = s.match(/[\d.]+/g);
      if (m && m.length >= 4) return Math.max(0, Math.min(1, Number(m[3])));
    }
    return 1;
  }

  function isTransparentColor(css) {
    if (!css) return true;
    var s = String(css).toLowerCase();
    if (s === "transparent") return true;
    if (s.indexOf("rgba") === 0) {
      var m = s.match(/[\d.]+/g);
      if (m && m.length >= 4) return Number(m[3]) === 0;
    }
    return false;
  }

  function getEffectiveBackgroundColor(style) {
    if (!style) return null;
    var bg = style.backgroundColor;
    if (bg && !isTransparentColor(bg)) return bg;

    var grads = style.backgroundGradients;
    if (grads && grads.length) {
      var first = grads[0];
      if (first && first.stops && first.stops.length && first.stops[0].color) {
        var c = first.stops[0].color;
        if (c && !isTransparentColor(c)) return c;
      }
    }

    return null;
  }

  function hasEffectiveBackground(style) {
    return !!getEffectiveBackgroundColor(style);
  }

  function safeName(n) {
    if (!n) return "Layer";
    var s = String(n);
    // remove illegal chars
    s = s.replace(/[\r\n\t]/g, " ").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
    // trim
    s = trim(s);
    if (s.length === 0) s = "Layer";
    return s;
  }

  function trim(s) {
    return String(s).replace(/^\s+|\s+$/g, "");
  }

  function normalizeSlides(data) {
    if (!data) return [];
    if (data instanceof Array) return data;
    if (data.slides && data.slides instanceof Array) return data.slides;
    return [data];
  }

  function isValidSlide(slide) {
    return slide && slide.viewport && slide.root;
  }

  function getZIndexValue(node) {
    if (!node || !node.style) return 0;
    var z = node.style.zIndex;
    if (z === null || typeof z === "undefined") return 0;
    var n = Number(z);
    if (isNaN(n)) return 0;
    return n;
  }

  function orderChildrenByZIndex(children) {
    if (!children || !children.length) return children;

    var list = [];
    for (var i = 0; i < children.length; i++) {
      list.push({ node: children[i], index: i, z: getZIndexValue(children[i]) });
    }

    list.sort(function (a, b) {
      if (a.z < b.z) return -1;
      if (a.z > b.z) return 1;
      if (a.index < b.index) return -1;
      if (a.index > b.index) return 1;
      return 0;
    });

    var ordered = [];
    for (var j = 0; j < list.length; j++) ordered.push(list[j].node);
    return ordered;
  }
