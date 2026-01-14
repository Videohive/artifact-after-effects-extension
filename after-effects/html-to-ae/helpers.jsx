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

  function applyMotion(layer, node, bbox) {
    if (!layer || !node || !node.motion || !node.motion.length) return;
    var motionList = node.motion;

    // Opacity (0..1 -> 0..100)
    var opacityEntry = pickMotionProp(motionList, ["opacity"]);
    if (opacityEntry) {
      var o = opacityEntry.tween;
      var of = o.props.opacity && o.props.opacity.from ? parseMotionNumber(o.props.opacity.from.value) : null;
      var ot = o.props.opacity && o.props.opacity.to ? parseMotionNumber(o.props.opacity.to.value) : null;
      if (of !== null || ot !== null) {
        var baseOpacity = layer.property("Transform").property("Opacity").value;
        if (of === null) of = baseOpacity / 100;
        if (ot === null) ot = baseOpacity / 100;
        var t0 = (o.time && isFinite(o.time.start) ? o.time.start : 0) + (o.time && isFinite(o.time.delay) ? o.time.delay : 0);
        var t1 = t0 + (o.time && isFinite(o.time.duration) ? o.time.duration : 0);
        var easeStr = o.time && o.time.ease ? o.time.ease : null;
        var expr = buildTweenExpression(t0, t1, of * 100, ot * 100, easeStr, "v");
        var prop = layer.property("Transform").property("Opacity");
        if (prop.canSetExpression) prop.expression = expr;
      }
    }

    // Position (x/y offsets)
    var xEntry = pickMotionProp(motionList, ["x"]);
    var yEntry = pickMotionProp(motionList, ["y"]);
    if (xEntry || yEntry) {
      var basePos = layer.property("Transform").property("Position").value;
      var xt = xEntry ? xEntry.tween : null;
      var yt = yEntry ? yEntry.tween : null;
      var xf = xt && xt.props.x && xt.props.x.from ? parseMotionNumber(xt.props.x.from.value) : 0;
      var xto = xt && xt.props.x && xt.props.x.to ? parseMotionNumber(xt.props.x.to.value) : 0;
      var yf = yt && yt.props.y && yt.props.y.from ? parseMotionNumber(yt.props.y.from.value) : 0;
      var yto = yt && yt.props.y && yt.props.y.to ? parseMotionNumber(yt.props.y.to.value) : 0;
      if (xf === null) xf = 0;
      if (xto === null) xto = 0;
      if (yf === null) yf = 0;
      if (yto === null) yto = 0;
      var t0x = xt ? (xt.time.start || 0) + (xt.time.delay || 0) : 0;
      var t1x = xt ? t0x + (xt.time.duration || 0) : 0;
      var t0y = yt ? (yt.time.start || 0) + (yt.time.delay || 0) : 0;
      var t1y = yt ? t0y + (yt.time.duration || 0) : 0;

      var xEase = xt && xt.time && xt.time.ease ? xt.time.ease : null;
      var yEase = yt && yt.time && yt.time.ease ? yt.time.ease : null;
      var expr =
        "var base=value;\n" +
        "var tx=0; var ty=0;\n" +
        (xEntry ? buildTweenValueExpr(t0x, t1x, xf, xto, xEase, "tx") : "") +
        (yEntry ? buildTweenValueExpr(t0y, t1y, yf, yto, yEase, "ty") : "") +
        "[base[0]+tx, base[1]+ty];";
      var posProp = layer.property("Transform").property("Position");
      if (posProp.canSetExpression) posProp.expression = expr;
    }

    // Scale
    var scaleEntry = pickMotionProp(motionList, ["scale"]);
    var sxEntry = pickMotionProp(motionList, ["scaleX"]);
    var syEntry = pickMotionProp(motionList, ["scaleY"]);
    if (scaleEntry || sxEntry || syEntry) {
      var scaleProp = layer.property("Transform").property("Scale");
      var baseScale = scaleProp.value;
      var tScale = scaleEntry ? scaleEntry.tween : null;
      var tSx = sxEntry ? sxEntry.tween : null;
      var tSy = syEntry ? syEntry.tween : null;

      var sFrom = tScale && tScale.props.scale && tScale.props.scale.from ? parseMotionNumber(tScale.props.scale.from.value) : null;
      var sTo = tScale && tScale.props.scale && tScale.props.scale.to ? parseMotionNumber(tScale.props.scale.to.value) : null;
      var sxFrom = tSx && tSx.props.scaleX && tSx.props.scaleX.from ? parseMotionNumber(tSx.props.scaleX.from.value) : null;
      var sxTo = tSx && tSx.props.scaleX && tSx.props.scaleX.to ? parseMotionNumber(tSx.props.scaleX.to.value) : null;
      var syFrom = tSy && tSy.props.scaleY && tSy.props.scaleY.from ? parseMotionNumber(tSy.props.scaleY.from.value) : null;
      var syTo = tSy && tSy.props.scaleY && tSy.props.scaleY.to ? parseMotionNumber(tSy.props.scaleY.to.value) : null;

      var t0s = tScale ? (tScale.time.start || 0) + (tScale.time.delay || 0) : null;
      var t1s = tScale ? t0s + (tScale.time.duration || 0) : null;
      var t0sx = tSx ? (tSx.time.start || 0) + (tSx.time.delay || 0) : null;
      var t1sx = tSx ? t0sx + (tSx.time.duration || 0) : null;
      var t0sy = tSy ? (tSy.time.start || 0) + (tSy.time.delay || 0) : null;
      var t1sy = tSy ? t0sy + (tSy.time.duration || 0) : null;

      var scaleEase = tScale && tScale.time && tScale.time.ease ? tScale.time.ease : null;
      var sxEase = tSx && tSx.time && tSx.time.ease ? tSx.time.ease : null;
      var syEase = tSy && tSy.time && tSy.time.ease ? tSy.time.ease : null;
      var expr =
        "var base=value;\n" +
        "var sx=base[0]; var sy=base[1];\n" +
        "var s=0;\n" +
        (tScale
          ? buildTweenValueExpr(
              t0s,
              t1s,
              sFrom !== null ? sFrom * 100 : baseScale[0],
              sTo !== null ? sTo * 100 : baseScale[0],
              scaleEase,
              "s"
            ) + "sx=s; sy=s;\n"
          : "") +
        (tSx
          ? buildTweenValueExpr(
              t0sx,
              t1sx,
              sxFrom !== null ? sxFrom * 100 : baseScale[0],
              sxTo !== null ? sxTo * 100 : baseScale[0],
              sxEase,
              "sx"
            )
          : "") +
        (tSy
          ? buildTweenValueExpr(
              t0sy,
              t1sy,
              syFrom !== null ? syFrom * 100 : baseScale[1],
              syTo !== null ? syTo * 100 : baseScale[1],
              syEase,
              "sy"
            )
          : "") +
        "[sx, sy];";
      if (scaleProp.canSetExpression) scaleProp.expression = expr;
    }

    // Rotation
    var rotEntry = pickMotionProp(motionList, ["rotation", "rotate"]);
    if (rotEntry) {
      var r = rotEntry.tween;
      var rk = rotEntry.prop === "rotate" ? "rotate" : "rotation";
      var rf = r.props[rk] && r.props[rk].from ? parseMotionNumber(r.props[rk].from.value) : null;
      var rt = r.props[rk] && r.props[rk].to ? parseMotionNumber(r.props[rk].to.value) : null;
      if (rf !== null || rt !== null) {
        var baseRot = layer.property("Transform").property("Rotation").value;
        if (rf === null) rf = baseRot;
        if (rt === null) rt = baseRot;
        var t0r = (r.time && isFinite(r.time.start) ? r.time.start : 0) + (r.time && isFinite(r.time.delay) ? r.time.delay : 0);
        var t1r = t0r + (r.time && isFinite(r.time.duration) ? r.time.duration : 0);
        var rEase = r.time && r.time.ease ? r.time.ease : null;
        var rexpr = buildTweenExpression(t0r, t1r, rf, rt, rEase, "v");
        var rotProp = layer.property("Transform").property("Rotation");
        if (rotProp.canSetExpression) rotProp.expression = rexpr;
      }
    }
  }
