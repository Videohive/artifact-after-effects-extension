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
