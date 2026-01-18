  // ============================================================
  // CLIP SHAPES
  // ============================================================

  function createClipShapeLayer(comp, node, bbox, clip, parentLayer, targetLayer) {
    var w = Math.max(1, bbox.w);
    var h = Math.max(1, bbox.h);

    debugLog(
      "Clip shape " +
        (node && node.name ? node.name : "node") +
        " bbox=" +
        w +
        "x" +
        h +
        " borderRadiusPx=" +
        (clip && typeof clip.borderRadiusPx !== "undefined" ? clip.borderRadiusPx : "n/a")
    );
    if (clip && clip.borderRadius) {
      debugLog(
        "Clip radii raw tl=" +
          toNum(clip.borderRadius.topLeft && clip.borderRadius.topLeft.x) +
          "," +
          toNum(clip.borderRadius.topLeft && clip.borderRadius.topLeft.y) +
          " tr=" +
          toNum(clip.borderRadius.topRight && clip.borderRadius.topRight.x) +
          "," +
          toNum(clip.borderRadius.topRight && clip.borderRadius.topRight.y) +
          " br=" +
          toNum(clip.borderRadius.bottomRight && clip.borderRadius.bottomRight.x) +
          "," +
          toNum(clip.borderRadius.bottomRight && clip.borderRadius.bottomRight.y) +
          " bl=" +
          toNum(clip.borderRadius.bottomLeft && clip.borderRadius.bottomLeft.x) +
          "," +
          toNum(clip.borderRadius.bottomLeft && clip.borderRadius.bottomLeft.y)
      );
    }

    var layer = comp.layers.addShape();
    layer.name = safeName(node.name || "Clip");

    var contents = layer.property("Contents");
    var grp = contents.addProperty("ADBE Vector Group");
    grp.name = "ClipGroup";

    var grpContents = grp.property("Contents");
    var shapes = [];
    if (clip && clip.path) {
      if (clip.path.paths && clip.path.paths.length) {
        shapes = clip.path.paths;
      } else if (clip.path.vertices && clip.path.inTangents && clip.path.outTangents) {
        shapes = [clip.path];
      } else if (clip.path.type === "polygon" && clip.path.points && clip.path.points.length >= 3) {
        shapes = [{ type: "polygon", points: clip.path.points }];
      }
    }
    if (!shapes.length) {
      var radii = getClipRadii(clip, w, h);
      shapes = [
        radii.hasAny
          ? roundedRectShapePerCorner(w, h, radii)
          : rectShape(w, h)
      ];
    }

    for (var si = 0; si < shapes.length; si++) {
      var pathProp = grpContents.addProperty("ADBE Vector Shape - Group");
      var shape = null;
      var s = shapes[si];
      if (s && s.vertices && s.inTangents && s.outTangents) {
        if (s.vertices.length && s.vertices[0] instanceof Array) {
          shape = s;
        } else {
          shape = shapeFromClipPath(s);
        }
      } else if (s && s.type === "polygon" && s.points && s.points.length >= 3) {
        shape = polygonShape(s.points);
      }
      if (!shape) continue;
      pathProp.property("Path").setValue(shape);
    }

    var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
    fill.property("Color").setValue([1, 1, 1]);
    setLayerTopLeft(layer, bbox);
    setLayerAnchorCenter(layer);
    if (parentLayer) layer.parent = parentLayer;

    if (targetLayer) {
      layer.moveBefore(targetLayer);
      targetLayer.trackMatteType = TrackMatteType.ALPHA;
    }

    return layer;
  }

  function rectShape(w, h) {
    var s = new Shape();
    s.vertices = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
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

  function polygonShape(points) {
    var s = new Shape();
    var verts = [];
    var ins = [];
    var outs = [];

    for (var i = 0; i < points.length; i++) {
      verts.push([Number(points[i].x) || 0, Number(points[i].y) || 0]);
      ins.push([0, 0]);
      outs.push([0, 0]);
    }

    s.vertices = verts;
    s.inTangents = ins;
    s.outTangents = outs;
    s.closed = true;
    return s;
  }

  function shapeFromClipPath(path) {
    var s = new Shape();
    var verts = [];
    var ins = [];
    var outs = [];
    var len = path.vertices ? path.vertices.length : 0;

    for (var i = 0; i < len; i++) {
      var v = path.vertices[i] || {};
      verts.push([Number(v.x) || 0, Number(v.y) || 0]);
    }

    for (var j = 0; j < len; j++) {
      var it = (path.inTangents && path.inTangents[j]) || {};
      var ot = (path.outTangents && path.outTangents[j]) || {};
      ins.push([Number(it.x) || 0, Number(it.y) || 0]);
      outs.push([Number(ot.x) || 0, Number(ot.y) || 0]);
    }

    s.vertices = verts;
    s.inTangents = ins;
    s.outTangents = outs;
    s.closed = path.closed !== false;
    return s;
  }

  function getClipRadii(clip, w, h) {
    var zr = { x: 0, y: 0 };
    var r = clip && clip.borderRadius ? clip.borderRadius : null;

    var tl = r && r.topLeft ? r.topLeft : zr;
    var tr = r && r.topRight ? r.topRight : zr;
    var br = r && r.bottomRight ? r.bottomRight : zr;
    var bl = r && r.bottomLeft ? r.bottomLeft : zr;

    var out = {
      tl: { rx: toNum(tl.x), ry: toNum(tl.y) },
      tr: { rx: toNum(tr.x), ry: toNum(tr.y) },
      br: { rx: toNum(br.x), ry: toNum(br.y) },
      bl: { rx: toNum(bl.x), ry: toNum(bl.y) },
      hasAny: false,
    };

    clampRadii(out, w, h);
    debugLog(
      "Clip radii clamped tl=" +
        out.tl.rx +
        "," +
        out.tl.ry +
        " tr=" +
        out.tr.rx +
        "," +
        out.tr.ry +
        " br=" +
        out.br.rx +
        "," +
        out.br.ry +
        " bl=" +
        out.bl.rx +
        "," +
        out.bl.ry
    );
    out.hasAny =
      out.tl.rx > 0 ||
      out.tl.ry > 0 ||
      out.tr.rx > 0 ||
      out.tr.ry > 0 ||
      out.br.rx > 0 ||
      out.br.ry > 0 ||
      out.bl.rx > 0 ||
      out.bl.ry > 0;

    return out;
  }

  function clampRadii(r, w, h) {
    r.tl.rx = clampRadius(r.tl.rx, w);
    r.tr.rx = clampRadius(r.tr.rx, w);
    r.br.rx = clampRadius(r.br.rx, w);
    r.bl.rx = clampRadius(r.bl.rx, w);

    r.tl.ry = clampRadius(r.tl.ry, h);
    r.tr.ry = clampRadius(r.tr.ry, h);
    r.br.ry = clampRadius(r.br.ry, h);
    r.bl.ry = clampRadius(r.bl.ry, h);

    // CSS-like uniform scale so all corners fit within box.
    var scale = 1;
    var sumTop = r.tl.rx + r.tr.rx;
    var sumBottom = r.bl.rx + r.br.rx;
    var sumLeft = r.tl.ry + r.bl.ry;
    var sumRight = r.tr.ry + r.br.ry;

    if (sumTop > w && sumTop > 0) scale = Math.min(scale, w / sumTop);
    if (sumBottom > w && sumBottom > 0) scale = Math.min(scale, w / sumBottom);
    if (sumLeft > h && sumLeft > 0) scale = Math.min(scale, h / sumLeft);
    if (sumRight > h && sumRight > 0) scale = Math.min(scale, h / sumRight);

    if (scale < 1) {
      r.tl.rx *= scale;
      r.tr.rx *= scale;
      r.br.rx *= scale;
      r.bl.rx *= scale;
      r.tl.ry *= scale;
      r.tr.ry *= scale;
      r.br.ry *= scale;
      r.bl.ry *= scale;
    }
  }

  function normalizePair(a, b, key, limit) {
    var sum = a[key] + b[key];
    if (sum <= limit || sum === 0) return;
    var s = limit / sum;
    a[key] *= s;
    b[key] *= s;
  }

  function clampRadius(v, max) {
    if (isNaN(v) || v < 0) return 0;
    if (v > max) return max;
    return v;
  }

  function clampRoundnessValue(value, w, h) {
    var v = Number(value);
    if (isNaN(v) || v <= 0) return 0;
    var max = Math.min(Number(w) || 0, Number(h) || 0) / 2;
    if (!isFinite(max) || max <= 0) return v;
    return Math.min(v, max);
  }

  function toNum(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function roundedRectShapePerCorner(w, h, radii) {
    var k = 0.5522847498307936; // kappa

    var tlx = radii.tl.rx;
    var tly = radii.tl.ry;
    var trx = radii.tr.rx;
    var tryy = radii.tr.ry;
    var brx = radii.br.rx;
    var bry = radii.br.ry;
    var blx = radii.bl.rx;
    var bly = radii.bl.ry;

    var s = new Shape();
    s.closed = true;

    s.vertices = [
      [tlx, 0],
      [w - trx, 0],
      [w, tryy],
      [w, h - bry],
      [w - brx, h],
      [blx, h],
      [0, h - bly],
      [0, tly],
    ];
    s.inTangents = [
      [-tlx * k, 0],
      [0, 0],
      [0, -tryy * k],
      [0, 0],
      [brx * k, 0],
      [0, 0],
      [0, bly * k],
      [0, 0],
    ];

    s.outTangents = [
      [0, 0],
      [trx * k, 0],
      [0, 0],
      [0, bry * k],
      [0, 0],
      [-blx * k, 0],
      [0, 0],
      [0, -tly * k],
    ];

    return s;
  }

