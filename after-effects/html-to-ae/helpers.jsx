  // ============================================================
  // HELPERS
  // ============================================================

  var AE2_DEBUG = typeof AE2_DEBUG !== "undefined" ? AE2_DEBUG : false;
  var COLOR_CONTROL_REGISTRY = COLOR_CONTROL_REGISTRY || {};
  var CONTROLS_COMP_NAME = CONTROLS_COMP_NAME || null;
  var CONTROLS_LAYER_NAME = CONTROLS_LAYER_NAME || "Controls";

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
    var s = String(css).trim().toLowerCase();
    if (s.charAt(0) === "#") {
      var hex = s.slice(1);
      if (hex.length === 4) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
      } else if (hex.length === 8) {
        hex = hex.slice(0, 6);
      }
      if (hex.length === 3) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
      }
      if (hex.length === 6) {
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          return [r / 255, g / 255, b / 255];
        }
      }
    }
    var m = s.match(/[\d.]+/g);
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

  function clamp01(value) {
    var v = Number(value);
    if (!isFinite(v)) return 1;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function roundColorValue(value) {
    var v = Number(value);
    if (!isFinite(v)) return 0;
    return Math.round(v * 10000) / 10000;
  }

  function buildColorKey(rgb) {
    if (!rgb || rgb.length < 3) return null;
    return (
      roundColorValue(rgb[0]) +
      "," +
      roundColorValue(rgb[1]) +
      "," +
      roundColorValue(rgb[2])
    );
  }

  function setControlsCompName(compName) {
    if (!COLOR_CONTROL_REGISTRY) COLOR_CONTROL_REGISTRY = {};
    if (!CONTROLS_LAYER_NAME) CONTROLS_LAYER_NAME = "Controls";
    if (!compName) return;
    if (CONTROLS_COMP_NAME && CONTROLS_COMP_NAME !== compName) return;
    CONTROLS_COMP_NAME = compName;
    if (CONTROLS_COMP_NAME && !COLOR_CONTROL_REGISTRY[CONTROLS_COMP_NAME]) {
      COLOR_CONTROL_REGISTRY[CONTROLS_COMP_NAME] = {
        layerName: CONTROLS_LAYER_NAME,
        colors: {},
      };
    }
  }

  function registerColorControl(compName, effectName, cssColor) {
    if (!compName || !effectName || !cssColor) return;
    if (!COLOR_CONTROL_REGISTRY) COLOR_CONTROL_REGISTRY = {};
    var rgb = parseCssColor(cssColor);
    var key = buildColorKey(rgb);
    if (!key) return;
    if (!COLOR_CONTROL_REGISTRY[compName]) {
      COLOR_CONTROL_REGISTRY[compName] = {
        layerName: CONTROLS_LAYER_NAME,
        colors: {},
      };
    }
    COLOR_CONTROL_REGISTRY[compName].colors[key] = effectName;
  }

  function getColorControlEffectName(rgb) {
    if (!CONTROLS_COMP_NAME) return null;
    if (!COLOR_CONTROL_REGISTRY) COLOR_CONTROL_REGISTRY = {};
    var entry = COLOR_CONTROL_REGISTRY[CONTROLS_COMP_NAME];
    if (!entry) return null;
    var key = buildColorKey(rgb);
    return key && entry.colors[key] ? entry.colors[key] : null;
  }

  function applyColorExpression(prop, effectName, currentCompName) {
    if (!prop || !effectName) return;
    if (!prop.canSetExpression) return;
    if (!CONTROLS_COMP_NAME) return;
    if (!CONTROLS_LAYER_NAME) CONTROLS_LAYER_NAME = "Controls";
    var compRef =
      currentCompName && CONTROLS_COMP_NAME && currentCompName === CONTROLS_COMP_NAME
        ? "thisComp"
        : 'comp("' + CONTROLS_COMP_NAME + '")';
    prop.expression =
      compRef +
      '.layer("' +
      CONTROLS_LAYER_NAME +
      '").effect("' +
      effectName +
      '")(1)';
  }

  function applyRgbColorProperty(prop, rgb, alpha, currentCompName) {
    if (!prop || !rgb) return;
    prop.setValue(rgb);
    var effectName = getColorControlEffectName(rgb);
    if (effectName) applyColorExpression(prop, effectName, currentCompName);
  }

  function applyCssColorProperty(prop, cssColor, currentCompName) {
    if (!prop || !cssColor) return;
    var rgb = parseCssColor(cssColor);
    var alpha = parseCssAlpha(cssColor);
    applyRgbColorProperty(prop, rgb, alpha, currentCompName);
  }

  function applyFillEffect(layer, rgb, alpha) {
    if (!layer) return;
    var effects = layer.property("Effects");
    if (!effects) return;
    var effect = effects.addProperty("ADBE Fill");
    if (!effect) return;
    var colorProp = effect.property("Color");
    if (colorProp) {
      var compName = layer.containingComp ? layer.containingComp.name : null;
      applyRgbColorProperty(colorProp, rgb, alpha, compName);
    }
    var opacityProp = effect.property("Opacity");
    if (opacityProp) {
      var a = clamp01(alpha);
      var maxOpacity = opacityProp.maxValue;
      if (!isFinite(maxOpacity) || maxOpacity <= 0) maxOpacity = 100;
      opacityProp.setValue(Math.round(a * maxOpacity));
    }
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
    // normalize for AE: hyphens to spaces + title case
    s = formatAeName(s);
    // trim
    s = trim(s);
    if (s.length === 0) s = "Layer";
    return s;
  }

  function formatAeName(value) {
    if (value === null || value === undefined) return "";
    var s = String(value).replace(/-/g, " ");
    s = trim(s);
    if (!s) return "";
    var parts = s.split(/\s+/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      var first = p.charAt(0).toUpperCase();
      var rest = p.length > 1 ? p.slice(1).toLowerCase() : "";
      parts[i] = first + rest;
    }
    return parts.join(" ");
  }

  function trim(s) {
    return String(s).replace(/^\s+|\s+$/g, "");
  }

  function normalizeSlides(data) {
    if (!data) return [];
    if (data instanceof Array) return data;
    if (data.artifacts && data.artifacts instanceof Array) {
      var rootSettings = data.settings || null;
      var list = [];
      for (var i = 0; i < data.artifacts.length; i++) {
        var item = data.artifacts[i];
        if (!item) continue;
        if (!item.settings && rootSettings) item.settings = rootSettings;
        list.push(item);
      }
      return list;
    }
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
