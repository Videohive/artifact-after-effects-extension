  // ============================================================
  // LAYER CREATORS
  // ============================================================

  function normalizePaletteControlName(value) {
    var s = String(value || "");
    s = s.replace(/\bbg\b/gi, "Background");
    return safeName(s);
  }

  function createPaletteAdjustmentLayer(comp, palette) {
    if (!palette || !palette.length) return null;
    setControlsCompName(comp.name);
    var layer = comp.layers.addSolid(
      [1, 1, 1],
      safeName("Controls"),
      comp.width,
      comp.height,
      1
    );
    layer.adjustmentLayer = true;
    layer.enabled = false;
    layer.label = 2;

    var effects = layer.property("Effects");
    for (var i = 0; i < palette.length; i++) {
      var entry = palette[i];
      if (!entry || !entry.color) continue;
      var effect = effects.addProperty("ADBE Color Control");
      var controlName = normalizePaletteControlName(entry.name || entry.id || "Color");
      effect.name = controlName;
      var colorProp = effect.property("Color");
      if (colorProp) colorProp.setValue(parseCssColor(entry.color));
      registerColorControl(comp.name, controlName, entry.color);
    }

    return layer;
  }

  function createSolidBackground(comp, cssColor, w, h, name) {
    var rgb = parseCssColor(cssColor);
    var solid = comp.layers.addSolid(
      rgb,
      safeName(name || "Background"),
      w,
      h,
      1
    );
    applyFillEffect(solid, rgb, parseCssAlpha(cssColor));
    solid
      .property("Transform")
      .property("Position")
      .setValue([w / 2, h / 2]);
    applyOpacity(solid, null, parseCssAlpha(cssColor));
    return solid;
  }

  function resolveLinearGradientPoints(angleDeg, bbox) {
    if (!bbox) return { start: [0, 0], end: [0, 0] };
    var rad = (angleDeg * Math.PI) / 180;
    var dx = Math.sin(rad);
    var dy = -Math.cos(rad);
    var cx = bbox.x + bbox.w / 2;
    var cy = bbox.y + bbox.h / 2;
    var half = Math.sqrt(bbox.w * bbox.w + bbox.h * bbox.h) / 2;
    var start = [cx - dx * half, cy - dy * half];
    var end = [cx + dx * half, cy + dy * half];
    return { start: start, end: end };
  }

  function getEffectProp(effect, names) {
    if (!effect || !names) return null;
    for (var i = 0; i < names.length; i++) {
      var prop = effect.property(names[i]);
      if (prop) return prop;
    }
    return null;
  }

  function applyGradientRamp(layer, gradient, bbox) {
    if (!layer || !gradient || !gradient.stops || !gradient.stops.length) return;
    var effects = layer.property("Effects");
    if (!effects) return;
    var effect = effects.addProperty("ADBE Ramp");
    if (!effect) return;

    var stops = gradient.stops;
    var startStop = stops[0];
    var endStop = stops.length > 1 ? stops[stops.length - 1] : stops[0];
    var startColor = parseCssColor(startStop.color);
    var endColor = parseCssColor(endStop.color);

    var isRadial = String(gradient.type || "").toLowerCase() === "radial";
    var shapeProp = getEffectProp(effect, ["Ramp Shape"]);
    if (shapeProp) shapeProp.setValue(isRadial ? 2 : 1);

    var startProp = getEffectProp(effect, ["Start of Ramp", "Start Point"]);
    var endProp = getEffectProp(effect, ["End of Ramp", "End Point"]);
    if (startProp && endProp) {
      if (isRadial) {
        var center = [bbox.x + bbox.w / 2, bbox.y + bbox.h / 2];
        startProp.setValue(center);
        endProp.setValue([center[0] + bbox.w / 2, center[1]]);
      } else {
        var points = resolveLinearGradientPoints(gradient.angle || 180, bbox);
        startProp.setValue(points.start);
        endProp.setValue(points.end);
      }
    }

    var startColorProp = getEffectProp(effect, ["Start Color"]);
    var endColorProp = getEffectProp(effect, ["End Color"]);
    if (startColorProp) startColorProp.setValue(startColor);
    if (endColorProp) endColorProp.setValue(endColor);
  }

  function applyBackgroundGradients(layer, style, bbox) {
    if (!layer || !style || !bbox) return;
    var gradients = getBackgroundGradients(style);
    if (!gradients || !gradients.length) return;
    for (var i = 0; i < gradients.length; i++) {
      applyGradientRamp(layer, gradients[i], bbox);
    }
  }

  function createPrecompLayer(node, parentComp, localBBox, rootData) {
    var preName = safeName(node.name || "Precomp");
    var w = Math.min(30000, Math.max(4, Math.round(localBBox.w)));
    var h = Math.min(30000, Math.max(4, Math.round(localBBox.h)));

    var precomp = app.project.items.addComp(
      preName,
      w,
      h,
      1,
      parentComp.duration,
      parentComp.frameRate
    );

    if (SLIDE_FOLDER) {
      precomp.parentFolder = SLIDE_FOLDER;
    }

    // Optional labeling disabled by request (no comments on created items).

    var layer = parentComp.layers.add(precomp);
    layer.name = preName;

    // Position precomp layer in parent comp to match node bbox
    setLayerTransform(layer, localBBox);

    return layer;
  }

  function createRectShape(comp, node, localBBox) {
    var layer = comp.layers.addShape();
    layer.name = safeName((node.name || "Rect") + "_bg");

    var contents = layer.property("Contents");

    // Group
    var grp = contents.addProperty("ADBE Vector Group");
    grp.name = "RectGroup";

    var grpContents = grp.property("Contents");
    var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([localBBox.w, localBBox.h]);

    // Rounded corners if borderRadius
    var br = 0;
    if (node.clip && typeof node.clip.borderRadiusPx !== "undefined")
      br = Number(node.clip.borderRadiusPx) || 0;
    if (br > 0) rect.property("Roundness").setValue(clampRoundnessValue(br, localBBox.w, localBBox.h));

    var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
    var gradients = getBackgroundGradients(node.style);
    var gradient = gradients && gradients.length ? gradients[0] : null;
    var fillColor = gradient ? pickGradientBaseColor(gradient) : getEffectiveBackgroundColor(node.style);
    applyCssColorProperty(fill.property("Color"), fillColor, comp.name);
    var fillAlpha = parseCssAlpha(fillColor);
    if (isFinite(fillAlpha)) {
      if (fillAlpha < 0) fillAlpha = 0;
      if (fillAlpha > 1) fillAlpha = 1;
      var fillOpacity = fill.property("Opacity");
      if (fillOpacity) fillOpacity.setValue(Math.round(fillAlpha * 100));
    }

    // Position: shapes have their own Transform inside group; easiest: layer position to bbox center
    setLayerTransform(layer, localBBox);
    setLayerAnchorCenter(layer);
    if (gradient) {
      applyBackgroundGradients(layer, node.style, localBBox);
    }

    return layer;
  }

  function createGridLayer(comp, node, localBBox) {
    if (!node || !node.style || !node.style.backgroundGrid) return null;

    var grid = node.style.backgroundGrid;
    var layer = comp.layers.addShape();
    layer.name = safeName((node.name || "Grid") + "_grid");
    setLayerTopLeft(layer, localBBox);

    var contents = layer.property("Contents");

    function addAxis(groupName, axis, lineLength, spanLength, thickness, spacing, offset, color) {
      if (
        !isFinite(lineLength) ||
        !isFinite(spanLength) ||
        !isFinite(thickness) ||
        !isFinite(spacing)
      )
        return;
      if (thickness <= 0 || spacing <= 0) return;

      var grp = contents.addProperty("ADBE Vector Group");
      grp.name = groupName;
      var grpContents = grp.property("Contents");

      var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
      if (axis === "x") {
        rect.property("Size").setValue([thickness, lineLength]);
      } else {
        rect.property("Size").setValue([lineLength, thickness]);
      }

      var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
      applyCssColorProperty(fill.property("Color"), color, comp.name);
      var fillOpacity = fill.property("Opacity");
      if (fillOpacity) fillOpacity.setValue(Math.round(parseCssAlpha(color) * 100));

      var tr = grp.property("Transform");
      var normOffset = offset;
      if (isFinite(normOffset) && spacing > 0) {
        normOffset = ((normOffset % spacing) + spacing) % spacing;
      } else {
        normOffset = 0;
      }
      if (axis === "x") {
        tr.property("Position").setValue([normOffset + thickness / 2, lineLength / 2]);
      } else {
        tr.property("Position").setValue([lineLength / 2, normOffset + thickness / 2]);
      }

      var copies = Math.floor((spanLength - normOffset) / spacing) + 1;
      if (!isFinite(copies) || copies < 1) copies = 1;
      if (copies > 2000) copies = 2000;

      var repeater = grpContents.addProperty("ADBE Vector Filter - Repeater");
      repeater.property("Copies").setValue(copies);
      var rtr = repeater.property("Transform");
      if (axis === "x") {
        rtr.property("Position").setValue([spacing, 0]);
      } else {
        rtr.property("Position").setValue([0, spacing]);
      }
    }

    if (grid.x) {
      addAxis(
        "Grid X",
        "x",
        localBBox.h,
        localBBox.w,
        Number(grid.x.lineWidthPx) || 0,
        Number(grid.x.spacingPx) || 0,
        Number(grid.x.offsetPx) || 0,
        grid.x.color
      );
    }

    if (grid.y) {
      addAxis(
        "Grid Y",
        "y",
        localBBox.w,
        localBBox.h,
        Number(grid.y.lineWidthPx) || 0,
        Number(grid.y.spacingPx) || 0,
        Number(grid.y.offsetPx) || 0,
        grid.y.color
      );
    }

    setLayerAnchorCenter(layer);
    return layer;
  }


  function isVisibleBorderSide(side) {
    if (!side) return false;
    if (!side.widthPx || side.widthPx <= 0) return false;
    var s = String(side.style || "").toLowerCase();
    if (s === "none" || s === "hidden") return false;
    if (isTransparentColor(side.color)) return false;
    return true;
  }

  function hasBorder(border) {
    if (!border) return false;
    if (border.isUniform) {
      return isVisibleBorderSide(border.sides ? border.sides.top : null);
    }
    if (!border.sides) return false;
    return (
      isVisibleBorderSide(border.sides.top) ||
      isVisibleBorderSide(border.sides.right) ||
      isVisibleBorderSide(border.sides.bottom) ||
      isVisibleBorderSide(border.sides.left)
    );
  }

  function createBorderShape(comp, node, localBBox) {
    if (!node || !node.border) return null;

    var border = node.border;
    var layer = comp.layers.addShape();
    layer.name = safeName((node.name || "Border") + "_border");

    var contents = layer.property("Contents");

    function isUniformRadius(radius) {
      if (!radius) return true;
      var v = Number(radius.topLeft && radius.topLeft.x) || 0;
      var vals = [
        v,
        Number(radius.topLeft && radius.topLeft.y) || 0,
        Number(radius.topRight && radius.topRight.x) || 0,
        Number(radius.topRight && radius.topRight.y) || 0,
        Number(radius.bottomRight && radius.bottomRight.x) || 0,
        Number(radius.bottomRight && radius.bottomRight.y) || 0,
        Number(radius.bottomLeft && radius.bottomLeft.x) || 0,
        Number(radius.bottomLeft && radius.bottomLeft.y) || 0,
      ];
      for (var i = 1; i < vals.length; i++) {
        if (Math.abs(vals[i] - v) > 0.0001) return false;
      }
      return true;
    }

    function clampUniformRoundness(value, w, h) {
      var v = Number(value);
      if (!isFinite(v) || v <= 0) return 0;
      var max = Math.min(Number(w) || 0, Number(h) || 0) / 2;
      if (!isFinite(max) || max <= 0) return v;
      return Math.min(v, max);
    }

    function offsetShapeVertices(shape, dx, dy) {
      if (!shape || !shape.vertices) return shape;
      for (var i = 0; i < shape.vertices.length; i++) {
        shape.vertices[i][0] += dx;
        shape.vertices[i][1] += dy;
      }
      return shape;
    }

    function buildPerCornerBorderPath(w, h, radius, inset) {
      if (!radius) return null;
      var radii = getClipRadii({ borderRadius: radius }, w, h);
      if (!radii || !radii.hasAny) return null;
      var shrink = inset / 2;
      if (!isFinite(shrink) || shrink < 0) shrink = 0;
      radii.tl.rx = Math.max(0, radii.tl.rx - shrink);
      radii.tl.ry = Math.max(0, radii.tl.ry - shrink);
      radii.tr.rx = Math.max(0, radii.tr.rx - shrink);
      radii.tr.ry = Math.max(0, radii.tr.ry - shrink);
      radii.br.rx = Math.max(0, radii.br.rx - shrink);
      radii.br.ry = Math.max(0, radii.br.ry - shrink);
      radii.bl.rx = Math.max(0, radii.bl.rx - shrink);
      radii.bl.ry = Math.max(0, radii.bl.ry - shrink);
      clampRadii(radii, w, h);
      var shape = roundedRectShapePerCorner(w, h, radii);
      return offsetShapeVertices(shape, -w / 2, -h / 2);
    }

    function buildUniformRadius(value) {
      var v = Number(value) || 0;
      return {
        topLeft: { x: v, y: v },
        topRight: { x: v, y: v },
        bottomRight: { x: v, y: v },
        bottomLeft: { x: v, y: v },
      };
    }

    function buildRoundedBorderShapeTopLeft(w, h, radius, inset) {
      if (!radius) return null;
      var shrink = inset / 2;
      if (!isFinite(shrink) || shrink < 0) shrink = 0;
      var innerW = Math.max(0, w - inset);
      var innerH = Math.max(0, h - inset);
      if (innerW <= 0 || innerH <= 0) return null;

      var radii = getClipRadii({ borderRadius: radius }, w, h);
      if (!radii) return null;
      radii.tl.rx = Math.max(0, radii.tl.rx - shrink);
      radii.tl.ry = Math.max(0, radii.tl.ry - shrink);
      radii.tr.rx = Math.max(0, radii.tr.rx - shrink);
      radii.tr.ry = Math.max(0, radii.tr.ry - shrink);
      radii.br.rx = Math.max(0, radii.br.rx - shrink);
      radii.br.ry = Math.max(0, radii.br.ry - shrink);
      radii.bl.rx = Math.max(0, radii.bl.rx - shrink);
      radii.bl.ry = Math.max(0, radii.bl.ry - shrink);
      clampRadii(radii, innerW, innerH);

      var shape = roundedRectShapePerCorner(innerW, innerH, radii);
      return offsetShapeVertices(shape, shrink, shrink);
    }

    function quarterEllipseLength(rx, ry) {
      if (!isFinite(rx) || !isFinite(ry)) return 0;
      if (rx <= 0 || ry <= 0) return 0;
      var a = rx;
      var b = ry;
      var h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
      var perimeter =
        Math.PI *
        (a + b) *
        (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
      return perimeter / 4;
    }

    function buildRoundedBorderPathInfo(w, h, radius, insets) {
      if (!radius) return null;
      var leftInset = (insets && insets.left) || 0;
      var rightInset = (insets && insets.right) || 0;
      var topInset = (insets && insets.top) || 0;
      var bottomInset = (insets && insets.bottom) || 0;

      var innerW = Math.max(0, w - leftInset - rightInset);
      var innerH = Math.max(0, h - topInset - bottomInset);
      if (innerW <= 0 || innerH <= 0) return null;

      var radii = getClipRadii({ borderRadius: radius }, w, h);
      if (!radii || !radii.hasAny) return null;

      radii.tl.rx = Math.max(0, radii.tl.rx - leftInset);
      radii.tl.ry = Math.max(0, radii.tl.ry - topInset);
      radii.tr.rx = Math.max(0, radii.tr.rx - rightInset);
      radii.tr.ry = Math.max(0, radii.tr.ry - topInset);
      radii.br.rx = Math.max(0, radii.br.rx - rightInset);
      radii.br.ry = Math.max(0, radii.br.ry - bottomInset);
      radii.bl.rx = Math.max(0, radii.bl.rx - leftInset);
      radii.bl.ry = Math.max(0, radii.bl.ry - bottomInset);

      clampRadii(radii, innerW, innerH);

      var shape = roundedRectShapePerCorner(innerW, innerH, radii);
      shape = offsetShapeVertices(shape, leftInset, topInset);

      var topEdge = Math.max(0, innerW - radii.tl.rx - radii.tr.rx);
      var rightEdge = Math.max(0, innerH - radii.tr.ry - radii.br.ry);
      var bottomEdge = Math.max(0, innerW - radii.br.rx - radii.bl.rx);
      var leftEdge = Math.max(0, innerH - radii.bl.ry - radii.tl.ry);

      var arcTR = quarterEllipseLength(radii.tr.rx, radii.tr.ry);
      var arcBR = quarterEllipseLength(radii.br.rx, radii.br.ry);
      var arcBL = quarterEllipseLength(radii.bl.rx, radii.bl.ry);
      var arcTL = quarterEllipseLength(radii.tl.rx, radii.tl.ry);

      var lenTop = topEdge;
      var lenTR = lenTop + arcTR;
      var lenRight = lenTR + rightEdge;
      var lenBR = lenRight + arcBR;
      var lenBottom = lenBR + bottomEdge;
      var lenBL = lenBottom + arcBL;
      var lenLeft = lenBL + leftEdge;
      var total = lenLeft + arcTL;

      if (total <= 0) return null;

      return {
        shape: shape,
        lengths: {
          lenTop: lenTop,
          lenTR: lenTR,
          lenRight: lenRight,
          lenBR: lenBR,
          lenBottom: lenBottom,
          lenBL: lenBL,
          lenLeft: lenLeft,
          total: total,
          arcTL: arcTL,
        },
      };
    }

    function addTrimmedSideGroup(name, side, pathInfo, startLen, endLen) {
      if (!isVisibleBorderSide(side)) return;
      if (!pathInfo || !pathInfo.shape || !pathInfo.lengths) return;
      var total = pathInfo.lengths.total;
      if (!isFinite(total) || total <= 0) return;
      var startPct = (startLen / total) * 100;
      var endPct = (endLen / total) * 100;
      if (!isFinite(startPct) || !isFinite(endPct)) return;
      if (endPct <= startPct) return;

      var grp = contents.addProperty("ADBE Vector Group");
      grp.name = "Border_" + name;
      var grpContents = grp.property("Contents");

      var pathProp = grpContents.addProperty("ADBE Vector Shape - Group");
      pathProp.property("Path").setValue(pathInfo.shape);

      var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
      applyCssColorProperty(stroke.property("Color"), side.color, comp.name);
      stroke.property("Stroke Width").setValue(Number(side.widthPx) || 0);
      var opacityProp = stroke.property("ADBE Vector Stroke Opacity");
      if (opacityProp) opacityProp.setValue(Math.round(parseCssAlpha(side.color) * 100));

      var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
      fill.enabled = false;

      var trim = grpContents.addProperty("ADBE Vector Filter - Trim");
      trim.property("Start").setValue(startPct);
      trim.property("End").setValue(endPct);
    }

    if (border.isUniform && isVisibleBorderSide(border.sides ? border.sides.top : null)) {
      var strokeWidth = Number(border.widthPx) || 0;
      var inset = strokeWidth > 0 ? strokeWidth : 0;

      var grp = contents.addProperty("ADBE Vector Group");
      grp.name = "Border";

      var grpContents = grp.property("Contents");
      var radiusObj = border.radius || (border.radiusPx ? buildUniformRadius(border.radiusPx) : null);
      var radiusPx = 0;
      if (isFinite(Number(border.radiusPx)) && Number(border.radiusPx) > 0) {
        radiusPx = Number(border.radiusPx);
      } else if (radiusObj && isUniformRadius(radiusObj)) {
        radiusPx = Number(radiusObj.topLeft && radiusObj.topLeft.x) || 0;
      }
      var innerW = Math.max(0, localBBox.w - inset);
      var innerH = Math.max(0, localBBox.h - inset);
      var roundness = clampUniformRoundness(Math.max(0, radiusPx - inset / 2), innerW, innerH);

      if (radiusPx > 0 && (!border.radius || isUniformRadius(border.radius))) {
        var rectPath = grpContents.addProperty("ADBE Vector Shape - Rect");
        rectPath.property("Size").setValue([innerW, innerH]);
        rectPath.property("Position").setValue([localBBox.w / 2, localBBox.h / 2]);
        if (roundness > 0) rectPath.property("Roundness").setValue(roundness);
      } else {
        var pathShape = radiusObj
          ? buildRoundedBorderShapeTopLeft(localBBox.w, localBBox.h, radiusObj, inset)
          : null;
        var rectGroupPath = grpContents.addProperty("ADBE Vector Shape - Group");
        if (pathShape) {
          rectGroupPath.property("Path").setValue(pathShape);
        } else {
          var fallbackRect = rectGroupPath.property("Path");
          var rawRect = rectShape(innerW, innerH);
          if (rawRect) {
            fallbackRect.setValue(offsetShapeVertices(rawRect, inset / 2, inset / 2));
          }
        }
      }

      var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
      applyCssColorProperty(stroke.property("Color"), border.color, comp.name);
      stroke.property("Stroke Width").setValue(strokeWidth);
      var opacityProp = stroke.property("ADBE Vector Stroke Opacity");
      if (opacityProp) opacityProp.setValue(Math.round(parseCssAlpha(border.color) * 100));

      var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
      fill.enabled = false

      setLayerTopLeft(layer, localBBox);
      return layer;
    }

    var sides = border.sides || {};

    var hasRadius =
      (border.radiusPx && border.radiusPx > 0) ||
      (border.radius && !isUniformRadius(border.radius));
    if (hasRadius) {
      var insets = {
        top: (Number(sides.top && sides.top.widthPx) || 0) / 2,
        right: (Number(sides.right && sides.right.widthPx) || 0) / 2,
        bottom: (Number(sides.bottom && sides.bottom.widthPx) || 0) / 2,
        left: (Number(sides.left && sides.left.widthPx) || 0) / 2,
      };
      var pathInfo = buildRoundedBorderPathInfo(
        localBBox.w,
        localBBox.h,
        border.radius,
        insets
      );
      if (pathInfo && pathInfo.lengths) {
        var len = pathInfo.lengths;
        if (isVisibleBorderSide(sides.right)) {
          addTrimmedSideGroup("Right", sides.right, pathInfo, len.lenTop, len.lenBR);
        }
        if (isVisibleBorderSide(sides.bottom)) {
          addTrimmedSideGroup("Bottom", sides.bottom, pathInfo, len.lenRight, len.lenBL);
        }
        if (isVisibleBorderSide(sides.left)) {
          addTrimmedSideGroup("Left", sides.left, pathInfo, len.lenBottom, len.total);
        }
        if (isVisibleBorderSide(sides.top)) {
          addTrimmedSideGroup("Top", sides.top, pathInfo, 0, len.lenTR);
          if (len.arcTL > 0) {
            addTrimmedSideGroup("Top_Arc", sides.top, pathInfo, len.lenLeft, len.total);
          }
        }

        setLayerTopLeft(layer, localBBox);
        return layer;
      }
    }

    function addSide(name, x1, y1, x2, y2, side) {
      if (!isVisibleBorderSide(side)) return;

      var sw = Number(side.widthPx) || 0;
      if (sw <= 0) return;

      var grp = contents.addProperty("ADBE Vector Group");
      grp.name = "Border_" + name;

      var grpContents = grp.property("Contents");
      var pathProp = grpContents.addProperty("ADBE Vector Shape - Group");

      var shape = new Shape();
      shape.vertices = [
        [x1, y1],
        [x2, y2],
      ];
      shape.inTangents = [
        [0, 0],
        [0, 0],
      ];
      shape.outTangents = [
        [0, 0],
        [0, 0],
      ];
      shape.closed = false;

      pathProp.property("Path").setValue(shape);

      var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
      applyCssColorProperty(stroke.property("Color"), side.color, comp.name);
      stroke.property("Stroke Width").setValue(sw);
      var opacityProp = stroke.property("ADBE Vector Stroke Opacity");
      if (opacityProp) opacityProp.setValue(Math.round(parseCssAlpha(side.color) * 100));

      var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
      fill.enabled = false
    }

    var topInset = (Number(sides.top && sides.top.widthPx) || 0) / 2;
    var rightInset = (Number(sides.right && sides.right.widthPx) || 0) / 2;
    var bottomInset = (Number(sides.bottom && sides.bottom.widthPx) || 0) / 2;
    var leftInset = (Number(sides.left && sides.left.widthPx) || 0) / 2;

    addSide("Top", 0, topInset, localBBox.w, topInset, sides.top);
    addSide("Right", localBBox.w - rightInset, 0, localBBox.w - rightInset, localBBox.h, sides.right);
    addSide("Bottom", 0, localBBox.h - bottomInset, localBBox.w, localBBox.h - bottomInset, sides.bottom);
    addSide("Left", leftInset, 0, leftInset, localBBox.h, sides.left);

    setLayerTopLeft(layer, localBBox);
    setLayerAnchorCenter(layer);
    return layer;
  }
  function applyFontWithFallback(doc, candidates) {
    var original = doc.font;

    for (var i = 0; i < candidates.length; i++) {
      try {
        $.writeln("AE Text: try font -> " + candidates[i]);
        doc.font = candidates[i];

        // AE silently fails > ���������
        if (doc.font === candidates[i]) {
          $.writeln("AE Text: applied font -> " + candidates[i]);
          return true; // �����
        }
      } catch (e) {}
    }

    // �����
    doc.font = original;
    $.writeln("AE Text: fallback to original font -> " + original);
    return false;
  }

    function buildFontCandidates(family, weight, style) {
    if (!family) return [];
    var rawFamily = String(family);
    var familyParts = rawFamily.split(",");

    var w = parseFloat(weight);
    if (!isFinite(w)) {
      var wRaw = String(weight || "").toLowerCase();
      if (wRaw === "bold" || wRaw === "bolder") w = 700;
      else if (wRaw === "lighter") w = 300;
      else w = 400;
    }
    var isItalic = /italic|oblique/i.test(String(style || ""));

    var names = [];
    function pushUnique(list, value) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] === value) return;
      }
      list.push(value);
    }
    function addWeightNameCandidates(list, baseName, weightName) {
      if (!baseName) return;
      var baseNoSpaces = baseName.replace(/\s+/g, "");
      if (isItalic) {
        pushUnique(list, baseName + "-" + weightName + "Italic");
        pushUnique(list, baseName + "-" + weightName + " Italic");
        pushUnique(list, baseNoSpaces + "-" + weightName + "Italic");
      }
      pushUnique(list, baseName + "-" + weightName);
      pushUnique(list, baseName + " " + weightName);
      pushUnique(list, baseNoSpaces + "-" + weightName);
    }

    var weightNames = [];
    if (w >= 900) weightNames = ["Black", "Heavy"];
    else if (w >= 800) weightNames = ["ExtraBold", "UltraBold"];
    else if (w >= 700) weightNames = ["Bold"];
    else if (w >= 600) weightNames = ["SemiBold", "DemiBold"];
    else if (w >= 500) weightNames = ["Medium"];
    else weightNames = ["Regular", "Book", "Normal"];

    for (var f = 0; f < familyParts.length; f++) {
      var base = trim(String(familyParts[f]).replace(/['"]/g, ""));
      if (!base) continue;

      for (var i = 0; i < weightNames.length; i++) {
        addWeightNameCandidates(names, base, weightNames[i]);
      }

      // Try regular weight before falling back to the base family name.
      addWeightNameCandidates(names, base, "Regular");
      addWeightNameCandidates(names, base, "Book");
      addWeightNameCandidates(names, base, "Normal");

      // fallback
      pushUnique(names, base);
      pushUnique(names, base.replace(/\s+/g, ""));
    }

    return names;
  }
  function clampFontSize(sizePx) {
    var size = Number(sizePx);
    if (!isFinite(size)) return null;
    if (size < 0.1) return 0.1;
    if (size > 1296) return 1296;
    return size;
  }

  function applyTextTransform(text, transform) {
    if (!text) return "";
    if (!transform || transform === "none") return text;

    transform = String(transform).toLowerCase();

    if (transform === "uppercase") return text.toUpperCase();
    if (transform === "lowercase") return text.toLowerCase();

    if (transform === "capitalize") {
      // Capitalize first letter after start or after whitespace/punctuation
      // (ES3-safe: no lookbehind, no unicode classes)
      var out = "";
      var makeUpper = true;

      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);

        // treat separators as "word break"
        if (
          ch === " " ||
          ch === "\t" ||
          ch === "\n" ||
          ch === "\r" ||
          ch === "-" ||
          ch === "_" ||
          ch === "." ||
          ch === "," ||
          ch === ":" ||
          ch === ";" ||
          ch === "!" ||
          ch === "?" ||
          ch === "/" ||
          ch === "\\" ||
          ch === "(" ||
          ch === ")" ||
          ch === "[" ||
          ch === "]" ||
          ch === "{" ||
          ch === "}" ||
          ch === '"' ||
          ch === "'"
        ) {
          out += ch;
          makeUpper = true;
        } else {
          out += makeUpper ? ch.toUpperCase() : ch.toLowerCase();
          makeUpper = false;
        }
      }
      return out;
    }

    return text;
  }

  function addLineSelector(selectors, lineIndex) {
    var selector = selectors.addProperty("ADBE Text Selector");
    var advanced = selector.property("ADBE Text Range Advanced");
    if (advanced) {
      advanced.property("ADBE Text Range Units").setValue(2);
      advanced.property("ADBE Text Range Type2").setValue(4);
    }
    selector.property("ADBE Text Index Start").setValue(lineIndex);
    selector.property("ADBE Text Index End").setValue(lineIndex + 1);
  }

  function addLineStyleAnimators(layer, node) {
    if (!node || !node.lineRanges || node.lineRanges.length <= 1) return;

    var currentCompName = layer && layer.containingComp ? layer.containingComp.name : null;
    var ranges = node.lineRanges;
    var hasColor = false;
    var hasOpacity = false;
    var hasWeight = false;
    var hasStyle = false;
    var hasX = false;
    var align = node.font && node.font.textAlign ? String(node.font.textAlign).toLowerCase() : "";
    var writingMode = node.font && node.font.writingMode ? String(node.font.writingMode) : "";
    var isVerticalText = writingMode.toLowerCase().indexOf("vertical") === 0;
    var isRightAlign = align === "right" || align === "end";
    var ignoreX = align === "center" || align === "centre" || isVerticalText;

    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (!r || typeof r.lineIndex === "undefined") continue;
      if (r.style) {
        if (typeof r.style.color !== "undefined") hasColor = true;
        if (typeof r.style.opacity !== "undefined") hasOpacity = true;
      }
      if (typeof r.x !== "undefined") hasX = true;
    }

    if (ignoreX) hasX = false;
    if (!hasColor && !hasOpacity && !hasX) return;

    var rangesSorted = ranges.slice(0).sort(function (a, b) {
      return (a.lineIndex || 0) - (b.lineIndex || 0);
    });

    var baseRange = rangesSorted.length ? rangesSorted[0] : null;
    var baseColor = hasColor && baseRange && baseRange.style ? baseRange.style.color : null;
    var baseOpacity = hasOpacity && baseRange && baseRange.style ? Number(baseRange.style.opacity) : 1;
    if (!isFinite(baseOpacity)) baseOpacity = 1;
    if (baseOpacity < 0) baseOpacity = 0;
    if (baseOpacity > 1) baseOpacity = 1;

    var baseWeight = null;
    var baseWeightNum = 400;
    var baseStyle = null;
    var baseStyleNorm = "";

    var baseX = 0;
    var baseXSet = false;
    if (hasX && isRightAlign && node && node.textLines && node.textLines.length) {
      var baseIndex = baseRange && typeof baseRange.lineIndex !== "undefined" ? baseRange.lineIndex : 0;
      var baseLine = node.textLines[baseIndex];
      if (baseLine && isFinite(baseLine.x) && isFinite(baseLine.w)) {
        baseX = Number(baseLine.x) + Number(baseLine.w);
        baseXSet = true;
      }
    }
    if (hasX && !baseXSet && baseRange && typeof baseRange.x !== "undefined" && isFinite(baseRange.x)) {
      baseX = Number(baseRange.x);
      baseXSet = true;
    } else if (hasX && !isRightAlign && node.textLines && node.textLines.length) {
      for (var bx = 0; bx < node.textLines.length; bx++) {
        var bLine = node.textLines[bx];
        if (bLine && isFinite(bLine.x)) {
          baseX = Number(bLine.x);
          baseXSet = true;
          break;
        }
      }
    }

    var baseColorAlpha = baseColor ? parseCssAlpha(baseColor) : 1;
    var baseCombined = baseOpacity * baseColorAlpha;

    var anyDiff = false;
    for (var d = 0; d < rangesSorted.length; d++) {
      var dr = rangesSorted[d];
      if (!dr || typeof dr.lineIndex === "undefined") continue;
      var dColor = hasColor && dr.style ? dr.style.color : baseColor;
      var dOpacity = hasOpacity && dr.style ? Number(dr.style.opacity) : baseOpacity;
      if (!isFinite(dOpacity)) dOpacity = baseOpacity;
      if (dOpacity < 0) dOpacity = 0;
      if (dOpacity > 1) dOpacity = 1;
      var dColorAlpha = dColor ? parseCssAlpha(dColor) : baseColorAlpha;
      var dCombined = dOpacity * dColorAlpha;
      var dWeightNum = baseWeightNum;
      var dStyleNorm = baseStyleNorm;
      var dOffsetX = 0;
      if (hasX && typeof dr.x !== "undefined" && isFinite(dr.x)) {
        if (isRightAlign && node && node.textLines && node.textLines.length > dr.lineIndex) {
          var dLine = node.textLines[dr.lineIndex];
          if (dLine && isFinite(dLine.x) && isFinite(dLine.w)) {
            dOffsetX = Number(dLine.x) + Number(dLine.w) - baseX;
          } else {
            dOffsetX = Number(dr.x) - baseX;
          }
        } else {
          dOffsetX = Number(dr.x) - baseX;
        }
      }

      if (
        (hasColor && dColor && baseColor && dColor !== baseColor) ||
        (hasOpacity && Math.abs(dOpacity - baseOpacity) > 0.001) ||
        (hasColor && Math.abs(dCombined - baseCombined) > 0.001) ||
        (hasX && Math.abs(dOffsetX) > 0.5)
      ) {
        anyDiff = true;
        break;
      }
    }

    if (!anyDiff) return;

    var animators = layer.property("Text").property("Animators");
    var baseAnimator = animators.addProperty("ADBE Text Animator");
    baseAnimator.name = "Base";
    var baseProps = baseAnimator.property("ADBE Text Animator Properties");

    if (hasColor && baseColor) {
      var baseFill = baseProps.addProperty("ADBE Text Fill Color");
      applyCssColorProperty(baseFill, baseColor, currentCompName);
    }
    if (hasOpacity || (hasColor && baseColorAlpha < 1)) {
      var baseFillOpacity = baseProps.addProperty("ADBE Text Fill Opacity");
      if (baseFillOpacity) baseFillOpacity.setValue(Math.round(baseCombined * 100));
    }
    for (var j = 0; j < rangesSorted.length; j++) {
      var range = rangesSorted[j];
      if (!range || typeof range.lineIndex === "undefined") continue;

      var lineColor = hasColor && range.style ? range.style.color : baseColor;
      var lineOpacity = hasOpacity && range.style ? Number(range.style.opacity) : baseOpacity;
      if (!isFinite(lineOpacity)) lineOpacity = baseOpacity;
      if (lineOpacity < 0) lineOpacity = 0;
      if (lineOpacity > 1) lineOpacity = 1;
      var lineColorAlpha = lineColor ? parseCssAlpha(lineColor) : baseColorAlpha;
      var lineCombined = lineOpacity * lineColorAlpha;

      var lineWeightNum = baseWeightNum;
      var lineStyleNorm = baseStyleNorm;

      var offsetX = 0;
      if (hasX && typeof range.x !== "undefined" && isFinite(range.x)) {
        if (isRightAlign && node && node.textLines && node.textLines.length > range.lineIndex) {
          var rLine = node.textLines[range.lineIndex];
          if (rLine && isFinite(rLine.x) && isFinite(rLine.w)) {
            offsetX = Number(rLine.x) + Number(rLine.w) - baseX;
          } else {
            offsetX = Number(range.x) - baseX;
          }
        } else {
          offsetX = Number(range.x) - baseX;
        }
      }

      var colorDiff = hasColor && lineColor && baseColor && lineColor !== baseColor;
      var opacityDiff = hasOpacity && Math.abs(lineOpacity - baseOpacity) > 0.001;
      var combinedDiff = hasColor && Math.abs(lineCombined - baseCombined) > 0.001;
      var xDiff = hasX && Math.abs(offsetX) > 0.5;

      if (!colorDiff && !opacityDiff && !combinedDiff && !xDiff) continue;

      var animator = animators.addProperty("ADBE Text Animator");
      animator.name = "Line " + (range.lineIndex + 1);
      var animatorProps = animator.property("ADBE Text Animator Properties");

      if (colorDiff && lineColor) {
        var fill = animatorProps.addProperty("ADBE Text Fill Color");
        applyCssColorProperty(fill, lineColor, currentCompName);
      }

      if (opacityDiff || combinedDiff) {
        var fillOpacity = animatorProps.addProperty("ADBE Text Fill Opacity");
        if (fillOpacity) fillOpacity.setValue(Math.round(lineCombined * 100));
      }

      if (xDiff) {
        var pos = animatorProps.addProperty("ADBE Text Position 3D");
        if (pos) pos.setValue([offsetX, 0, 0]);
      }

      addLineSelector(animator.property("Selectors"), range.lineIndex);
    }
  }

  function getUniformTextColor(node) {
    if (!node) return { color: null, hasColor: false, isUniform: false, isMultiple: false };
    var color = null;
    var hasColor = false;
    var multiple = false;

    if (node.font && typeof node.font.color !== "undefined") {
      color = String(node.font.color);
      hasColor = true;
    }

    if (node.lineRanges && node.lineRanges.length) {
      for (var i = 0; i < node.lineRanges.length; i++) {
        var range = node.lineRanges[i];
        if (!range || !range.style || typeof range.style.color === "undefined") continue;
        var c = String(range.style.color);
        if (!hasColor) {
          color = c;
          hasColor = true;
        } else if (c !== color) {
          multiple = true;
          break;
        }
      }
    }

    return { color: color, hasColor: hasColor, isUniform: hasColor && !multiple, isMultiple: multiple };
  }

  function pickTextPlacementBBox(node, localBBox, writingMode) {
    var textBBox = getLocalTextBounds(node, localBBox);
    if (!textBBox) return localBBox;
    if (!localBBox) return textBBox;

    // If line bounds exceed the element box (common with large fonts/strokes),
    // align to the element box to preserve CSS positioning.
    var tolX = Math.max(2, localBBox.w * 0.05);
    var tolY = Math.max(2, localBBox.h * 0.05);
    var outside =
      textBBox.x < localBBox.x - tolX ||
      textBBox.y < localBBox.y - tolY ||
      textBBox.x + textBBox.w > localBBox.x + localBBox.w + tolX ||
      textBBox.y + textBBox.h > localBBox.y + localBBox.h + tolY;

    return outside ? localBBox : textBBox;
  }

  function createTextLayer(comp, node, localBBox) {
    // 1. ������ POINT TEXT
    var finalText = applyTextTransform(node.text || "", node.textTransform);

    var layer = comp.layers.addText(finalText);

    var textProp = layer.property("Text").property("Source Text");
    var doc = textProp.value;

    if (doc && doc.resetCharStyle) {
      doc.resetCharStyle();
    }

    // 2. �����
    // 2. ����� (family + weight + style)
    if (node.font && node.font.family) {
      var family = trim(node.font.family.split(",")[0]);
      var weight = node.font.weight;
      var style = node.font.fontStyle || "normal";

      var candidates = buildFontCandidates(family, weight, style);
      $.writeln("AE Text: font candidates for " + family + " weight=" + weight + " style=" + style + " -> " + candidates.join(", "));
      applyFontWithFallback(doc, candidates);
    }

    if (node.font && node.font.sizePx) {
      var clampedSize = clampFontSize(node.font.sizePx);
      if (clampedSize !== null) {
        doc.fontSize = clampedSize;
      }
    }

    if (node.font && typeof node.font.lineHeightPx !== "undefined") {
      var lineHeightPx = Number(node.font.lineHeightPx);
      if (isFinite(lineHeightPx) && lineHeightPx > 0) {
        doc.autoLeading = false;
        doc.leading = lineHeightPx;
      } else {
        doc.autoLeading = true;
      }
    }

    if (node.font && typeof node.font.tracking !== "undefined") {
      doc.tracking = toAETracking(node.font.tracking);
    }

    var colorInfo = getUniformTextColor(node);
    doc.fillColor = [1, 1, 1];
    doc.applyFill = true;
    if (colorInfo.isUniform && colorInfo.hasColor) {
      var uniformAlpha = parseCssAlpha(colorInfo.color);
      if (isTransparentColor(colorInfo.color) || uniformAlpha === 0) {
        doc.applyFill = false;
      }
    }

    if (
      node.font &&
      node.font.strokeWidthPx &&
      Number(node.font.strokeWidthPx) > 0 &&
      node.font.strokeColor &&
      !isTransparentColor(node.font.strokeColor)
    ) {
      doc.applyStroke = true;
      doc.strokeWidth = Number(node.font.strokeWidthPx);
      doc.strokeColor = parseCssColor(node.font.strokeColor);
      doc.strokeOverFill = true;
    }

    doc.justification = mapTextAlign(node.font ? node.font.textAlign : null);

    textProp.setValue(doc);
    try {
      var moreOptions = layer.property("Text").property("More Options");
      if (moreOptions) {
        var anchorAlign = moreOptions.property("ADBE Text Anchor Point Align");
        if (anchorAlign) anchorAlign.setValue([0, -40]);
        var anchorOption = moreOptions.property("ADBE Text Anchor Point Option");
        var splitType = getTextSplitTypeFromMotion(node ? node.motion : null);
        if (anchorOption && splitType) {
          if (splitType === "words") anchorOption.setValue(2);
          else if (splitType === "lines") anchorOption.setValue(3);
          else anchorOption.setValue(1);
        }
      }
    } catch (e) {}

    addLineStyleAnimators(layer, node);

    if (colorInfo.isUniform && colorInfo.hasColor) {
      var fillAlpha = parseCssAlpha(colorInfo.color);
      if (!isTransparentColor(colorInfo.color) && fillAlpha > 0) {
        applyFillEffect(layer, parseCssColor(colorInfo.color), fillAlpha);
      }
    }

    // 3. ������������� ��� TOP-LEFT (HTML-like)
    var writingMode = node.font && node.font.writingMode ? String(node.font.writingMode) : "";
    var placementBBox = pickTextPlacementBBox(node, localBBox, writingMode);
    var textBounds = getLocalTextBounds(node, localBBox);
    var lineHeightPx = null;
    if (node && node.font && isFinite(Number(node.font.lineHeightPx))) {
      lineHeightPx = Number(node.font.lineHeightPx);
    } else if (node && node.textLines && node.textLines.length && isFinite(Number(node.textLines[0].h))) {
      lineHeightPx = Number(node.textLines[0].h);
    }
    placePointTextTopLeft(layer, placementBBox, lineHeightPx, textBounds);

    return layer;
  }

  function getLocalTextBounds(node, localBBox) {
    if (!node || !node.textLines || !node.textLines.length || !localBBox) return null;
    if (!node.bbox) return null;

    var originX = node.bbox.x - localBBox.x;
    var originY = node.bbox.y - localBBox.y;

    var minX = null;
    var minY = null;
    var maxX = null;
    var maxY = null;

    for (var i = 0; i < node.textLines.length; i++) {
      var line = node.textLines[i];
      if (!line || !isFinite(line.w) || !isFinite(line.h)) continue;
      if (line.w <= 0 || line.h <= 0) continue;
      var lx = line.x - originX;
      var ly = line.y - originY;
      var rx = lx + line.w;
      var ry = ly + line.h;
      if (minX === null || lx < minX) minX = lx;
      if (minY === null || ly < minY) minY = ly;
      if (maxX === null || rx > maxX) maxX = rx;
      if (maxY === null || ry > maxY) maxY = ry;
    }

    if (minX === null || minY === null || maxX === null || maxY === null) return null;

    return {
      x: minX,
      y: minY,
      w: Math.max(0, maxX - minX),
      h: Math.max(0, maxY - minY),
    };
  }

  function placePointTextTopLeft(layer, bbox, lineHeightPx, textBounds) {
    var r = layer.sourceRectAtTime(0, false);
    var doc = layer.property("Text").property("Source Text").value;

    var posX = bbox.x;
    var posY = bbox.y;
    var anchorX = r.left;
    var anchorY = r.top;

    var hasTextBounds =
      textBounds &&
      isFinite(textBounds.w) &&
      isFinite(textBounds.x) &&
      textBounds.w > 0;
    var hasInsetX =
      hasTextBounds &&
      isFinite(bbox.x) &&
      textBounds.x > bbox.x + Math.max(0.5, bbox.w * 0.002);
    var hasInsetRight =
      hasTextBounds &&
      isFinite(bbox.x) &&
      isFinite(bbox.w) &&
      textBounds.x + textBounds.w < bbox.x + bbox.w - Math.max(0.5, bbox.w * 0.002);
    var hasInset = hasInsetX || hasInsetRight;
    var textWidthLarger =
      hasTextBounds && isFinite(bbox.w) && textBounds.w > bbox.w + Math.max(2, bbox.w * 0.02);

    if (doc.justification === ParagraphJustification.CENTER_JUSTIFY) {
      posX = textWidthLarger || hasInset ? textBounds.x + textBounds.w / 2 : bbox.x + bbox.w / 2;
      anchorX = r.left + r.width / 2;
    } else if (doc.justification === ParagraphJustification.RIGHT_JUSTIFY) {
      posX = textWidthLarger || hasInset ? textBounds.x + textBounds.w : bbox.x + bbox.w;
      anchorX = r.left + r.width;
    } else if (hasInsetX) {
      posX = textBounds.x;
    }

    if (isFinite(lineHeightPx) && lineHeightPx > 0) {
      var extra = lineHeightPx - r.height;
      if (extra > 0.1) posY += extra / 2;
    }

    layer
      .property("Transform")
      .property("Anchor Point")
      .setValue([anchorX, anchorY]);

    layer.property("Transform").property("Position").setValue([posX, posY]);
  }

  function createImageLayer(comp, node, localBBox) {
    var name = safeName(node.name || "Image");
    var layer = null;
    var placeholderAlpha = null;
    var isPlaceholder = false;

    // If assetType is file, import footage
    if (node.assetType === "file" && node.src) {
      var f = File(node.src);
      if (f.exists) {
        var footage = importFootage(f);
        if (footage) {
          layer = comp.layers.add(footage);
          layer.name = name;

          // Scale footage to fill bbox (cover)
          fitLayerToBox(layer, localBBox, true);
          setLayerPositionByBox(layer, localBBox);
          return { layer: layer, placeholderAlpha: null, isPlaceholder: false };
        }
      }
    }

    // Otherwise: placeholder solid
    isPlaceholder = true;
    var placeholderColor = [0.15, 0.15, 0.15];
    if (node && node.style && node.style.backgroundColor && !isTransparentColor(node.style.backgroundColor)) {
      placeholderColor = parseCssColor(node.style.backgroundColor);
      placeholderAlpha = parseCssAlpha(node.style.backgroundColor);
    }
    layer = comp.layers.addSolid(
      placeholderColor,
      name,
      Math.max(1, Math.round(localBBox.w)),
      Math.max(1, Math.round(localBBox.h)),
      1
    );
    setLayerTransform(layer, localBBox);

    // Comment writes disabled by request.

    return { layer: layer, placeholderAlpha: placeholderAlpha, isPlaceholder: isPlaceholder };
  }

