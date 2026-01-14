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

  // -----------------------
  // MOTION -> EXPRESSIONS
  // -----------------------

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
      var fromExpr = 'effect("' + fromName + '")("Slider")';
      var toExpr = 'effect("' + toName + '")("Slider")';
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

  function collectMotionSegments(motionList, propName) {
    var out = [];
    if (!motionList || !motionList.length || !propName) return out;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.props || !entry.props[propName]) continue;
      out.push({ prop: propName, tween: entry, index: i });
    }
    return out;
  }

  function getMotionStart(entry) {
    if (!entry || !entry.time) return 0;
    var start = isFinite(entry.time.start) ? entry.time.start : 0;
    var delay = isFinite(entry.time.delay) ? entry.time.delay : 0;
    return start + delay;
  }

  function buildMotionSegments(motionList, propName, baseValue, scale, convertFn) {
    var entries = collectMotionSegments(motionList, propName);
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
      var fromVal = props && props.from ? parseMotionNumber(props.from.value) : null;
      var toVal = props && props.to ? parseMotionNumber(props.to.value) : null;
      if (fromVal === null) fromVal = prev;
      if (toVal === null) toVal = fromVal;
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
    return "var t=time;\nvar base=value;\n" + buildSegmentedVarExpr(segments, "v", "base") + "v;";
  }

  function buildEaseFunctionSource(easeStr) {
    if (!easeStr) return "function(t){return t;}";
    var raw = String(easeStr).trim();
    if (!raw) return "function(t){return t;}";
    if (raw.indexOf("function") === 0) return raw;

    var s = raw.toLowerCase();
    if (s === "linear" || s === "none") return "function(t){return t;}";

    var m = s.match(/^([a-z]+)(\d+)?\.(inout|in|out)(?:\(([^)]+)\))?$/);
    if (!m) return "function(t){return t;}";

    var base = m[1];
    var num = m[2] ? parseFloat(m[2]) : null;
    var mode = m[3];
    var param = m[4] ? parseFloat(m[4]) : null;

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

    return "function(t){return t;}";
  }

  function buildTweenExpression(t0, t1, v0, v1, easeStr, suffix) {
    var easeFn = buildEaseFunctionSource(easeStr);
    var expr =
      "var t=time;\n" +
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
      "var t=time; var t0=" +
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

  function mapSplitBasedOn(type) {
    if (type === "words") return 3;
    if (type === "lines") return 4;
    return 1; // chars
  }

  function findSplitTween(motionList) {
    if (!motionList || !motionList.length) return null;
    var best = null;
    var bestTime = null;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.splitText) continue;
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
    var firstSplitProps = null;
    for (var i = 0; i < motionList.length; i++) {
      var entry = motionList[i];
      if (!entry || !entry.splitText) continue;
      if (!splitType) splitType = String(entry.splitText).toLowerCase();
      var props = entry.props || null;
      if (!firstSplitProps && props) firstSplitProps = props;
      if (!props) continue;
      if (props.opacity) hasOpacity = true;
      if (props.x || props.y || props.xPercent || props.yPercent) hasPosition = true;
      if (props.scale || props.scaleX || props.scaleY) hasScale = true;
      if (props.rotation || props.rotate) hasRotation = true;
      if (props.rotateX || props.rotateY) hasRotation3d = true;
    }
    if (!splitType) return;
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
          if (rotStart === null) rotStart = getSplitStartValue(firstSplitProps, "rotate", 0);
          if (rotStart !== null) rotationProp.setValue(rotStart);
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
    var splitTween = findSplitTween(motionList);
    if (offsetProp && splitTween && offsetProp.canSetExpression) {
      var t0 = getMotionStart(splitTween);
      var dur = splitTween.time && isFinite(splitTween.time.duration) ? splitTween.time.duration : 0;
      var stagger = splitTween.time && isFinite(splitTween.time.stagger) ? splitTween.time.stagger : 0;
      var t1 = t0 + dur + stagger;
      var ease = splitTween.time && splitTween.time.ease ? splitTween.time.ease : null;
      offsetProp.expression = buildTweenExpression(t0, t1, 0, 100, ease, "v");
    }

  }

  function applyMotion(layer, node, bbox) {
    if (!layer || !node || !node.motion || !node.motion.length) return;
    var motionList = node.motion;
    applyMotionTransformOrigin(layer, motionList, bbox);
    ensureSplitTextAnimator(layer, motionList, bbox);

    // Opacity (0..1 -> 0..100)
    var opacityProp = layer.property("Transform").property("Opacity");
    var baseOpacity = opacityProp.value;
    var opacitySegments = buildMotionSegments(motionList, "opacity", baseOpacity / 100, 100, null);
    attachMotionControls(opacitySegments, layer, "Opacity", null);
    if (opacitySegments.length) {
      if (opacityProp.canSetExpression) {
        opacityProp.expression = buildSegmentedScalarExpression(opacitySegments, baseOpacity);
      }
    }

    // Position (x/y offsets)
    var basePos = layer.property("Transform").property("Position").value;
    var axisW = bbox && isFinite(bbox.w) ? bbox.w : 0;
    var axisH = bbox && isFinite(bbox.h) ? bbox.h : 0;
    var xSegments = buildMotionSegments(motionList, "x", 0, 1, null);
    var ySegments = buildMotionSegments(motionList, "y", 0, 1, null);
    var xPercentSegments = buildMotionSegments(motionList, "xPercent", 0, 1, null);
    var yPercentSegments = buildMotionSegments(motionList, "yPercent", 0, 1, null);
    attachMotionControls(xSegments, layer, "Position X", null);
    attachMotionControls(ySegments, layer, "Position Y", null);
    attachMotionControls(xPercentSegments, layer, "Position X Percent", function (expr) {
      return "(" + expr + "/100)*" + axisW;
    });
    attachMotionControls(yPercentSegments, layer, "Position Y Percent", function (expr) {
      return "(" + expr + "/100)*" + axisH;
    });
    if (xSegments.length || ySegments.length || xPercentSegments.length || yPercentSegments.length) {
      var expr =
        "var base=value;\n" +
        "var t=time;\n" +
        buildSegmentedVarExpr(xSegments, "tx", 0) +
        buildSegmentedVarExpr(ySegments, "ty", 0) +
        buildSegmentedVarExpr(xPercentSegments, "txp", 0) +
        buildSegmentedVarExpr(yPercentSegments, "typ", 0) +
        "[base[0]+tx+txp, base[1]+ty+typ];";
      var posProp = layer.property("Transform").property("Position");
      if (posProp.canSetExpression) posProp.expression = expr;
    }

    // Scale
    var scaleProp = layer.property("Transform").property("Scale");
    var baseScale = scaleProp.value;
    var scaleSegments = buildMotionSegments(motionList, "scale", baseScale[0] / 100, 100, null);
    var sxSegments = buildMotionSegments(motionList, "scaleX", baseScale[0] / 100, 100, null);
    var sySegments = buildMotionSegments(motionList, "scaleY", baseScale[1] / 100, 100, null);
    attachMotionControls(scaleSegments, layer, "Scale", null);
    attachMotionControls(sxSegments, layer, "Scale X", null);
    attachMotionControls(sySegments, layer, "Scale Y", null);
    if (scaleSegments.length || sxSegments.length || sySegments.length) {
      var expr =
        "var base=value;\n" +
        "var t=time;\n" +
        "var sx=base[0]; var sy=base[1];\n" +
        "var s=" +
        baseScale[0] +
        ";\n" +
        (scaleSegments.length ? buildSegmentedVarExpr(scaleSegments, "s", baseScale[0]) + "sx=s; sy=s;\n" : "") +
        (sxSegments.length ? buildSegmentedVarExpr(sxSegments, "sx", baseScale[0]) : "") +
        (sySegments.length ? buildSegmentedVarExpr(sySegments, "sy", baseScale[1]) : "") +
        "[sx, sy];";
      if (scaleProp.canSetExpression) scaleProp.expression = expr;
    }

    // Rotation
    var rotSegments = buildMotionSegments(motionList, "rotation", 0, 1, null);
    var rotateSegments = buildMotionSegments(motionList, "rotate", 0, 1, null);
    var rotationProp = layer.property("Transform").property("Rotation");
    var baseRot = rotationProp.value;
    var useRotSegments = rotSegments.length ? rotSegments : rotateSegments;
    if (useRotSegments.length) {
      if (!rotSegments.length && rotateSegments.length) {
        // If only "rotate" segments are provided, treat them as rotation.
        useRotSegments = rotateSegments;
      }
      // Rebuild with base values for rotation if missing in segments.
      var motionKey = rotSegments.length ? "rotation" : "rotate";
      useRotSegments = buildMotionSegments(motionList, motionKey, baseRot, 1, null);
      attachMotionControls(useRotSegments, layer, "Rotation", null);
      if (rotationProp.canSetExpression) {
        rotationProp.expression = buildSegmentedScalarExpression(useRotSegments, baseRot);
      }
    }
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
    if (roundIdx !== -1) s = s.substring(0, roundIdx);
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

    return {
      top: parsePart(top, bbox.h),
      right: parsePart(right, bbox.w),
      bottom: parsePart(bottom, bbox.h),
      left: parsePart(left, bbox.w),
    };
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

    var s = new Shape();
    s.vertices = [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ];
    s.inTangents = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    s.outTangents = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];
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
    var out = { top: [], right: [], bottom: [], left: [] };
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
    return out;
  }

  function applyClipPathMotion(layer, node, bbox) {
    if (!layer || !node || !node.motion || !node.motion.length || !bbox) return;
    var pathProp = findFirstShapePathProp(layer);
    if (!pathProp) return;
    var segments = collectClipPathSegments(node.motion);
    if (!segments.length) return;

    if (pathProp.canSetExpression) {
      var insetSegs = buildClipPathInsetSegments(node.motion, bbox);
      var expr =
        "var t=time;\n" +
        "var top=0; var right=0; var bottom=0; var left=0;\n" +
        buildSegmentedVarExpr(insetSegs.top, "top", 0) +
        buildSegmentedVarExpr(insetSegs.right, "right", 0) +
        buildSegmentedVarExpr(insetSegs.bottom, "bottom", 0) +
        buildSegmentedVarExpr(insetSegs.left, "left", 0) +
        "var w=Math.max(0," + bbox.w + "-left-right);\n" +
        "var h=Math.max(0," + bbox.h + "-top-bottom);\n" +
        "var x0=left; var y0=top; var x1=left+w; var y1=top+h;\n" +
        "createPath([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]," +
        "[[0,0],[0,0],[0,0],[0,0]],[[0,0],[0,0],[0,0],[0,0]],true);";
      pathProp.expression = expr;
      return;
    }

    for (var i = 0; i < segments.length; i++) {
      var entry = segments[i];
      var props = entry.props || {};
      var clip = props.clipPath || {};
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

      var shapeFrom = buildInsetShape(insetFrom, bbox);
      var shapeTo = buildInsetShape(insetTo, bbox);
      if (!shapeFrom || !shapeTo) continue;

      var t0 = getMotionStart(entry);
      var t1 = t0 + (entry.time && isFinite(entry.time.duration) ? entry.time.duration : 0);
      pathProp.setValueAtTime(t0, shapeFrom);
      pathProp.setValueAtTime(t1, shapeTo);
    }
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

  function applyMotionTransformOrigin(layer, motionList, bbox) {
    var originValue = findMotionTransformOrigin(motionList);
    if (!originValue || !layer || !bbox) return;
    if (typeof resolveTransformOrigin !== "function") return;
    var origin = resolveTransformOrigin({ transformOrigin: originValue }, bbox);
    if (!origin) return;
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
