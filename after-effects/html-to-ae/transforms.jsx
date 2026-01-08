  // ============================================================
  // TRANSFORMS / FITTING
  // ============================================================

  function parseTransform(transformStr) {
    if (!transformStr) return null;
    var t = String(transformStr).trim();
    if (t === "none") return null;

    var matrixMatch = t.match(/matrix\(([^)]+)\)/i);
    var rotateMatch = t.match(/rotate\(([-\d.]+)(deg|rad)?\)/i);
    var rotation = 0;

    if (matrixMatch && matrixMatch[1]) {
      var nums = matrixMatch[1].match(/-?[\d.]+/g);
      if (nums && nums.length >= 6) {
        var a = Number(nums[0]);
        var b = Number(nums[1]);
        if (!isNaN(a) && !isNaN(b)) {
          rotation += Math.atan2(b, a) * (180 / Math.PI);
        }
      }
    }

    if (rotateMatch) {
      var v = Number(rotateMatch[1]);
      if (!isNaN(v)) {
        var unit = rotateMatch[2] || "deg";
        rotation += unit === "rad" ? (v * 180) / Math.PI : v;
      }
    }

    if (!rotation) return null;
    return { rotation: rotation };
  }

  function parseTransformOriginToken(token, size, axis) {
    if (!token) return null;
    var t = String(token).toLowerCase();
    if (t === "center") return size / 2;
    if (axis === "x") {
      if (t === "left") return 0;
      if (t === "right") return size;
    }
    if (axis === "y") {
      if (t === "top") return 0;
      if (t === "bottom") return size;
    }
    if (t.indexOf("%") !== -1) {
      var pct = parseFloat(t);
      if (isFinite(pct)) return (size * pct) / 100;
    }
    var num = parseFloat(t);
    return isFinite(num) ? num : null;
  }

  function resolveTransformOrigin(style, bbox) {
    var w = bbox && isFinite(bbox.w) ? bbox.w : 0;
    var h = bbox && isFinite(bbox.h) ? bbox.h : 0;
    var def = { x: w / 2, y: h / 2 };
    if (!style || !style.transformOrigin) return def;

    var raw = String(style.transformOrigin || "")
      .replace(/,/g, " ")
      .split(/\s+/);
    var tokens = [];
    for (var i = 0; i < raw.length; i++) {
      if (raw[i]) tokens.push(raw[i]);
    }
    if (!tokens.length) return def;

    var t0 = String(tokens[0]).toLowerCase();
    var t1 = tokens.length > 1 ? String(tokens[1]).toLowerCase() : null;
    var isYKeyword = function (t) {
      return t === "top" || t === "bottom";
    };

    if (t1 && isYKeyword(t0) && !isYKeyword(t1)) {
      var tmp = t0;
      t0 = t1;
      t1 = tmp;
    }

    if (tokens.length === 1) {
      var xSingle = parseTransformOriginToken(t0, w, "x");
      var ySingle = parseTransformOriginToken(t0, h, "y");
      if (xSingle !== null && ySingle !== null) return { x: xSingle, y: ySingle };
      if (xSingle !== null) return { x: xSingle, y: def.y };
      if (ySingle !== null) return { x: def.x, y: ySingle };
      return def;
    }

    var x = parseTransformOriginToken(t0, w, "x");
    var y = parseTransformOriginToken(t1, h, "y");
    if (x === null) x = def.x;
    if (y === null) y = def.y;
    return { x: x, y: y };
  }

  function setLayerAnchorToOrigin(layer, bbox, origin) {
    if (!layer || !bbox || !origin) return;
    var r = layer.sourceRectAtTime(0, false);
    var anchorX = r.left + origin.x;
    var anchorY = r.top + origin.y;
    if (!isFinite(anchorX) || !isFinite(anchorY)) return;
    layer
      .property("Transform")
      .property("Anchor Point")
      .setValue([anchorX, anchorY]);
    layer
      .property("Transform")
      .property("Position")
      .setValue([bbox.x + origin.x, bbox.y + origin.y]);
  }

  function getWritingModeRotation(writingMode) {
    if (!writingMode) return 0;
    var wm = String(writingMode).toLowerCase();
    if (wm.indexOf("vertical-rl") === 0) return 90;
    if (wm.indexOf("vertical-lr") === 0) return -90;
    if (wm.indexOf("vertical") === 0) return 90;
    return 0;
  }

  function applyTransform(layer, style, bbox, writingMode) {
    if (!style) return;
    var baseRotation = getWritingModeRotation(writingMode);
    var hasCssTransform = style.transform && style.transform !== "none";
    var tr = hasCssTransform ? parseTransform(style.transform) : null;
    if (!tr && !baseRotation) return;

    var origin = resolveTransformOrigin(style, bbox);
    setLayerAnchorToOrigin(layer, bbox, origin);

    var rotation = baseRotation;
    if (tr && typeof tr.rotation !== "undefined" && !isNaN(tr.rotation)) {
      rotation += tr.rotation;
    }
    if (rotation) {
      layer
        .property("Transform")
        .property("Rotation")
        .setValue(rotation);
    }
  }

  function setLayerTransform(layer, bbox) {
    // In AE, Position is at layer anchor; for solids/shapes/precomps default anchor is center.
    // We'll keep default center anchor and place at bbox center.
    var x = bbox.x + bbox.w / 2;
    var y = bbox.y + bbox.h / 2;
    layer.property("Transform").property("Position").setValue([x, y]);
  }

  function setLayerTopLeft(layer, bbox) {
    var t = layer.property("Transform");
    t.property("Anchor Point").setValue([0, 0]);
    t.property("Position").setValue([bbox.x, bbox.y]);
  }

  function setLayerPositionByBox(layer, bbox) {
    var x = bbox.x + bbox.w / 2;
    var y = bbox.y + bbox.h / 2;
    layer.property("Transform").property("Position").setValue([x, y]);
  }

  function fitLayerToBox(layer, bbox, cover) {
    // cover=true -> scale to cover bbox (like background-size:cover)
    // cover=false -> contain
    var r = layer.sourceRectAtTime(0, false);
    var sw = r.width;
    var sh = r.height;

    // Some footage returns 0 before it�s loaded; fallback to source dimensions
    if (sw <= 0 || sh <= 0) {
      if (layer.source) {
        sw = layer.source.width;
        sh = layer.source.height;
      }
    }
    if (sw <= 0 || sh <= 0) return;

    var sx = (bbox.w / sw) * 100;
    var sy = (bbox.h / sh) * 100;
    var s = cover ? Math.max(sx, sy) : Math.min(sx, sy);

    layer.property("Transform").property("Scale").setValue([s, s]);
  }

