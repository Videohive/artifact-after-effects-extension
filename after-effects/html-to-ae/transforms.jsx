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

