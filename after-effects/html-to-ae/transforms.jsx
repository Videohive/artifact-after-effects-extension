  // ============================================================
  // TRANSFORMS / FITTING
  // ============================================================

  function parseTransform(transformStr) {
    if (!transformStr) return null;
    var t = String(transformStr).trim();
    if (t === "none") return null;

    if (t.indexOf("matrix(") === 0) {
      var m = t.match(/-?[\d.]+/g);
      if (!m || m.length < 6) return null;
      var a = Number(m[0]);
      var b = Number(m[1]);
      var rot = Math.atan2(b, a) * (180 / Math.PI);
      return { rotation: rot };
    }

    if (t.indexOf("rotate(") === 0) {
      var r = t.match(/rotate\(([-\d.]+)(deg|rad)?\)/i);
      if (!r) return null;
      var v = Number(r[1]);
      if (isNaN(v)) return null;
      var unit = r[2] || "deg";
      var rotDeg = unit === "rad" ? (v * 180) / Math.PI : v;
      return { rotation: rotDeg };
    }

    return null;
  }

  function normalizeLayerAnchorToCenter(layer, bbox) {
    if (!layer || !bbox) return;
    var r = layer.sourceRectAtTime(0, false);
    var anchorX = r.left + r.width / 2;
    var anchorY = r.top + r.height / 2;
    layer
      .property("Transform")
      .property("Anchor Point")
      .setValue([anchorX, anchorY]);
    layer
      .property("Transform")
      .property("Position")
      .setValue([bbox.x + bbox.w / 2, bbox.y + bbox.h / 2]);
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

    // Center anchor to match CSS transform-origin: center (default).
    normalizeLayerAnchorToCenter(layer, bbox);

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

