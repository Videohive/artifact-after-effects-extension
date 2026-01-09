  // ============================================================
  // TRANSFORMS / FITTING
  // ============================================================

  function parseTransform(transformStr) {
    if (!transformStr) return null;
    var t = String(transformStr).trim();
    if (t === "none") return null;

    var re = /([a-zA-Z]+)\(([^)]+)\)/g;
    var m = null;
    var mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

    function multiply(m1, m2) {
      return {
        a: m1.a * m2.a + m1.c * m2.b,
        b: m1.b * m2.a + m1.d * m2.b,
        c: m1.a * m2.c + m1.c * m2.d,
        d: m1.b * m2.c + m1.d * m2.d,
        e: m1.a * m2.e + m1.c * m2.f + m1.e,
        f: m1.b * m2.e + m1.d * m2.f + m1.f,
      };
    }

    function parseNums(str) {
      var nums = String(str).match(/-?[\d.]+/g);
      if (!nums || !nums.length) return [];
      var out = [];
      for (var i = 0; i < nums.length; i++) {
        var n = Number(nums[i]);
        if (!isNaN(n)) out.push(n);
      }
      return out;
    }

    while ((m = re.exec(t)) !== null) {
      var fn = String(m[1]).toLowerCase();
      var raw = m[2] || "";
      var nums = parseNums(raw);
      if (fn === "matrix" && nums.length >= 6) {
        mat = multiply(mat, {
          a: nums[0],
          b: nums[1],
          c: nums[2],
          d: nums[3],
          e: nums[4],
          f: nums[5],
        });
        continue;
      }
      if (fn === "translate") {
        var tx = nums.length ? nums[0] : 0;
        var ty = nums.length > 1 ? nums[1] : 0;
        mat = multiply(mat, { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
        continue;
      }
      if (fn === "translatex") {
        mat = multiply(mat, { a: 1, b: 0, c: 0, d: 1, e: nums[0] || 0, f: 0 });
        continue;
      }
      if (fn === "translatey") {
        mat = multiply(mat, { a: 1, b: 0, c: 0, d: 1, e: 0, f: nums[0] || 0 });
        continue;
      }
      if (fn === "scale") {
        var sx = nums.length ? nums[0] : 1;
        var sy = nums.length > 1 ? nums[1] : sx;
        mat = multiply(mat, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
        continue;
      }
      if (fn === "scalex") {
        mat = multiply(mat, { a: nums[0] || 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        continue;
      }
      if (fn === "scaley") {
        mat = multiply(mat, { a: 1, b: 0, c: 0, d: nums[0] || 1, e: 0, f: 0 });
        continue;
      }
      if (fn === "rotate") {
        var v = nums.length ? nums[0] : 0;
        if (raw && raw.indexOf("rad") !== -1) v = (v * 180) / Math.PI;
        var rad = (v * Math.PI) / 180;
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        mat = multiply(mat, { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 });
        continue;
      }
    }

    var rotation = Math.atan2(mat.b, mat.a) * (180 / Math.PI);
    var scaleX = Math.sqrt(mat.a * mat.a + mat.b * mat.b);
    var scaleY = Math.sqrt(mat.c * mat.c + mat.d * mat.d);
    var txOut = mat.e;
    var tyOut = mat.f;

    if (!isFinite(rotation)) rotation = 0;
    if (!isFinite(scaleX) || scaleX === 0) scaleX = 1;
    if (!isFinite(scaleY) || scaleY === 0) scaleY = 1;
    if (!isFinite(txOut)) txOut = 0;
    if (!isFinite(tyOut)) tyOut = 0;

    var hasEffect =
      Math.abs(rotation) > 0.0001 ||
      Math.abs(scaleX - 1) > 0.0001 ||
      Math.abs(scaleY - 1) > 0.0001 ||
      Math.abs(txOut) > 0.0001 ||
      Math.abs(tyOut) > 0.0001;

    if (!hasEffect) return null;
    return { rotation: rotation, scaleX: scaleX, scaleY: scaleY, tx: txOut, ty: tyOut };
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

  function alignLayerToBBoxAfterRotation(layer, bbox, rotation) {
    if (!layer || !bbox || !isFinite(rotation)) return;
    var r = layer.sourceRectAtTime(0, false);
    if (!r) return;
    var tr = layer.property("Transform");
    var anchor = tr.property("Anchor Point").value;
    if (!anchor || anchor.length < 2) return;

    var pts = [
      { x: r.left - anchor[0], y: r.top - anchor[1] },
      { x: r.left + r.width - anchor[0], y: r.top - anchor[1] },
      { x: r.left + r.width - anchor[0], y: r.top + r.height - anchor[1] },
      { x: r.left - anchor[0], y: r.top + r.height - anchor[1] },
    ];

    var rad = (rotation * Math.PI) / 180;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);
    var minX = null;
    var minY = null;
    for (var i = 0; i < pts.length; i++) {
      var rx = cos * pts[i].x - sin * pts[i].y;
      var ry = sin * pts[i].x + cos * pts[i].y;
      if (minX === null || rx < minX) minX = rx;
      if (minY === null || ry < minY) minY = ry;
    }
    if (minX === null || minY === null) return;
    tr.property("Position").setValue([bbox.x - minX, bbox.y - minY]);
  }

  function applyTransform(layer, style, bbox, writingMode) {
    if (!style) style = {};
    var baseRotation = getWritingModeRotation(writingMode);
    var hasCssTransform = style.transform && style.transform !== "none";
    var tr = hasCssTransform ? parseTransform(style.transform) : null;
    if (!tr && !baseRotation) return;

    if (!tr && baseRotation) {
      layer
        .property("Transform")
        .property("Rotation")
        .setValue(baseRotation);
      alignLayerToBBoxAfterRotation(layer, bbox, baseRotation);
      return;
    }

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
      alignLayerToBBoxAfterRotation(layer, bbox, rotation);
    }

    if (tr && (Math.abs(tr.tx) > 0.0001 || Math.abs(tr.ty) > 0.0001)) {
      var posProp = layer.property("Transform").property("Position");
      var pos = posProp.value;
      posProp.setValue([pos[0] + tr.tx, pos[1] + tr.ty]);
    }

    if (
      tr &&
      (Math.abs(tr.scaleX - 1) > 0.0001 || Math.abs(tr.scaleY - 1) > 0.0001)
    ) {
      var scaleProp = layer.property("Transform").property("Scale");
      var s = scaleProp.value;
      scaleProp.setValue([s[0] * tr.scaleX, s[1] * tr.scaleY]);
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

