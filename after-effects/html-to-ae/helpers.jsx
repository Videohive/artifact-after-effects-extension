  // ============================================================
  // HELPERS
  // ============================================================

  var AE2_DEBUG = typeof AE2_DEBUG !== "undefined" ? AE2_DEBUG : false;
  var ANIMATION = typeof ANIMATION !== "undefined" ? ANIMATION : true;
  var ANIMATION_EXPRESSION = typeof ANIMATION_EXPRESSION !== "undefined" ? ANIMATION_EXPRESSION : true;
  var AE2_MOTION_TIME_OFFSET = 0;
  var AE2_COMP_TIME_OFFSET = 0;
  var COLOR_CONTROL_REGISTRY = COLOR_CONTROL_REGISTRY || {};
  var CONTROLS_COMP_NAME = CONTROLS_COMP_NAME || null;
  var CONTROLS_LAYER_NAME = CONTROLS_LAYER_NAME || "Controls";

  function isAnimationEnabled() {
    return ANIMATION === true;
  }

  function useExpressionAnimation() {
    return ANIMATION === true && ANIMATION_EXPRESSION === true;
  }

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
    // var opacityProp = effect.property("Opacity");
    // if (opacityProp) {
    //   var a = clamp01(alpha);
    //   var maxOpacity = opacityProp.maxValue;
    //   if (!isFinite(maxOpacity) || maxOpacity <= 0) maxOpacity = 100;
    //   opacityProp.setValue(Math.round(a * maxOpacity));
    // }
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
    if (style.backgroundGrid) return null;
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

  function parseGradientStopPosition(value) {
    if (value === null || typeof value === "undefined") return null;
    if (typeof value === "number") {
      if (!isFinite(value)) return null;
      if (value > 1) return clamp01(value / 100);
      return clamp01(value);
    }
    var s = String(value).trim();
    if (!s) return null;
    if (s.indexOf("%") !== -1) {
      var pct = parseFloat(s);
      if (!isFinite(pct)) return null;
      return clamp01(pct / 100);
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    if (n > 1) return clamp01(n / 100);
    return clamp01(n);
  }

  function parseLinearGradientAngle(raw) {
    if (!raw) return 180;
    var s = String(raw).toLowerCase();
    var degMatch = s.match(/linear-gradient\(\s*([-\d.]+)deg/);
    if (degMatch && degMatch[1]) {
      var deg = parseFloat(degMatch[1]);
      if (isFinite(deg)) return deg;
    }

    var toMatch = s.match(/linear-gradient\(\s*to\s+([a-z\s]+)/);
    if (toMatch && toMatch[1]) {
      var dir = toMatch[1].replace(/,/g, " ").replace(/\s+/g, " ").trim();
      var hasTop = dir.indexOf("top") !== -1;
      var hasBottom = dir.indexOf("bottom") !== -1;
      var hasLeft = dir.indexOf("left") !== -1;
      var hasRight = dir.indexOf("right") !== -1;
      if (hasTop && hasRight) return 45;
      if (hasBottom && hasRight) return 135;
      if (hasBottom && hasLeft) return 225;
      if (hasTop && hasLeft) return 315;
      if (hasTop) return 0;
      if (hasRight) return 90;
      if (hasBottom) return 180;
      if (hasLeft) return 270;
    }

    return 180;
  }

  function normalizeGradientStops(stops) {
    if (!stops || !stops.length) return [];
    var out = [];
    for (var i = 0; i < stops.length; i++) {
      var st = stops[i];
      if (!st || !st.color) continue;
      out.push({
        color: st.color,
        position: parseGradientStopPosition(st.position),
      });
    }
    if (!out.length) return out;
    var hasMissing = false;
    for (var j = 0; j < out.length; j++) {
      if (out[j].position === null) {
        hasMissing = true;
        break;
      }
    }
    if (hasMissing) {
      var count = out.length;
      for (var k = 0; k < count; k++) {
        out[k].position = count === 1 ? 0 : k / (count - 1);
      }
    }
    out.sort(function (a, b) {
      return a.position - b.position;
    });
    return out;
  }

  function getBackgroundGradients(style) {
    if (!style || style.backgroundGrid) return [];
    var grads = style.backgroundGradients;
    if (!grads || !grads.length) return [];
    var out = [];
    for (var i = 0; i < grads.length; i++) {
      var grad = grads[i];
      if (!grad || !grad.stops || !grad.stops.length) continue;
      var stops = normalizeGradientStops(grad.stops);
      if (!stops.length) continue;
      var type = grad.type ? String(grad.type).toLowerCase() : "linear";
      var angle = type === "linear" ? parseLinearGradientAngle(grad.raw) : 0;
      out.push({ type: type, angle: angle, stops: stops });
    }
    return out;
  }

  function getBackgroundGradient(style) {
    var grads = getBackgroundGradients(style);
    return grads.length ? grads[0] : null;
  }

  function pickGradientBaseColor(gradient) {
    if (!gradient || !gradient.stops || !gradient.stops.length) return null;
    for (var i = 0; i < gradient.stops.length; i++) {
      var c = gradient.stops[i].color;
      if (c && !isTransparentColor(c) && parseCssAlpha(c) > 0) return c;
    }
    return gradient.stops[0].color;
  }

  function hasEffectiveBackground(style) {
    return !!getEffectiveBackgroundColor(style) || getBackgroundGradients(style).length > 0;
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
        item._ae2ArtifactIndex = i;
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

  // -----------------------
  // MOTION -> EXPRESSIONS
  // -----------------------

  function buildExprTimeVar() {
    return "var t=time - inPoint;\n";
  }

  function parseMotionNumber(value) {
    if (value === null || typeof value === "undefined") return null;
    if (typeof value === "number") return isFinite(value) ? value : null;
    var s = String(value).trim();
    if (!s) return null;
    var sign = 1;
    if (s.indexOf("-") === 0) {
      sign = -1;
      s = s.slice(1);
    }
    if (s.charAt(0) === "+") s = s.slice(1);
    if (s.indexOf("%") !== -1) {
      s = s.replace("%", "");
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return n * sign;
  }

  function hasPercentValue(value) {
    return typeof value === "string" && value.indexOf("%") !== -1;
  }

  function isPercentMotionEntry(entry, propName) {
    if (!entry || !entry.props || !entry.props[propName]) return false;
    var prop = entry.props[propName];
    var fromVal = prop.from ? prop.from.value : null;
    var toVal = prop.to ? prop.to.value : null;
    return hasPercentValue(fromVal) || hasPercentValue(toVal);
  }

  function ensureSliderControl(layer, name, value) {
    if (!layer || !name) return null;
    var effects = layer.property("Effects");
    if (!effects) return null;
    var effect = effects.property(name);
    if (!effect) {
      effect = effects.addProperty("ADBE Slider Control");
      effect.name = name;
    }
    var prop = effect.property("Slider");
    if (prop && isFinite(value)) prop.setValue(value);
    return prop;
  }

  function attachMotionControls(segments, layer, propLabel, exprTransform) {
    if (!segments || !segments.length || !layer) return;
    var label = propLabel || "Value";
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var baseName = label + " " + (i + 1);
      var fromName = safeName(baseName + " From");
      var toName = safeName(baseName + " To");
      ensureSliderControl(layer, fromName, seg.v0);
      ensureSliderControl(layer, toName, seg.v1);
      var fromExpr = 'effect("' + fromName + '")(1)';
      var toExpr = 'effect("' + toName + '")(1)';
      if (exprTransform) {
        fromExpr = exprTransform(fromExpr);
        toExpr = exprTransform(toExpr);
      }
      seg.v0Expr = fromExpr;
      seg.v1Expr = toExpr;
    }
  }

  function pickMotionProp(motionList, propNames) {
    if (!motionList || !motionList.length) return null;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props) continue;
      for (var j = 0; j < propNames.length; j++) {
        var name = propNames[j];
        if (entry.props[name]) {
          return { prop: name, tween: entry };
        }
      }
    }
    return null;
  }

  function collectMotionSegments(motionList, propName, filterFn) {
    var out = [];
    if (!motionList || !motionList.length || !propName) return out;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props[propName]) continue;
      if (filterFn && !filterFn(entry, propName)) continue;
      out.push({ prop: propName, tween: entry, index: i });
    }
    return out;
  }

  function getMotionStart(entry) {
    if (!entry || !entry.time) return 0;
    var start = isFinite(entry.time.start) ? entry.time.start : 0;
    var delay = isFinite(entry.time.delay) ? entry.time.delay : 0;
    var offset = isFinite(AE2_MOTION_TIME_OFFSET) ? AE2_MOTION_TIME_OFFSET : 0;
    var compOffset = isFinite(AE2_COMP_TIME_OFFSET) ? AE2_COMP_TIME_OFFSET : 0;
    return start + delay - offset - compOffset;
  }

  function getMotionStartOffset(motionList) {
    if (!motionList || !motionList.length) return 0;
    var compOffset = isFinite(AE2_COMP_TIME_OFFSET) ? AE2_COMP_TIME_OFFSET : 0;
    var minStart = null;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.time) {
        minStart = minStart === null ? 0 : Math.min(minStart, 0);
        continue;
      }
      var start = isFinite(entry.time.start) ? entry.time.start : 0;
      var delay = isFinite(entry.time.delay) ? entry.time.delay : 0;
      var t = start + delay - compOffset;
      if (minStart === null || t < minStart) minStart = t;
    }
    if (minStart === null) return 0;
    return minStart > 0 ? minStart : 0;
  }

  function withMotionTimeOffset(offset, fn) {
    var prev = AE2_MOTION_TIME_OFFSET;
    AE2_MOTION_TIME_OFFSET = isFinite(offset) ? offset : 0;
    try {
      return fn();
    } finally {
      AE2_MOTION_TIME_OFFSET = prev;
    }
  }

  function withCompTimeOffset(offset, fn) {
    var prev = AE2_COMP_TIME_OFFSET;
    AE2_COMP_TIME_OFFSET = isFinite(offset) ? offset : 0;
    try {
      return fn();
    } finally {
      AE2_COMP_TIME_OFFSET = prev;
    }
  }

  function getCompTimeOffset() {
    return isFinite(AE2_COMP_TIME_OFFSET) ? AE2_COMP_TIME_OFFSET : 0;
  }

  function applyLayerMotionOffset(layer, offset) {
    if (!layer || !isFinite(offset) || offset <= 0) return;
    try {
      layer.startTime = layer.startTime + offset;
    } catch (e) {}
    try {
      layer.inPoint = layer.startTime;
    } catch (e2) {}
  }

  function buildMotionSegments(motionList, propName, baseValue, scale, convertFn, filterFn) {
    var entries = collectMotionSegments(motionList, propName, filterFn);
    if (!entries.length) return [];
    entries.sort(function (a, b) {
      var ta = getMotionStart(a.tween);
      var tb = getMotionStart(b.tween);
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return a.index - b.index;
    });

    var segments = [];
    var prev = baseValue;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i].tween;
      var props = entry.props[propName];
      var fromMeta = props && props.from ? props.from : null;
      var toMeta = props && props.to ? props.to : null;
      var fromVal = fromMeta ? parseMotionNumber(fromMeta.value) : null;
      var toVal = toMeta ? parseMotionNumber(toMeta.value) : null;
      if (fromVal === null) fromVal = prev;
      if (toVal === null) {
        if (toMeta && toMeta.type === "function") {
          toVal = prev;
        } else {
          toVal = fromVal;
        }
      }
      if (convertFn) {
        fromVal = convertFn(fromVal);
        toVal = convertFn(toVal);
      }
      var t0 = getMotionStart(entry);
      var t1 = t0 + (entry.time && isFinite(entry.time.duration) ? entry.time.duration : 0);
      var seg = {
        t0: t0,
        t1: t1,
        v0: fromVal * scale,
        v1: toVal * scale,
        ease: entry.time && entry.time.ease ? entry.time.ease : null,
      };
      var last = segments.length ? segments[segments.length - 1] : null;
      if (
        !last ||
        last.t0 !== seg.t0 ||
        last.t1 !== seg.t1 ||
        last.v0 !== seg.v0 ||
        last.v1 !== seg.v1 ||
        String(last.ease || "") !== String(seg.ease || "")
      ) {
        segments.push(seg);
      }
      prev = toVal;
    }
    return segments;
  }

  function mergeMotionSegments(a, b) {
    var out = [];
    if (a && a.length) out = out.concat(a);
    if (b && b.length) out = out.concat(b);
    if (!out.length) return out;
    out.sort(function (x, y) {
      if (x.t0 < y.t0) return -1;
      if (x.t0 > y.t0) return 1;
      return 0;
    });
    return out;
  }

  function formatExprValue(value) {
    return typeof value === "string" ? value : String(value);
  }

  function buildSegmentedVarExpr(segments, varName, baseValue) {
    if (!segments || !segments.length) return "var " + varName + "=" + formatExprValue(baseValue) + ";\n";
    var startVal = segments[0].v0Expr || segments[0].v0;
    if (!isFinite(startVal) && typeof startVal !== "string") startVal = baseValue;
    var expr = "var " + varName + "=" + formatExprValue(startVal) + ";\n";
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var easeFn = buildEaseFunctionSource(seg.ease);
      var v0Expr = seg.v0Expr || seg.v0;
      var v1Expr = seg.v1Expr || seg.v1;
      expr +=
        "if (t>=" +
        seg.t0 +
        ") {\n" +
        "  var t0=" +
        seg.t0 +
        "; var t1=" +
        seg.t1 +
        ";\n" +
        "  var v0=" +
        formatExprValue(v0Expr) +
        "; var v1=" +
        formatExprValue(v1Expr) +
        ";\n" +
        "  var easeFn=" +
        easeFn +
        ";\n" +
        "  if (t1<=t0) { " +
        varName +
        "=(t<=t0)?v0:v1; }\n" +
        "  else if (t<=t1) { var p=(t-t0)/(t1-t0); var e=easeFn(p); " +
        varName +
        "=v0+(v1-v0)*e; }\n" +
        "  else { " +
        varName +
        "=v1; }\n" +
        "}\n";
    }
    return expr;
  }

  function buildSegmentedScalarExpression(segments, baseValue) {
    return buildExprTimeVar() + "var base=value;\n" + buildSegmentedVarExpr(segments, "v", "base") + "v;";
  }

  function parseCustomEaseSamples(easeStr) {
    if (!easeStr) return null;
    var raw = String(easeStr).trim();
    var customPrefix = "ae2custom:";
    if (raw.indexOf(customPrefix) !== 0) return null;
    var data = raw.slice(customPrefix.length);
    if (!data) return null;
    var parts = data.split(",");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var n = parseFloat(String(parts[i]).trim());
      if (isFinite(n)) out.push(n);
    }
    return out.length >= 2 ? out : null;
  }

  function parseCubicBezierString(easeStr) {
    if (!easeStr) return null;
    var raw = String(easeStr).trim();
    var m = raw.match(
      /^(?:cubic-bezier|cubicbezier|bezier)\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*$/i
    );
    if (!m) return null;
    var x1 = parseFloat(m[1]);
    var y1 = parseFloat(m[2]);
    var x2 = parseFloat(m[3]);
    var y2 = parseFloat(m[4]);
    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return null;
    return { x1: x1, y1: y1, x2: x2, y2: y2 };
  }

  function clamp01(value) {
    var v = Number(value);
    if (!isFinite(v)) return 0;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function cubicBezierX(t, x1, x2) {
    var u = 1 - t;
    return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
  }

  function cubicBezierY(t, y1, y2) {
    var u = 1 - t;
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
  }

  function cubicBezierXDeriv(t, x1, x2) {
    var u = 1 - t;
    return 3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2);
  }

  function solveBezierTForX(x, x1, x2) {
    var t = x;
    for (var i = 0; i < 6; i++) {
      var dx = cubicBezierX(t, x1, x2) - x;
      var d = cubicBezierXDeriv(t, x1, x2);
      if (Math.abs(dx) < 1e-5) return t;
      if (Math.abs(d) < 1e-6) break;
      t = t - dx / d;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }
    var t0 = 0;
    var t1 = 1;
    t = x;
    for (var j = 0; j < 20; j++) {
      var x2v = cubicBezierX(t, x1, x2);
      if (Math.abs(x2v - x) < 1e-5) return t;
      if (x2v < x) t0 = t;
      else t1 = t;
      t = (t0 + t1) / 2;
    }
    return t;
  }

  function bezierError(samples, x1, y1, x2, y2) {
    var n = samples.length;
    var sum = 0;
    var maxErr = 0;
    for (var i = 0; i < n; i++) {
      var x = n === 1 ? 0 : i / (n - 1);
      var t = solveBezierTForX(x, x1, x2);
      var y = cubicBezierY(t, y1, y2);
      var err = y - samples[i];
      var abs = Math.abs(err);
      if (abs > maxErr) maxErr = abs;
      sum += err * err;
    }
    return { rmse: Math.sqrt(sum / n), maxErr: maxErr };
  }

  function fitCubicBezierFromSamples(samples) {
    if (!samples || samples.length < 2) return null;
    var n = samples.length;
    var slopeStart = (samples[1] - samples[0]) * (n - 1);
    var slopeEnd = (1 - samples[n - 2]) * (n - 1);
    var x1 = 0.33;
    var x2 = 0.67;
    var y1 = clamp01(slopeStart * x1);
    var y2 = clamp01(1 - slopeEnd * (1 - x2));
    var best = { x1: x1, y1: y1, x2: x2, y2: y2 };
    var bestErr = bezierError(samples, x1, y1, x2, y2);

    function tryUpdate(nx1, ny1, nx2, ny2) {
      nx1 = clamp01(nx1);
      ny1 = clamp01(ny1);
      nx2 = clamp01(nx2);
      ny2 = clamp01(ny2);
      var err = bezierError(samples, nx1, ny1, nx2, ny2);
      if (err.rmse < bestErr.rmse) {
        best = { x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
        bestErr = err;
        return true;
      }
      return false;
    }

    var steps = [0.15, 0.08, 0.04, 0.02, 0.01];
    for (var s = 0; s < steps.length; s++) {
      var step = steps[s];
      var improved = true;
      while (improved) {
        improved = false;
        improved = tryUpdate(best.x1 + step, best.y1, best.x2, best.y2) || improved;
        improved = tryUpdate(best.x1 - step, best.y1, best.x2, best.y2) || improved;
        improved = tryUpdate(best.x1, best.y1 + step, best.x2, best.y2) || improved;
        improved = tryUpdate(best.x1, best.y1 - step, best.x2, best.y2) || improved;
        improved = tryUpdate(best.x1, best.y1, best.x2 + step, best.y2) || improved;
        improved = tryUpdate(best.x1, best.y1, best.x2 - step, best.y2) || improved;
        improved = tryUpdate(best.x1, best.y1, best.x2, best.y2 + step) || improved;
        improved = tryUpdate(best.x1, best.y1, best.x2, best.y2 - step) || improved;
      }
    }

    return { params: best, error: bestErr };
  }

  function getBezierSlopes(params) {
    var x1 = params && isFinite(params.x1) ? params.x1 : 0;
    var y1 = params && isFinite(params.y1) ? params.y1 : 0;
    var x2 = params && isFinite(params.x2) ? params.x2 : 1;
    var y2 = params && isFinite(params.y2) ? params.y2 : 1;
    var slopeStart = x1 === 0 ? 0 : y1 / x1;
    var slopeEnd = x2 === 1 ? 0 : (1 - y2) / (1 - x2);
    return { x1: x1, y1: y1, x2: x2, y2: y2, slopeStart: slopeStart, slopeEnd: slopeEnd };
  }

  function getEaseArrayLength(propRef, keyIndex) {
    try {
      var arr = propRef.keyInTemporalEase(keyIndex);
      if (arr && arr.length) return arr.length;
    } catch (e) {}
    if (propRef.dimensionsSeparated === true) return 1;
    var pvt = propRef.propertyValueType;
    if (
      pvt === PropertyValueType.TwoD ||
      pvt === PropertyValueType.TwoD_SPATIAL ||
      pvt === PropertyValueType.ThreeD ||
      pvt === PropertyValueType.ThreeD_SPATIAL
    ) {
      return propRef.value && propRef.value.length ? propRef.value.length : 2;
    }
    return 1;
  }

  function safeKeyframeEase(speed, influence) {
    var infl = Number(influence);
    if (!isFinite(infl)) infl = 0.1;
    if (infl < 0.1) infl = 0.1;
    if (infl > 100) infl = 100;
    var sp = Number(speed);
    if (!isFinite(sp)) sp = 0;
    return new KeyframeEase(sp, infl);
  }

  function buildEaseArraysFromParams(prop, keyIndex, fromVal, toVal, duration, params) {
    if (typeof KeyframeEase !== "function") return null;
    var bez = getBezierSlopes(params);
    var inflOut = Math.max(0.1, Math.min(100, Math.round(bez.x1 * 100)));
    var inflIn = Math.max(0.1, Math.min(100, Math.round((1 - bez.x2) * 100)));
    var dims = getEaseArrayLength(prop, keyIndex);
    var outArr = [];
    var inArr = [];
    for (var i = 0; i < dims; i++) {
      var f = fromVal && fromVal.length !== undefined ? fromVal[i] : fromVal;
      var t = toVal && toVal.length !== undefined ? toVal[i] : toVal;
      var d = t - f;
      var spOut = Math.abs(bez.slopeStart * (d / duration));
      var spIn = Math.abs(bez.slopeEnd * (d / duration));
      outArr.push(safeKeyframeEase(spOut, inflOut));
      inArr.push(safeKeyframeEase(spIn, inflIn));
    }
    return { inArr: inArr, outArr: outArr };
  }

  function buildScalarEasesFromParams(params, delta, duration) {
    if (!params || !isFinite(duration) || duration <= 0) return null;
    var bez = getBezierSlopes(params);
    var inflOut = Math.max(0.1, Math.min(100, Math.round(bez.x1 * 100)));
    var inflIn = Math.max(0.1, Math.min(100, Math.round((1 - bez.x2) * 100)));
    var spOut = Math.abs(bez.slopeStart * (delta / duration));
    var spIn = Math.abs(bez.slopeEnd * (delta / duration));
    return {
      outEase: safeKeyframeEase(spOut, inflOut),
      inEase: safeKeyframeEase(spIn, inflIn),
    };
  }

  function resolveEaseParams(ease) {
    if (!ease) return null;
    var bez = parseCubicBezierString(ease);
    if (bez) return bez;
    var samples = parseCustomEaseSamples(ease);
    if (!samples) return null;
    var fit = fitCubicBezierFromSamples(samples);
    return fit ? fit.params : null;
  }

  function findKeyIndexAtTime(prop, time, tol) {
    if (!prop || !isFinite(time)) return -1;
    var tolerance = isFinite(tol) ? tol : 1e-4;
    var idx = -1;
    try {
      idx = prop.nearestKeyIndex(time);
    } catch (e) {
      return -1;
    }
    if (!idx || idx < 1) return -1;
    try {
      var kt = prop.keyTime(idx);
      if (Math.abs(kt - time) <= tolerance) return idx;
    } catch (e2) {}
    return -1;
  }

  function getPropertyDimension(prop) {
    try {
      var v = prop.value;
      if (v && v.length !== undefined) return v.length;
    } catch (e) {}
    return 1;
  }

  function getKeyTemporalEaseArray(prop, keyIndex, dimCount, isIn) {
    var arr = null;
    try {
      arr = isIn ? prop.keyInTemporalEase(keyIndex) : prop.keyOutTemporalEase(keyIndex);
    } catch (e) {
      arr = null;
    }
    var count = isFinite(dimCount) && dimCount > 0 ? dimCount : 1;
    if (!arr || arr.length < count) {
      var fill = [];
      for (var i = 0; i < count; i++) {
        fill.push(arr && arr[i] ? arr[i] : safeKeyframeEase(0, 0.1));
      }
      arr = fill;
    }
    return arr;
  }

  function mergeEaseArrays(baseArr, overrideArr, dimCount) {
    var count = isFinite(dimCount) && dimCount > 0 ? dimCount : 1;
    var out = [];
    for (var i = 0; i < count; i++) {
      var v = baseArr && baseArr[i] ? baseArr[i] : safeKeyframeEase(0, 0.1);
      if (overrideArr && overrideArr[i]) v = overrideArr[i];
      out.push(v);
    }
    return out;
  }

  function applyTemporalEaseAtKey(prop, keyIndex, inOverride, outOverride, dimCount) {
    if (!prop || !keyIndex || keyIndex < 1) return;
    var dims = isFinite(dimCount) && dimCount > 0 ? dimCount : 1;
    var inBase = getKeyTemporalEaseArray(prop, keyIndex, dims, true);
    var outBase = getKeyTemporalEaseArray(prop, keyIndex, dims, false);
    var inEases = inOverride ? mergeEaseArrays(inBase, inOverride, dims) : inBase;
    var outEases = outOverride ? mergeEaseArrays(outBase, outOverride, dims) : outBase;
    try {
      if (prop.setInterpolationTypeAtKey) {
        prop.setInterpolationTypeAtKey(
          keyIndex,
          KeyframeInterpolationType.BEZIER,
          KeyframeInterpolationType.BEZIER
        );
      }
      prop.setTemporalEaseAtKey(keyIndex, inEases, outEases);
      if (prop.setTemporalContinuousAtKey) prop.setTemporalContinuousAtKey(keyIndex, false);
      if (prop.setTemporalAutoBezierAtKey) prop.setTemporalAutoBezierAtKey(keyIndex, false);
    } catch (e) {}
  }

  function evalCustomEaseAt(samples, p) {
    if (!samples || !samples.length) return p;
    if (p <= 0) return samples[0];
    if (p >= 1) return samples[samples.length - 1];
    var idx = p * (samples.length - 1);
    var i = Math.floor(idx);
    var f = idx - i;
    var v0 = samples[i];
    var v1 = samples[i + 1 >= samples.length ? samples.length - 1 : i + 1];
    return v0 + (v1 - v0) * f;
  }

  function collectSegmentTimes(segmentLists) {
    var map = {};
    var out = [];
    if (!segmentLists || !segmentLists.length) return out;
    for (var i = 0; i < segmentLists.length; i++) {
      var list = segmentLists[i];
      if (!list || !list.length) continue;
      for (var j = 0; j < list.length; j++) {
        var seg = list[j];
        if (!seg) continue;
        if (isFinite(seg.t0) && !map[seg.t0]) {
          map[seg.t0] = true;
          out.push(seg.t0);
        }
        if (isFinite(seg.t1) && !map[seg.t1]) {
          map[seg.t1] = true;
          out.push(seg.t1);
        }
        // Do not bake custom eases into per-frame keys; keep only t0/t1.
      }
    }
    out.sort(function (a, b) {
      return a - b;
    });
    return out;
  }

  function evalSegmentedValueAtTime(segments, t, baseValue) {
    if (!segments || !segments.length) return baseValue;
    var v = isFinite(segments[0].v0) ? segments[0].v0 : baseValue;
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (!seg) continue;
      if (t < seg.t0) break;
      var v0 = isFinite(seg.v0) ? seg.v0 : v;
      var v1 = isFinite(seg.v1) ? seg.v1 : v0;
      if (seg.t1 <= seg.t0) {
        v = t <= seg.t0 ? v0 : v1;
      } else if (t <= seg.t1) {
        var p = (t - seg.t0) / (seg.t1 - seg.t0);
        var samples = parseCustomEaseSamples(seg.ease);
        var y = samples ? evalCustomEaseAt(samples, p) : p;
        v = v0 + (v1 - v0) * y;
      } else {
        v = v1;
      }
    }
    return v;
  }

  function applyScalarSegmentsKeyframes(prop, segments, baseValue, layerOffset) {
    if (!prop || !segments || !segments.length) return;
    var times = collectSegmentTimes([segments]);
    if (!times.length) return;
    var offset = isFinite(layerOffset) ? layerOffset : 0;
    for (var i = 0; i < times.length; i++) {
      var t = times[i];
      var v = evalSegmentedValueAtTime(segments, t, baseValue);
      try {
        prop.setValueAtTime(t + offset, v);
      } catch (e) {}
    }
    applyScalarCustomEase(prop, segments, baseValue, offset);
  }

  function applyVectorSegmentsKeyframes(prop, segmentLists, computeValue, layerOffset) {
    if (!prop || !segmentLists || !segmentLists.length || !computeValue) return;
    var times = collectSegmentTimes(segmentLists);
    if (!times.length) return;
    var offset = isFinite(layerOffset) ? layerOffset : 0;
    for (var i = 0; i < times.length; i++) {
      var t = times[i];
      var value = computeValue(t);
      if (!value) continue;
      try {
        prop.setValueAtTime(t + offset, value);
      } catch (e) {}
    }
    applyVectorCustomEase(prop, segmentLists, offset, computeValue);
  }

  function buildEaseFunctionSource(easeStr) {
    if (!easeStr) return "function(t){return t;}";
    var raw = String(easeStr).trim();
    if (!raw) return "function(t){return t;}";
    var customPrefix = "ae2custom:";
    if (raw.indexOf(customPrefix) === 0) {
      var data = raw.slice(customPrefix.length);
      if (!data) return "function(t){return t;}";
      return (
        "function(t){var a=[" +
        data +
        "]; if (!a.length) return t; if (t<=0) return a[0]; if (t>=1) return a[a.length-1];" +
        " var i=t*(a.length-1); var idx=Math.floor(i); var f=i-idx;" +
        " var v0=a[idx]; var v1=a[idx+1>=a.length?a.length-1:idx+1]; return v0+(v1-v0)*f;}"
      );
    }
    if (raw.indexOf("function") === 0) {
      // If r is used but not defined, inject a default exponent.
      if (
        /Math\.pow\(\s*1\s*-\s*t\s*,\s*r\s*\)/.test(raw) &&
        !/\br\s*=/.test(raw) &&
        !/\bvar\s+r\b/.test(raw)
      ) {
        return raw.replace(/function\s*\(\s*t\s*\)\s*\{/, "function(t){var r=2;");
      }
      return raw;
    }

    var s = raw.toLowerCase();
    if (s === "linear" || s === "none") return "function(t){return t;}";

    var stepsMatch = s.match(/^steps\(([^)]+)\)$/);
    if (stepsMatch) {
      var stepsCount = parseInt(stepsMatch[1], 10);
      if (!isFinite(stepsCount) || stepsCount <= 0) stepsCount = 1;
      return "function(t){return Math.floor(t*" + stepsCount + ")/" + stepsCount + ";}";
    }

    var m = s.match(/^([a-z]+)(\d+)?\.(inout|in|out)(?:\(([^)]+)\))?$/);
    if (!m) return "function(t){return t;}";

    var base = m[1];
    var num = m[2] ? parseFloat(m[2]) : null;
    var mode = m[3];
    var params = m[4]
      ? m[4].split(",").map(function (v) {
          var n = parseFloat(String(v).trim());
          return isFinite(n) ? n : null;
        })
      : [];
    var param = params.length ? params[0] : null;
    var param2 = params.length > 1 ? params[1] : null;

    if (base === "quad") num = 2;
    if (base === "cubic") num = 3;
    if (base === "quart") num = 4;
    if (base === "quint") num = 5;

    if (base === "power") {
      if (!num || !isFinite(num)) num = 2;
      if (mode === "in") {
        return "function(t){return Math.pow(t," + num + ");}";
      }
      if (mode === "out") {
        return "function(t){return 1-Math.pow(1-t," + num + ");}";
      }
      return (
        "function(t){return t<0.5?Math.pow(2*t," +
        num +
        ")/2:1-Math.pow(-2*t+2," +
        num +
        ")/2;}"
      );
    }

    if (base === "sine") {
      if (mode === "in") return "function(t){return 1-Math.cos((t*Math.PI)/2);}";
      if (mode === "out") return "function(t){return Math.sin((t*Math.PI)/2);}";
      return "function(t){return -(Math.cos(Math.PI*t)-1)/2;}";
    }

    if (base === "expo") {
      if (mode === "in") {
        return "function(t){return t===0?0:Math.pow(2,10*t-10);}";
      }
      if (mode === "out") {
        return "function(t){return t===1?1:1-Math.pow(2,-10*t);}";
      }
      return "function(t){if(t===0)return 0; if(t===1)return 1; return t<0.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2;}";
    }

    if (base === "back") {
      var sVal = isFinite(param) ? param : 1.70158;
      if (mode === "in") {
        return (
          "function(t){var s=" +
          sVal +
          ";return t*t*((s+1)*t-s);}"
        );
      }
      if (mode === "out") {
        return (
          "function(t){var s=" +
          sVal +
          ";var u=t-1;return 1+u*u*((s+1)*u+s);}"
        );
      }
      return (
        "function(t){var s=" +
        sVal +
        "*1.525;var u=t*2;return u<1?(u*u*((s+1)*u-s))/2:((u-2)*(u-2)*((s+1)*(u-2)+s)+2)/2;}"
      );
    }

    if (base === "circ") {
      if (mode === "in") return "function(t){return 1-Math.sqrt(1-t*t);}";
      if (mode === "out") return "function(t){return Math.sqrt(1-Math.pow(t-1,2));}";
      return "function(t){return t<0.5?(1-Math.sqrt(1-Math.pow(2*t,2)))/2:(Math.sqrt(1-Math.pow(-2*t+2,2))+1)/2;}";
    }

    if (base === "bounce") {
      var bounceOut =
        "function(x){var n1=7.5625;var d1=2.75;" +
        "if(x<1/d1){return n1*x*x;}" +
        "else if(x<2/d1){x-=1.5/d1;return n1*x*x+0.75;}" +
        "else if(x<2.5/d1){x-=2.25/d1;return n1*x*x+0.9375;}" +
        "else{x-=2.625/d1;return n1*x*x+0.984375;}}";
      if (mode === "out") return "function(t){return (" + bounceOut + ")(t);}";
      if (mode === "in") return "function(t){return 1-(" + bounceOut + ")(1-t);}";
      return "function(t){return t<0.5?(1-(" + bounceOut + ")(1-2*t))/2:(1+(" + bounceOut + ")(2*t-1))/2;}";
    }

    if (base === "elastic") {
      var amp = isFinite(param) ? param : 1;
      var period = isFinite(param2) ? param2 : 0.3;
      var elasticCore =
        "function(x){if(x===0||x===1)return x;" +
        "var a=" +
        amp +
        ";var p=" +
        period +
        ";var s;" +
        "if(a<1){a=1;s=p/4;}else{s=p/(2*Math.PI)*Math.asin(1/a);}" +
        "return a*Math.pow(2,-10*x)*Math.sin((x-s)*(2*Math.PI)/p)+1;}";
      if (mode === "out") return "function(t){return (" + elasticCore + ")(t);}";
      if (mode === "in") return "function(t){return 1-(" + elasticCore + ")(1-t);}";
      return "function(t){return t<0.5?(1-(" + elasticCore + ")(1-2*t))/2:(1+(" + elasticCore + ")(2*t-1))/2;}";
    }

    return "function(t){return t;}";
  }

  function applyScalarCustomEase(prop, segments, baseValue, layerOffset) {
    if (!prop || !segments || !segments.length) return;
    if (typeof KeyframeEase !== "function") return;
    var offset = isFinite(layerOffset) ? layerOffset : 0;
    var tol = 1e-4;
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (!seg || !seg.ease) continue;
      var params = resolveEaseParams(seg.ease);
      if (!params) continue;
      if (!isFinite(seg.t0) || !isFinite(seg.t1) || seg.t1 <= seg.t0) continue;
      var t0 = seg.t0 + offset;
      var t1 = seg.t1 + offset;
      var v0 = isFinite(seg.v0) ? seg.v0 : evalSegmentedValueAtTime(segments, seg.t0, baseValue);
      var v1 = isFinite(seg.v1) ? seg.v1 : evalSegmentedValueAtTime(segments, seg.t1, baseValue);
      var duration = seg.t1 - seg.t0;
      var pack = buildScalarEasesFromParams(params, v1 - v0, duration);
      if (!pack) continue;
      var k0 = findKeyIndexAtTime(prop, t0, tol);
      if (k0 > 0) applyTemporalEaseAtKey(prop, k0, null, [pack.outEase], 1);
      var k1 = findKeyIndexAtTime(prop, t1, tol);
      if (k1 > 0) applyTemporalEaseAtKey(prop, k1, [pack.inEase], null, 1);
    }
  }

  function applyVectorCustomEase(prop, segmentLists, layerOffset, computeValue) {
    if (!prop || !segmentLists || !segmentLists.length) return;
    if (typeof KeyframeEase !== "function") return;
    var offset = isFinite(layerOffset) ? layerOffset : 0;
    var tol = 1e-4;
    var propDims = getPropertyDimension(prop);
    var dimCount = Math.max(segmentLists.length, propDims);
    var inMap = {};
    var outMap = {};
    for (var d = 0; d < segmentLists.length; d++) {
      var list = segmentLists[d];
      if (!list || !list.length) continue;
      for (var i = 0; i < list.length; i++) {
        var seg = list[i];
        if (!seg || !seg.ease) continue;
        var params = resolveEaseParams(seg.ease);
        if (!params) continue;
        if (!isFinite(seg.t0) || !isFinite(seg.t1) || seg.t1 <= seg.t0) continue;
        var duration = seg.t1 - seg.t0;
        var t0 = seg.t0 + offset;
        var t1 = seg.t1 + offset;
        var k0 = String(t0);
        var k1 = String(t1);
        if (!outMap[k0]) outMap[k0] = [];
        if (!inMap[k1]) inMap[k1] = [];

        if (computeValue && propDims >= 1) {
          var v0Arr = computeValue(seg.t0);
          var v1Arr = computeValue(seg.t1);
          var packVec = buildEaseArraysFromParams(prop, 1, v0Arr, v1Arr, duration, params);
          if (packVec) {
            outMap[k0] = packVec.outArr;
            inMap[k1] = packVec.inArr;
          }
        } else {
          var v0 = isFinite(seg.v0) ? seg.v0 : evalSegmentedValueAtTime(list, seg.t0, 0);
          var v1 = isFinite(seg.v1) ? seg.v1 : evalSegmentedValueAtTime(list, seg.t1, v0);
          var pack = buildScalarEasesFromParams(params, v1 - v0, duration);
          if (!pack) continue;
          outMap[k0][d] = pack.outEase;
          inMap[k1][d] = pack.inEase;
        }
      }
    }
    var times = {};
    for (var kIn in inMap) times[kIn] = true;
    for (var kOut in outMap) times[kOut] = true;
    for (var key in times) {
      if (!times[key]) continue;
      var t = parseFloat(key);
      if (!isFinite(t)) continue;
      var idx = findKeyIndexAtTime(prop, t, tol);
      if (idx < 1) continue;
      var inOverride = inMap[key] || null;
      var outOverride = outMap[key] || null;
      if (inOverride || outOverride) {
        var overrideLen = (inOverride && inOverride.length) || (outOverride && outOverride.length) || propDims;
        applyTemporalEaseAtKey(prop, idx, inOverride, outOverride, overrideLen);
      }
    }
  }

  function buildTweenExpression(t0, t1, v0, v1, easeStr, suffix) {
    var easeFn = buildEaseFunctionSource(easeStr);
    var expr =
      buildExprTimeVar() +
      "var t0=" + t0 + ";\n" +
      "var t1=" + t1 + ";\n" +
      "var v0=" + v0 + ";\n" +
      "var v1=" + v1 + ";\n" +
      "var v;\n" +
      "var easeFn=" + easeFn + ";\n" +
      "if (t1<=t0) { v=(t<=t0)?v0:v1; }\n" +
      "else if (t<=t0) v=v0; else if (t>=t1) v=v1; else { var p=(t-t0)/(t1-t0); var e=easeFn(p); v=v0+(v1-v0)*e; }\n" +
      suffix + ";\n";
    return expr;
  }

  function buildTweenValueExpr(t0, t1, v0, v1, easeStr, varName) {
    var easeFn = buildEaseFunctionSource(easeStr);
    return (
      buildExprTimeVar().replace("\n", " ") +
      "var t0=" +
      t0 +
      "; var t1=" +
      t1 +
      "; var v0=" +
      v0 +
      "; var v1=" +
      v1 +
      "; var easeFn=" +
      easeFn +
      "; if (t1<=t0) " +
      varName +
      "=(t<=t0)?v0:v1; else if (t<=t0) " +
      varName +
      "=v0; else if (t>=t1) " +
      varName +
      "=v1; else { var p=(t-t0)/(t1-t0); var e=easeFn(p); " +
      varName +
      "=v0+(v1-v0)*e; }\n"
    );
  }

  function parseFilterBlurValue(value) {
    if (value === null || typeof value === "undefined") return null;
    if (typeof value === "number") return isFinite(value) ? value : null;
    var s = String(value);
    if (!s) return null;
    var blurMatch = s.match(/blur\(([-\d.]+)\s*(px)?\)/i);
    if (blurMatch && blurMatch[1]) {
      var n = parseFloat(blurMatch[1]);
      return isFinite(n) ? n : null;
    }
    var raw = parseFloat(s);
    return isFinite(raw) ? raw : null;
  }

  function buildFilterBlurSegments(motionList, baseValue) {
    var entries = collectMotionSegments(motionList, "filter", null);
    if (!entries.length) return [];
    entries.sort(function (a, b) {
      var ta = getMotionStart(a.tween);
      var tb = getMotionStart(b.tween);
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return a.index - b.index;
    });

    var segments = [];
    var prev = baseValue;
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i].tween;
      var props = entry.props && entry.props.filter ? entry.props.filter : null;
      var fromMeta = props && props.from ? props.from : null;
      var toMeta = props && props.to ? props.to : null;
      var fromVal = fromMeta ? parseFilterBlurValue(fromMeta.value) : null;
      var toVal = toMeta ? parseFilterBlurValue(toMeta.value) : null;
      if (fromVal === null) fromVal = prev;
      if (toVal === null) {
        if (toMeta && toMeta.type === "function") {
          toVal = prev;
        } else {
          toVal = fromVal;
        }
      }
      if (!isFinite(fromVal)) fromVal = 0;
      if (!isFinite(toVal)) toVal = fromVal;

      var t0 = getMotionStart(entry);
      var t1 = t0 + (entry.time && isFinite(entry.time.duration) ? entry.time.duration : 0);
      var seg = {
        t0: t0,
        t1: t1,
        v0: fromVal,
        v1: toVal,
        ease: entry.time && entry.time.ease ? entry.time.ease : null,
      };
      var last = segments.length ? segments[segments.length - 1] : null;
      if (
        !last ||
        last.t0 !== seg.t0 ||
        last.t1 !== seg.t1 ||
        last.v0 !== seg.v0 ||
        last.v1 !== seg.v1 ||
        String(last.ease || "") !== String(seg.ease || "")
      ) {
        segments.push(seg);
      }
      prev = toVal;
    }
    return segments;
  }

  function ensureGaussianBlurEffect(layer) {
    if (!layer) return null;
    var effects = layer.property("Effects");
    if (!effects) return null;
    var existing = effects.property("Gaussian Blur") || effects.property("ADBE Gaussian Blur") || effects.property("ADBE Gaussian Blur 2");
    if (existing) return existing;
    var effect = effects.addProperty("ADBE Gaussian Blur 2");
    if (!effect) effect = effects.addProperty("ADBE Gaussian Blur");
    if (effect) effect.name = "Gaussian Blur";
    return effect;
  }

  function mapSplitBasedOn(type) {
    if (type === "words") return 3;
    if (type === "lines") return 4;
    return 1; // chars
  }

  function hasSplitAnimatorProps(props) {
    if (!props) return false;
    return (
      props.opacity ||
      props.x ||
      props.y ||
      props.xPercent ||
      props.yPercent ||
      props.scale ||
      props.scaleX ||
      props.scaleY ||
      props.rotation ||
      props.rotate ||
      props.rotateZ ||
      props.rotateX ||
      props.rotateY ||
      props.skewY
    );
  }

  function getTextSplitTypeFromMotion(motionList) {
    if (!motionList || !motionList.length) return null;
    var splitType = null;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.splitText) continue;
      splitType = String(entry.splitText).toLowerCase();
      break;
    }
    if (!splitType) {
      for (var j = 0; j < motionList.length; j++) {
        var entry2 = motionList[j];
        if (!entry2 || !entry2.props) continue;
        if (hasSplitAnimatorProps(entry2.props)) {
          splitType = "lines";
          break;
        }
      }
    }
    if (!splitType) return null;
    if (splitType !== "lines" && splitType !== "words" && splitType !== "chars") {
      splitType = "chars";
    }
    return splitType;
  }

  function findSplitTween(motionList, useImplicitSplit) {
    if (!motionList || !motionList.length) return null;
    var best = null;
    var bestTime = null;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry) continue;
      if (!useImplicitSplit && !entry.splitText) continue;
      if (useImplicitSplit && !hasSplitAnimatorProps(entry.props)) continue;
      var start = getMotionStart(entry);
      if (bestTime === null || start < bestTime) {
        best = entry;
        bestTime = start;
      }
    }
    return best;
  }

  function getSplitStartValue(props, key, fallback) {
    if (!props || !props[key]) return fallback;
    var entry = props[key];
    var fromVal = entry && entry.from ? parseMotionNumber(entry.from.value) : null;
    if (fromVal !== null) return fromVal;
    var toVal = entry && entry.to ? parseMotionNumber(entry.to.value) : null;
    if (toVal !== null) return toVal;
    return fallback;
  }

  function ensureSplitTextAnimator(layer, motionList, bbox) {
    if (!layer || !motionList || !motionList.length) return;
    var textGroup = null;
    try {
      textGroup = layer.property("Text");
    } catch (e) {
      textGroup = null;
    }
    if (!textGroup) return;

    var splitType = null;
    var hasOpacity = false;
    var hasPosition = false;
    var hasScale = false;
    var hasRotation = false;
    var hasRotation3d = false;
    var hasSkewY = false;
    var firstSplitProps = null;
    var explicitSplit = false;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry) continue;
      if (entry.splitText && !explicitSplit) {
        splitType = String(entry.splitText).toLowerCase();
        explicitSplit = true;
      }
    }
    if (!explicitSplit) splitType = "lines";
    var useImplicitSplit = !explicitSplit;

    for (var j = 0; j < motionList.length; j++) {
      var entry2 = motionList[j];
      if (!entry2) continue;
      if (!useImplicitSplit && !entry2.splitText) continue;
      var props = entry2.props || null;
      if (!props || !hasSplitAnimatorProps(props)) continue;
      if (!firstSplitProps) firstSplitProps = props;
      if (props.opacity) hasOpacity = true;
      if (props.x || props.y || props.xPercent || props.yPercent) hasPosition = true;
      if (props.scale || props.scaleX || props.scaleY) hasScale = true;
      if (props.rotation || props.rotate || props.rotateZ) hasRotation = true;
      if (props.rotateX || props.rotateY) hasRotation3d = true;
      if (props.skewY) hasSkewY = true;
    }
    if (!firstSplitProps) return;
    if (splitType !== "lines" && splitType !== "words" && splitType !== "chars") {
      splitType = "chars";
    }

    if (hasRotation3d) {
      try {
        var moreOptions = textGroup.property("More Options");
        if (moreOptions) {
          var perChar3d = moreOptions.property("ADBE Text Enable Per-char 3D");
          if (!perChar3d) {
            perChar3d = moreOptions.property("ADBE Text Enable Per-character 3D");
          }
          if (perChar3d) perChar3d.setValue(1);
        }
      } catch (e) {}
    }

    var animators = textGroup.property("Animators");
    var animator = animators.addProperty("ADBE Text Animator");
    animator.name = "Split " + splitType;
    var animatorProps = animator.property("ADBE Text Animator Properties");
    if (animatorProps) {
      var axisW = bbox && isFinite(bbox.w) ? bbox.w : 0;
      var axisH = bbox && isFinite(bbox.h) ? bbox.h : 0;

      if (hasOpacity) {
        var opacityProp = animatorProps.addProperty("ADBE Text Opacity");
        if (opacityProp && firstSplitProps) {
          var opacityStart = getSplitStartValue(firstSplitProps, "opacity", 1);
          if (opacityStart !== null) opacityProp.setValue(opacityStart * 100);
        }
      }
      if (hasPosition) {
        var positionProp = animatorProps.addProperty("ADBE Text Position 3D");
        if (positionProp && firstSplitProps) {
          var xStart = getSplitStartValue(firstSplitProps, "x", 0);
          var yStart = getSplitStartValue(firstSplitProps, "y", 0);
          var xPct = getSplitStartValue(firstSplitProps, "xPercent", 0);
          var yPct = getSplitStartValue(firstSplitProps, "yPercent", 0);
          var px = (xStart || 0) + (xPct ? (xPct / 100) * axisW : 0);
          var py = (yStart || 0) + (yPct ? (yPct / 100) * axisH : 0);
          positionProp.setValue([px, py, 0]);
        }
      }
      if (hasScale) {
        var scaleProp = animatorProps.addProperty("ADBE Text Scale 3D");
        if (scaleProp && firstSplitProps) {
          var scaleStart = getSplitStartValue(firstSplitProps, "scale", null);
          var scaleXStart = getSplitStartValue(firstSplitProps, "scaleX", null);
          var scaleYStart = getSplitStartValue(firstSplitProps, "scaleY", null);
          var sx = scaleXStart !== null ? scaleXStart : scaleStart;
          var sy = scaleYStart !== null ? scaleYStart : scaleStart;
          if (sx === null) sx = 1;
          if (sy === null) sy = 1;
          scaleProp.setValue([sx * 100, sy * 100]);
        }
      }
      if (hasRotation) {
        var rotationProp = animatorProps.addProperty("ADBE Text Rotation");
        if (rotationProp && firstSplitProps) {
          var rotStart = getSplitStartValue(firstSplitProps, "rotation", null);
          if (rotStart === null) rotStart = getSplitStartValue(firstSplitProps, "rotate", null);
          if (rotStart === null) rotStart = getSplitStartValue(firstSplitProps, "rotateZ", 0);
          if (rotStart !== null) rotationProp.setValue(rotStart);
        }
      }
      if (hasSkewY) {
        var skewAxisProp = animatorProps.addProperty("ADBE Text Skew Axis");
        if (skewAxisProp) skewAxisProp.setValue(90);
        var skewProp = animatorProps.addProperty("ADBE Text Skew");
        if (skewProp && firstSplitProps) {
          var skewStart = getSplitStartValue(firstSplitProps, "skewY", null);
          if (skewStart !== null) skewProp.setValue(skewStart);
        }
      }
      if (hasRotation3d) {
        var rotationXProp = animatorProps.addProperty("ADBE Text Rotation X");
        if (rotationXProp && firstSplitProps) {
          var rotXStart = getSplitStartValue(firstSplitProps, "rotateX", null);
          if (rotXStart !== null) rotationXProp.setValue(rotXStart);
        }
        var rotationYProp = animatorProps.addProperty("ADBE Text Rotation Y");
        if (rotationYProp && firstSplitProps) {
          var rotYStart = getSplitStartValue(firstSplitProps, "rotateY", null);
          if (rotYStart !== null) rotationYProp.setValue(rotYStart);
        }
      }
    }
    var selector = animator.property("Selectors").addProperty("ADBE Text Selector");
    var advanced = selector.property("ADBE Text Range Advanced");
    var basedOnValue = mapSplitBasedOn(splitType);
    if (advanced && advanced.property("ADBE Text Range Type2")) {
      advanced.property("ADBE Text Range Type2").setValue(basedOnValue);
    }

    var offsetProp = selector.property("ADBE Text Percent Offset");
    var splitTween = findSplitTween(motionList, useImplicitSplit);
    if (offsetProp && splitTween) {
      var t0 = getMotionStart(splitTween);
      var dur = splitTween.time && isFinite(splitTween.time.duration) ? splitTween.time.duration : 0;
      var stagger = splitTween.time && isFinite(splitTween.time.stagger) ? splitTween.time.stagger : 0;
      var t1 = t0 + dur + stagger;
      var ease = splitTween.time && splitTween.time.ease ? splitTween.time.ease : null;
      if (useExpressionAnimation() && offsetProp.canSetExpression) {
        offsetProp.expression = buildTweenExpression(t0, t1, 0, 100, ease, "v");
      } else if (isAnimationEnabled()) {
        var layerOffset = layer && isFinite(layer.inPoint) ? layer.inPoint : 0;
        try {
          offsetProp.setValueAtTime(t0 + layerOffset, 0);
          offsetProp.setValueAtTime(t1 + layerOffset, 100);
        } catch (e2) {}
        var params = resolveEaseParams(ease);
        if (params && isFinite(t0) && isFinite(t1) && t1 > t0) {
          var duration = t1 - t0;
          var pack = buildScalarEasesFromParams(params, 100, duration);
          if (pack) {
            var k0 = findKeyIndexAtTime(offsetProp, t0 + layerOffset, 1e-4);
            if (k0 > 0) applyTemporalEaseAtKey(offsetProp, k0, null, [pack.outEase], 1);
            var k1 = findKeyIndexAtTime(offsetProp, t1 + layerOffset, 1e-4);
            if (k1 > 0) applyTemporalEaseAtKey(offsetProp, k1, [pack.inEase], null, 1);
          }
        }
      }
    }

  }

  function applyMotion(layer, node, bbox, motionStartOffset) {
    if (!layer || !node || !node.motion || !node.motion.length) return 0;
    if (!isAnimationEnabled()) return 0;
    var motionList = node.motion;
    var startOffset = isFinite(motionStartOffset) ? motionStartOffset : getMotionStartOffset(motionList);
    if (startOffset > 0) applyLayerMotionOffset(layer, startOffset);
    var useExpr = useExpressionAnimation();
    var layerOffset = layer && isFinite(layer.inPoint) ? layer.inPoint : 0;

    withMotionTimeOffset(startOffset, function () {
      applyMotionTransformOrigin(layer, motionList, bbox);
      ensureSplitTextAnimator(layer, motionList, bbox);

      // Filter blur -> Gaussian Blur (add effect before any controls)
      var blurSegments = buildFilterBlurSegments(motionList, 0);
      var blurEffectIndex = null;
      if (blurSegments.length) {
        var blurEffect = ensureGaussianBlurEffect(layer);
        if (blurEffect) {
          blurEffectIndex = blurEffect.propertyIndex;
          var repeatProp =
            blurEffect.property("Repeat Edge Pixels") ||
            blurEffect.property("ADBE Gaussian Blur-0003") ||
            blurEffect.property("Repeat Edge Pixels");
          if (repeatProp) {
            try {
              repeatProp.setValue(1);
            } catch (e) {}
          }
        }
      }

      // Opacity (0..1 -> 0..100)
      var opacityProp = layer.property("Transform").property("Opacity");
      var baseOpacity = opacityProp.value;
      var opacitySegments = buildMotionSegments(motionList, "opacity", baseOpacity / 100, 100, null);
      if (opacitySegments.length) {
        if (useExpr && opacityProp.canSetExpression) {
          if (useExpr) attachMotionControls(opacitySegments, layer, "Opacity", null);
          opacityProp.expression = buildSegmentedScalarExpression(opacitySegments, baseOpacity);
        } else {
          applyScalarSegmentsKeyframes(opacityProp, opacitySegments, baseOpacity, layerOffset);
        }
      }

      // Position (x/y/z offsets)
      var zSegments = buildMotionSegments(motionList, "z", 0, 1, null);
      var rotXSegments = buildMotionSegments(motionList, "rotateX", 0, 1, null);
      var rotYSegments = buildMotionSegments(motionList, "rotateY", 0, 1, null);
      if ((zSegments && zSegments.length) || (rotXSegments && rotXSegments.length) || (rotYSegments && rotYSegments.length)) {
        try {
          layer.threeDLayer = true;
        } catch (e) {}
      }

      var basePos = layer.property("Transform").property("Position").value;
      var basePosZ = basePos && basePos.length > 2 ? basePos[2] : 0;
      var axisW = bbox && isFinite(bbox.w) ? bbox.w : 0;
      var axisH = bbox && isFinite(bbox.h) ? bbox.h : 0;
      var xSegments = buildMotionSegments(motionList, "x", 0, 1, null, function (entry) {
        return !isPercentMotionEntry(entry, "x");
      });
      var ySegments = buildMotionSegments(motionList, "y", 0, 1, null, function (entry) {
        return !isPercentMotionEntry(entry, "y");
      });
      var xPercentSegments = buildMotionSegments(motionList, "xPercent", 0, 1, null);
      var yPercentSegments = buildMotionSegments(motionList, "yPercent", 0, 1, null);
      var xPercentFromX = buildMotionSegments(motionList, "x", 0, 1, null, function (entry) {
        return isPercentMotionEntry(entry, "x");
      });
      var yPercentFromY = buildMotionSegments(motionList, "y", 0, 1, null, function (entry) {
        return isPercentMotionEntry(entry, "y");
      });
      xPercentSegments = mergeMotionSegments(xPercentSegments, xPercentFromX);
      yPercentSegments = mergeMotionSegments(yPercentSegments, yPercentFromY);
      if (xSegments.length || ySegments.length || xPercentSegments.length || yPercentSegments.length || zSegments.length) {
        var posProp = layer.property("Transform").property("Position");
        if (useExpr && posProp.canSetExpression) {
          if (useExpr) {
            attachMotionControls(xSegments, layer, "Position X", null);
            attachMotionControls(ySegments, layer, "Position Y", null);
            attachMotionControls(xPercentSegments, layer, "Position X Percent", function (expr) {
              return "(" + expr + "/100)*" + axisW;
            });
            attachMotionControls(yPercentSegments, layer, "Position Y Percent", function (expr) {
              return "(" + expr + "/100)*" + axisH;
            });
          }
          var expr =
            "var base=value;\n" +
            buildExprTimeVar() +
            buildSegmentedVarExpr(xSegments, "tx", 0) +
            buildSegmentedVarExpr(ySegments, "ty", 0) +
            buildSegmentedVarExpr(xPercentSegments, "txp", 0) +
            buildSegmentedVarExpr(yPercentSegments, "typ", 0) +
            (zSegments.length ? buildSegmentedVarExpr(zSegments, "tz", 0) : "var tz=0;\n") +
            (layer.threeDLayer
              ? "[base[0]+tx+txp, base[1]+ty+typ, (base.length>2?base[2]:0)+tz];"
              : "[base[0]+tx+txp, base[1]+ty+typ];");
          posProp.expression = expr;
        } else if (posProp) {
          applyVectorSegmentsKeyframes(
            posProp,
            [xSegments, ySegments, xPercentSegments, yPercentSegments, zSegments],
            function (t) {
              var x =
                basePos[0] +
                evalSegmentedValueAtTime(xSegments, t, 0) +
                (axisW ? (evalSegmentedValueAtTime(xPercentSegments, t, 0) / 100) * axisW : 0);
              var y =
                basePos[1] +
                evalSegmentedValueAtTime(ySegments, t, 0) +
                (axisH ? (evalSegmentedValueAtTime(yPercentSegments, t, 0) / 100) * axisH : 0);
              var z = basePosZ + evalSegmentedValueAtTime(zSegments, t, 0);
              return layer.threeDLayer ? [x, y, z] : [x, y];
            },
            layerOffset
          );
        }
      }

      // Scale
      var scaleProp = layer.property("Transform").property("Scale");
      var baseScale = scaleProp.value;
      var scaleSegments = buildMotionSegments(motionList, "scale", baseScale[0] / 100, 100, null);
      var sxSegments = buildMotionSegments(motionList, "scaleX", baseScale[0] / 100, 100, null);
      var sySegments = buildMotionSegments(motionList, "scaleY", baseScale[1] / 100, 100, null);
      var widthSegments = [];
      var heightSegments = [];
      if (axisW > 0) {
        var widthAbsSegments = buildMotionSegments(
          motionList,
          "width",
          axisW * (baseScale[0] / 100),
          1,
          function (v) {
            return (v / axisW) * 100;
          },
          function (entry) {
            return !isPercentMotionEntry(entry, "width");
          }
        );
        var widthPercentSegments = buildMotionSegments(
          motionList,
          "width",
          baseScale[0],
          1,
          function (v) {
            return v;
          },
          function (entry) {
            return isPercentMotionEntry(entry, "width");
          }
        );
        widthSegments = mergeMotionSegments(widthAbsSegments, widthPercentSegments);
      }
      if (axisH > 0) {
        var heightAbsSegments = buildMotionSegments(
          motionList,
          "height",
          axisH * (baseScale[1] / 100),
          1,
          function (v) {
            return (v / axisH) * 100;
          },
          function (entry) {
            return !isPercentMotionEntry(entry, "height");
          }
        );
        var heightPercentSegments = buildMotionSegments(
          motionList,
          "height",
          baseScale[1],
          1,
          function (v) {
            return v;
          },
          function (entry) {
            return isPercentMotionEntry(entry, "height");
          }
        );
        heightSegments = mergeMotionSegments(heightAbsSegments, heightPercentSegments);
      }
      if (
        scaleSegments.length ||
        sxSegments.length ||
        sySegments.length ||
        widthSegments.length ||
        heightSegments.length
      ) {
        if (useExpr && scaleProp.canSetExpression) {
          if (useExpr) {
            attachMotionControls(scaleSegments, layer, "Scale", null);
            attachMotionControls(sxSegments, layer, "Scale X", null);
            attachMotionControls(sySegments, layer, "Scale Y", null);
            attachMotionControls(widthSegments, layer, "Width", null);
            attachMotionControls(heightSegments, layer, "Height", null);
          }
          var expr =
            "var base=value;\n" +
            buildExprTimeVar() +
            "var sx=base[0]; var sy=base[1];\n" +
            "var s=" +
            baseScale[0] +
            ";\n" +
            (scaleSegments.length ? buildSegmentedVarExpr(scaleSegments, "s", baseScale[0]) + "sx=s; sy=s;\n" : "") +
            (sxSegments.length ? buildSegmentedVarExpr(sxSegments, "sx", baseScale[0]) : "") +
            (sySegments.length ? buildSegmentedVarExpr(sySegments, "sy", baseScale[1]) : "") +
            (widthSegments.length ? buildSegmentedVarExpr(widthSegments, "sx", baseScale[0]) : "") +
            (heightSegments.length ? buildSegmentedVarExpr(heightSegments, "sy", baseScale[1]) : "") +
            "[sx, sy];";
          scaleProp.expression = expr;
        } else if (scaleProp) {
          applyVectorSegmentsKeyframes(
            scaleProp,
            [scaleSegments, sxSegments, sySegments, widthSegments, heightSegments],
            function (t) {
              var sx = baseScale[0];
              var sy = baseScale[1];
              if (scaleSegments.length) {
                var s = evalSegmentedValueAtTime(scaleSegments, t, baseScale[0]);
                sx = s;
                sy = s;
              }
              if (sxSegments.length) sx = evalSegmentedValueAtTime(sxSegments, t, baseScale[0]);
              if (sySegments.length) sy = evalSegmentedValueAtTime(sySegments, t, baseScale[1]);
              if (widthSegments.length) sx = evalSegmentedValueAtTime(widthSegments, t, baseScale[0]);
              if (heightSegments.length) sy = evalSegmentedValueAtTime(heightSegments, t, baseScale[1]);
              return [sx, sy];
            },
            layerOffset
          );
        }
      }

      // Rotation (Z)
      var rotSegments = buildMotionSegments(motionList, "rotation", 0, 1, null);
      var rotateSegments = buildMotionSegments(motionList, "rotate", 0, 1, null);
      var rotateZSegments = buildMotionSegments(motionList, "rotateZ", 0, 1, null);
      var rotationProp = layer.threeDLayer
        ? layer.property("Transform").property("Z Rotation")
        : layer.property("Transform").property("Rotation");
      var baseRot = rotationProp ? rotationProp.value : 0;
      var useRotSegments = rotSegments.length ? rotSegments : rotateSegments;
      if (!useRotSegments.length && rotateZSegments.length) useRotSegments = rotateZSegments;
      if (useRotSegments.length) {
        if (!rotSegments.length && rotateSegments.length) {
          // If only "rotate" segments are provided, treat them as rotation.
          useRotSegments = rotateSegments;
        }
        if (!rotSegments.length && !rotateSegments.length && rotateZSegments.length) {
          // If only "rotateZ" segments are provided, treat them as rotation.
          useRotSegments = rotateZSegments;
        }
        // Rebuild with base values for rotation if missing in segments.
        var motionKey = rotSegments.length ? "rotation" : rotateSegments.length ? "rotate" : "rotateZ";
        useRotSegments = buildMotionSegments(motionList, motionKey, baseRot, 1, null);
        if (rotationProp && useExpr && rotationProp.canSetExpression) {
          if (useExpr) attachMotionControls(useRotSegments, layer, "Rotation", null);
          rotationProp.expression = buildSegmentedScalarExpression(useRotSegments, baseRot);
        } else if (rotationProp) {
          applyScalarSegmentsKeyframes(rotationProp, useRotSegments, baseRot, layerOffset);
        }
      }

      // Rotation (X/Y)
      if ((rotXSegments && rotXSegments.length) || (rotYSegments && rotYSegments.length)) {
        var rotXProp = layer.property("Transform").property("X Rotation");
        var rotYProp = layer.property("Transform").property("Y Rotation");
        if (rotXProp && rotXSegments.length) {
          var baseRotX = rotXProp.value;
          if (useExpr && rotXProp.canSetExpression) {
            if (useExpr) attachMotionControls(rotXSegments, layer, "Rotation X", null);
            rotXProp.expression = buildSegmentedScalarExpression(rotXSegments, baseRotX);
          } else {
            applyScalarSegmentsKeyframes(rotXProp, rotXSegments, baseRotX, layerOffset);
          }
        }
        if (rotYProp && rotYSegments.length) {
          var baseRotY = rotYProp.value;
          if (useExpr && rotYProp.canSetExpression) {
            if (useExpr) attachMotionControls(rotYSegments, layer, "Rotation Y", null);
            rotYProp.expression = buildSegmentedScalarExpression(rotYSegments, baseRotY);
          } else {
            applyScalarSegmentsKeyframes(rotYProp, rotYSegments, baseRotY, layerOffset);
          }
        }
      }

      // Filter blur -> Gaussian Blur (attach controls after all effects)
      if (blurSegments.length && blurEffectIndex !== null) {
        if (useExpr) attachMotionControls(blurSegments, layer, "Blur", null);
        var effects = layer.property("Effects");
        var blurEffectFinal = effects ? effects.property(blurEffectIndex) : null;
        if (blurEffectFinal) {
          var blurProp =
            blurEffectFinal.property("Blurriness") ||
            blurEffectFinal.property("Blur") ||
            blurEffectFinal.property("ADBE Gaussian Blur-0001");
          if (blurProp) {
            try {
              var baseBlur = 0;
              try {
                baseBlur = blurProp.value;
              } catch (e) {
                baseBlur = 0;
              }
              var canExpr = false;
              try {
                canExpr = blurProp.canSetExpression;
              } catch (e) {
                canExpr = false;
              }
              if (useExpr && canExpr) {
                try {
                  blurProp.expression = buildSegmentedScalarExpression(blurSegments, baseBlur);
                } catch (e) {}
              } else {
                for (var b = 0; b < blurSegments.length; b++) {
                  try {
                    blurProp.setValueAtTime(blurSegments[b].t0 + layerOffset, blurSegments[b].v0);
                    blurProp.setValueAtTime(blurSegments[b].t1 + layerOffset, blurSegments[b].v1);
                  } catch (e) {}
                }
              }
            } catch (e) {}
          }
        }
      }
    });

    return startOffset;
  }

  function collectClipPathSegments(motionList) {
    var out = [];
    if (!motionList || !motionList.length) return out;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props.clipPath) continue;
      out.push(entry);
    }
    return out;
  }

  function parseInsetValues(value, bbox) {
    if (!value || !bbox) return null;
    var s = String(value).trim();
    if (s.indexOf("inset(") !== 0) return null;
    s = s.substring(6);
    if (s.charAt(s.length - 1) === ")") s = s.substring(0, s.length - 1);
    var roundIdx = s.indexOf("round");
    var roundText = null;
    if (roundIdx !== -1) {
      roundText = s.substring(roundIdx + 5);
      var roundSlash = roundText.indexOf("/");
      if (roundSlash !== -1) roundText = roundText.substring(0, roundSlash);
      s = s.substring(0, roundIdx);
    }
    var slashIdx = s.indexOf("/");
    if (slashIdx !== -1) s = s.substring(0, slashIdx);
    var raw = s.replace(/,/g, " ").split(/\s+/);
    var parts = [];
    for (var i = 0; i < raw.length; i++) {
      if (raw[i]) parts.push(raw[i]);
    }
    if (!parts.length) return null;

    function parsePart(token, axis) {
      var t = String(token);
      if (t.indexOf("%") !== -1) {
        var pct = parseFloat(t);
        if (!isFinite(pct)) return 0;
        return axis * (pct / 100);
      }
      var n = parseFloat(t);
      return isFinite(n) ? n : 0;
    }

    var top, right, bottom, left;
    if (parts.length === 1) {
      top = right = bottom = left = parts[0];
    } else if (parts.length === 2) {
      top = bottom = parts[0];
      right = left = parts[1];
    } else if (parts.length === 3) {
      top = parts[0];
      right = left = parts[1];
      bottom = parts[2];
    } else {
      top = parts[0];
      right = parts[1];
      bottom = parts[2];
      left = parts[3];
    }

    var rx = 0;
    var ry = 0;
    if (roundText) {
      var rRaw = roundText.replace(/,/g, " ").split(/\s+/);
      var rParts = [];
      for (var r = 0; r < rRaw.length; r++) {
        if (rRaw[r]) rParts.push(rRaw[r]);
      }
      if (rParts.length === 1) {
        rx = parsePart(rParts[0], bbox.w);
        ry = parsePart(rParts[0], bbox.h);
      } else if (rParts.length >= 2) {
        rx = parsePart(rParts[0], bbox.w);
        ry = parsePart(rParts[1], bbox.h);
      }
    }

    return {
      top: parsePart(top, bbox.h),
      right: parsePart(right, bbox.w),
      bottom: parsePart(bottom, bbox.h),
      left: parsePart(left, bbox.w),
      rx: rx,
      ry: ry,
    };
  }

  function clampRoundnessValue(value, max) {
    var v = Number(value);
    if (!isFinite(v) || v <= 0) return 0;
    if (!isFinite(max) || max <= 0) return v;
    return Math.min(v, max);
  }

  function buildInsetShape(inset, bbox) {
    if (!inset || !bbox) return null;
    var l = inset.left || 0;
    var t = inset.top || 0;
    var r = inset.right || 0;
    var b = inset.bottom || 0;
    var w = Math.max(0, bbox.w - l - r);
    var h = Math.max(0, bbox.h - t - b);
    var x0 = l;
    var y0 = t;
    var x1 = l + w;
    var y1 = t + h;
    if (w <= 0 || h <= 0) return null;

    var rx = clampRoundnessValue(inset.rx || 0, w / 2);
    var ry = clampRoundnessValue(inset.ry || 0, h / 2);
    var hasRound = rx > 0 && ry > 0;
    var k = 0.5522847498307936;
    var rxk = hasRound ? rx * k : 0;
    var ryk = hasRound ? ry * k : 0;

    var s = new Shape();
    s.vertices = [
      [x0 + rx, y0],
      [x1 - rx, y0],
      [x1, y0 + ry],
      [x1, y1 - ry],
      [x1 - rx, y1],
      [x0 + rx, y1],
      [x0, y1 - ry],
      [x0, y0 + ry],
    ];
    s.inTangents = [
      [-rxk, 0],
      [0, 0],
      [-rxk, 0],
      [0, 0],
      [rxk, 0],
      [0, 0],
      [0, ryk],
      [0, 0],
    ];
    s.outTangents = [
      [0, 0],
      [0, ryk],
      [0, 0],
      [0, ryk],
      [0, 0],
      [-rxk, 0],
      [0, 0],
      [0, -ryk],
    ];
    s.closed = true;
    return s;
  }

  function parsePolygonPoints(value, bbox) {
    if (!value || !bbox) return null;
    var s = String(value).trim();
    if (s.indexOf("polygon(") !== 0) return null;
    s = s.substring(8);
    if (s.charAt(s.length - 1) === ")") s = s.substring(0, s.length - 1);
    var items = s.split(",");
    if (items.length === 1) {
      var flat = String(items[0]).trim().split(/\s+/);
      items = [];
      for (var f = 0; f + 1 < flat.length; f += 2) {
        items.push(flat[f] + " " + flat[f + 1]);
      }
    }
    var points = [];
    for (var i = 0; i < items.length; i++) {
      var part = String(items[i]).trim();
      if (!part) continue;
      var nums = part.split(/\s+/);
      if (nums.length < 2) continue;
      var xVal = nums[0];
      var yVal = nums[1];
      var x = xVal.indexOf("%") !== -1 ? (parseFloat(xVal) / 100) * bbox.w : parseFloat(xVal);
      var y = yVal.indexOf("%") !== -1 ? (parseFloat(yVal) / 100) * bbox.h : parseFloat(yVal);
      if (!isFinite(x) || !isFinite(y)) continue;
      points.push([x, y]);
    }
    return points.length ? points : null;
  }

  function normalizePolygonPoints(a, b) {
    var aLen = a ? a.length : 0;
    var bLen = b ? b.length : 0;
    var max = Math.max(aLen, bLen);
    if (max < 1) return { a: a, b: b, count: 0 };
    function pad(list, len) {
      var out = list ? list.slice(0) : [];
      var last = out.length ? out[out.length - 1] : [0, 0];
      while (out.length < len) out.push([last[0], last[1]]);
      if (out.length > len) out = out.slice(0, len);
      return out;
    }
    return { a: pad(a, max), b: pad(b, max), count: max };
  }

  function buildPolygonShape(points) {
    if (!points || !points.length) return null;
    var s = new Shape();
    var verts = [];
    var ins = [];
    var outs = [];
    for (var i = 0; i < points.length; i++) {
      verts.push([points[i][0], points[i][1]]);
      ins.push([0, 0]);
      outs.push([0, 0]);
    }
    s.vertices = verts;
    s.inTangents = ins;
    s.outTangents = outs;
    s.closed = true;
    return s;
  }

  function findFirstShapePathProp(layer) {
    if (!layer) return null;
    var contents = layer.property("Contents");
    if (!contents) return null;
    var count = contents.numProperties || 0;
    for (var i = 1; i <= count; i++) {
      var group = contents.property(i);
      if (!group || group.matchName !== "ADBE Vector Group") continue;
      var grpContents = group.property("Contents");
      if (!grpContents) continue;
      var cCount = grpContents.numProperties || 0;
      for (var j = 1; j <= cCount; j++) {
        var item = grpContents.property(j);
        if (!item || item.matchName !== "ADBE Vector Shape - Group") continue;
        var pathProp = item.property("Path");
        if (pathProp) return pathProp;
      }
    }
    return null;
  }

  function buildClipPathInsetSegments(motionList, bbox) {
    var out = { top: [], right: [], bottom: [], left: [], rx: [], ry: [] };
    if (!motionList || !motionList.length || !bbox) return out;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props.clipPath) continue;
      var clip = entry.props.clipPath || {};
      var fromVal = clip.from && clip.from.value !== undefined ? clip.from.value : null;
      var toVal = clip.to && clip.to.value !== undefined ? clip.to.value : null;
      if (fromVal === null && toVal === null) continue;
      if (fromVal === null) fromVal = toVal;
      if (toVal === null) toVal = fromVal;

      var insetFrom = parseInsetValues(fromVal, bbox);
      var insetTo = parseInsetValues(toVal, bbox);
      if (!insetFrom && !insetTo) continue;
      if (!insetFrom) insetFrom = insetTo;
      if (!insetTo) insetTo = insetFrom;

      var t0 = getMotionStart(entry);
      var t1 = t0 + (entry.time && isFinite(entry.time.duration) ? entry.time.duration : 0);
      var ease = entry.time && entry.time.ease ? entry.time.ease : null;

      out.top.push({ t0: t0, t1: t1, v0: insetFrom.top, v1: insetTo.top, ease: ease });
      out.right.push({ t0: t0, t1: t1, v0: insetFrom.right, v1: insetTo.right, ease: ease });
      out.bottom.push({ t0: t0, t1: t1, v0: insetFrom.bottom, v1: insetTo.bottom, ease: ease });
      out.left.push({ t0: t0, t1: t1, v0: insetFrom.left, v1: insetTo.left, ease: ease });
      out.rx.push({ t0: t0, t1: t1, v0: insetFrom.rx || 0, v1: insetTo.rx || 0, ease: ease });
      out.ry.push({ t0: t0, t1: t1, v0: insetFrom.ry || 0, v1: insetTo.ry || 0, ease: ease });
    }

    function sortSeg(a, b) {
      if (a.t0 < b.t0) return -1;
      if (a.t0 > b.t0) return 1;
      return 0;
    }
    out.top.sort(sortSeg);
    out.right.sort(sortSeg);
    out.bottom.sort(sortSeg);
    out.left.sort(sortSeg);
    out.rx.sort(sortSeg);
    out.ry.sort(sortSeg);
    return out;
  }

  function buildClipPathPolygonSegments(motionList, bbox) {
    var out = { points: [], count: 0 };
    if (!motionList || !motionList.length || !bbox) return out;
    var entries = [];
    var maxCount = 0;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props.clipPath) continue;
      var clip = entry.props.clipPath || {};
      var fromVal = clip.from && clip.from.value !== undefined ? clip.from.value : null;
      var toVal = clip.to && clip.to.value !== undefined ? clip.to.value : null;
      if (fromVal === null && toVal === null) continue;
      if (fromVal === null) fromVal = toVal;
      if (toVal === null) toVal = fromVal;
      var fromPts = parsePolygonPoints(fromVal, bbox);
      var toPts = parsePolygonPoints(toVal, bbox);
      if (!fromPts && !toPts) continue;
      if (!fromPts) fromPts = toPts;
      if (!toPts) toPts = fromPts;
      maxCount = Math.max(maxCount, fromPts.length, toPts.length);
      entries.push({ entry: entry, from: fromPts, to: toPts });
    }
    if (!entries.length || maxCount < 1) return out;

    for (var p = 0; p < maxCount; p++) {
      out.points.push({ x: [], y: [] });
    }

    for (var e = 0; e < entries.length; e++) {
      var info = entries[e];
      var norm = normalizePolygonPoints(info.from, info.to);
      if (!norm.count) continue;
      var t0 = getMotionStart(info.entry);
      var t1 = t0 + (info.entry.time && isFinite(info.entry.time.duration) ? info.entry.time.duration : 0);
      var ease = info.entry.time && info.entry.time.ease ? info.entry.time.ease : null;
      for (var idx = 0; idx < norm.count; idx++) {
        var p0 = norm.a[idx];
        var p1 = norm.b[idx];
        out.points[idx].x.push({ t0: t0, t1: t1, v0: p0[0], v1: p1[0], ease: ease });
        out.points[idx].y.push({ t0: t0, t1: t1, v0: p0[1], v1: p1[1], ease: ease });
      }
    }

    out.count = maxCount;
    return out;
  }

  function detectClipPathType(motionList, bbox) {
    if (!motionList || !motionList.length || !bbox) return null;
    var hasInset = false;
    var hasPoly = false;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props.clipPath) continue;
      var clip = entry.props.clipPath || {};
      var fromVal = clip.from && clip.from.value !== undefined ? clip.from.value : null;
      var toVal = clip.to && clip.to.value !== undefined ? clip.to.value : null;
      if (fromVal && String(fromVal).indexOf("inset(") === 0) hasInset = true;
      if (toVal && String(toVal).indexOf("inset(") === 0) hasInset = true;
      if (fromVal && String(fromVal).indexOf("polygon(") === 0) hasPoly = true;
      if (toVal && String(toVal).indexOf("polygon(") === 0) hasPoly = true;
    }
    if (hasInset && !hasPoly) return "inset";
    if (hasPoly && !hasInset) return "polygon";
    return null;
  }

  function applyClipPathMotion(layer, node, bbox) {
    if (!layer || !node || !node.motion || !node.motion.length || !bbox) return;
    if (!isAnimationEnabled()) return;
    var pathProp = findFirstShapePathProp(layer);
    if (!pathProp) return;
    var segments = collectClipPathSegments(node.motion);
    if (!segments.length) return;
    var useExpr = useExpressionAnimation();

    var startOffset = getMotionStartOffset(node.motion);
    withMotionTimeOffset(startOffset, function () {
      if (useExpr && pathProp.canSetExpression) {
        var mode = detectClipPathType(node.motion, bbox);
        if (mode === "polygon") {
          var polySegs = buildClipPathPolygonSegments(node.motion, bbox);
          if (polySegs.count) {
            var exprPoly = buildExprTimeVar();
            var ptsExpr = "[";
            for (var p = 0; p < polySegs.count; p++) {
              exprPoly += buildSegmentedVarExpr(polySegs.points[p].x, "px" + p, 0);
              exprPoly += buildSegmentedVarExpr(polySegs.points[p].y, "py" + p, 0);
              if (p > 0) ptsExpr += ",";
              ptsExpr += "[px" + p + ",py" + p + "]";
            }
            ptsExpr += "]";
            var zeros = [];
            for (var z = 0; z < polySegs.count; z++) zeros.push("[0,0]");
            exprPoly +=
              "var pts=" + ptsExpr + ";\n" +
              "createPath(pts," +
              "[" + zeros.join(",") + "]," +
              "[" + zeros.join(",") + "],true);";
            pathProp.expression = exprPoly;
            return;
          }
        }

        var insetSegs = buildClipPathInsetSegments(node.motion, bbox);
        var expr =
          buildExprTimeVar() +
          "var top=0; var right=0; var bottom=0; var left=0; var rx=0; var ry=0;\n" +
          buildSegmentedVarExpr(insetSegs.top, "top", 0) +
          buildSegmentedVarExpr(insetSegs.right, "right", 0) +
          buildSegmentedVarExpr(insetSegs.bottom, "bottom", 0) +
          buildSegmentedVarExpr(insetSegs.left, "left", 0) +
          buildSegmentedVarExpr(insetSegs.rx, "rx", 0) +
          buildSegmentedVarExpr(insetSegs.ry, "ry", 0) +
          "var w=Math.max(0," + bbox.w + "-left-right);\n" +
          "var h=Math.max(0," + bbox.h + "-top-bottom);\n" +
          "var x0=left; var y0=top; var x1=left+w; var y1=top+h;\n" +
          "rx=Math.min(Math.max(0,rx),w/2); ry=Math.min(Math.max(0,ry),h/2);\n" +
          "var hasRound=(rx>0 && ry>0);\n" +
          "var k=0.5522847498307936;\n" +
          "var rxk=hasRound?rx*k:0; var ryk=hasRound?ry*k:0;\n" +
          "var pts=[[x0+rx,y0],[x1-rx,y0],[x1,y0+ry],[x1,y1-ry],[x1-rx,y1],[x0+rx,y1],[x0,y1-ry],[x0,y0+ry]];\n" +
          "var inT=[[-rxk,0],[0,0],[-rxk,0],[0,0],[rxk,0],[0,0],[0,ryk],[0,0]];\n" +
          "var outT=[[0,0],[0,ryk],[0,0],[0,ryk],[0,0],[-rxk,0],[0,0],[0,-ryk]];\n" +
          "createPath(pts,inT,outT,true);";
        pathProp.expression = expr;
        return;
      }

      var fallbackMode = detectClipPathType(node.motion, bbox);
      var layerOffset = layer ? layer.inPoint : 0;
      for (var i = 0; i < segments.length; i++) {
        var entry = segments[i];
        var props = entry.props || {};
        var clip = props.clipPath || {};
        var fromVal = clip.from && clip.from.value !== undefined ? clip.from.value : null;
        var toVal = clip.to && clip.to.value !== undefined ? clip.to.value : null;
        if (fromVal === null && toVal === null) continue;
        if (fromVal === null) fromVal = toVal;
        if (toVal === null) toVal = fromVal;

        var t0 = getMotionStart(entry);
        var t1 = t0 + (entry.time && isFinite(entry.time.duration) ? entry.time.duration : 0);
        t0 += layerOffset;
        t1 += layerOffset;

        if (fallbackMode === "polygon") {
          var polyFrom = parsePolygonPoints(fromVal, bbox);
          var polyTo = parsePolygonPoints(toVal, bbox);
          if (!polyFrom && !polyTo) continue;
          if (!polyFrom) polyFrom = polyTo;
          if (!polyTo) polyTo = polyFrom;
          var normPoly = normalizePolygonPoints(polyFrom, polyTo);
          if (!normPoly.count) continue;
          var shapeFromPoly = buildPolygonShape(normPoly.a);
          var shapeToPoly = buildPolygonShape(normPoly.b);
          if (!shapeFromPoly || !shapeToPoly) continue;
          pathProp.setValueAtTime(t0, shapeFromPoly);
          pathProp.setValueAtTime(t1, shapeToPoly);
          continue;
        }

        var insetFrom = parseInsetValues(fromVal, bbox);
        var insetTo = parseInsetValues(toVal, bbox);
        if (!insetFrom && !insetTo) continue;
        if (!insetFrom) insetFrom = insetTo;
        if (!insetTo) insetTo = insetFrom;

        var shapeFrom = buildInsetShape(insetFrom, bbox);
        var shapeTo = buildInsetShape(insetTo, bbox);
        if (!shapeFrom || !shapeTo) continue;

        pathProp.setValueAtTime(t0, shapeFrom);
        pathProp.setValueAtTime(t1, shapeTo);
      }
    });
  }

  function findMotionTransformOrigin(motionList) {
    if (!motionList || !motionList.length) return null;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props.transformOrigin) continue;
      var prop = entry.props.transformOrigin;
      if (prop.from && prop.from.value !== undefined) return prop.from.value;
      if (prop.to && prop.to.value !== undefined) return prop.to.value;
    }
    return null;
  }

  function hasMotionProp(motionList, propName) {
    if (!motionList || !motionList.length || !propName) return false;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props[propName]) continue;
      return true;
    }
    return false;
  }

  function resolveImplicitTransformOrigin(motionList) {
    if (!motionList || !motionList.length) return null;
    var hasWidth = hasMotionProp(motionList, "width");
    var hasHeight = hasMotionProp(motionList, "height");
    if (hasWidth && hasHeight) return "left top";
    if (hasWidth) return "left center";
    if (hasHeight) return "center top";
    return null;
  }

  function setLayerAnchorToOrigin(layer, bbox, origin) {
    if (!layer || !bbox || !origin) return;
    var tr = layer.property("Transform");
    if (!tr) return;
    var anchorProp = tr.property("Anchor Point");
    var posProp = tr.property("Position");
    var scaleProp = tr.property("Scale");
    if (!anchorProp || !posProp || !scaleProp) return;
    var anchor = anchorProp.value;
    var pos = posProp.value;
    if (!anchor || !pos || anchor.length < 2 || pos.length < 2) return;
    var r = layer.sourceRectAtTime(0, false);
    if (!r) return;
    var newAnchor = [r.left + origin.x, r.top + origin.y];
    if (!isFinite(newAnchor[0]) || !isFinite(newAnchor[1])) return;
    var scale = scaleProp.value;
    var sx = scale && scale.length ? scale[0] / 100 : 1;
    var sy = scale && scale.length ? scale[1] / 100 : 1;
    var dx = (newAnchor[0] - anchor[0]) * sx;
    var dy = (newAnchor[1] - anchor[1]) * sy;
    anchorProp.setValue(newAnchor);
    posProp.setValue([pos[0] + dx, pos[1] + dy]);
  }

  function applyMotionTransformOrigin(layer, motionList, bbox) {
    var originValue = findMotionTransformOrigin(motionList);
    if (!originValue) {
      originValue = resolveImplicitTransformOrigin(motionList);
    }
    if (!originValue || !layer || !bbox) return;
    if (typeof resolveTransformOrigin !== "function") return;
    var origin = resolveTransformOrigin({ transformOrigin: originValue }, bbox);
    if (!origin) return;
    setLayerAnchorToOrigin(layer, bbox, origin);
  }
