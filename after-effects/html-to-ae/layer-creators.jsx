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

    // Optional labeling
    if (CFG.labelPrecomps) {
      precomp.comment =
        "Created from JSON node: " +
        (node.name || "") +
        " (" +
        (rootData.artifactId || rootData.slideId || "") +
        ")";
    }

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
    var fillColor = getEffectiveBackgroundColor(node.style);
    applyCssColorProperty(fill.property("Color"), fillColor, comp.name);

    // Position: shapes have their own Transform inside group; easiest: layer position to bbox center
    setLayerTransform(layer, localBBox);
    applyOpacity(layer, null, parseCssAlpha(fillColor));

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

    if (border.isUniform && isVisibleBorderSide(border.sides ? border.sides.top : null)) {
      var strokeWidth = Number(border.widthPx) || 0;
      var inset = strokeWidth > 0 ? strokeWidth : 0;
      var innerW = Math.max(0, localBBox.w - inset);
      var innerH = Math.max(0, localBBox.h - inset);

      var grp = contents.addProperty("ADBE Vector Group");
      grp.name = "Border";

      var grpContents = grp.property("Contents");
      var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
      rect.property("Size").setValue([innerW, innerH]);
      if (border.radiusPx && border.radiusPx > 0)
        rect.property("Roundness").setValue(
          clampRoundnessValue(Math.max(0, border.radiusPx - inset / 2), innerW, innerH)
        );

      var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
      applyCssColorProperty(stroke.property("Color"), border.color, comp.name);
      stroke.property("Stroke Width").setValue(strokeWidth);
      var opacityProp = stroke.property("ADBE Vector Stroke Opacity");
      if (opacityProp) opacityProp.setValue(Math.round(parseCssAlpha(border.color) * 100));

      var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
      fill.enabled = false

      setLayerTransform(layer, localBBox);
      return layer;
    }

    var sides = border.sides || {};

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
    if (hasX && baseRange && typeof baseRange.x !== "undefined" && isFinite(baseRange.x)) {
      baseX = Number(baseRange.x);
    } else if (hasX && node.textLines && node.textLines.length) {
      for (var bx = 0; bx < node.textLines.length; bx++) {
        var bLine = node.textLines[bx];
        if (bLine && isFinite(bLine.x)) {
          baseX = Number(bLine.x);
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
        dOffsetX = Number(dr.x) - baseX;
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
        offsetX = Number(range.x) - baseX;
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
    var textWidthLarger =
      hasTextBounds && isFinite(bbox.w) && textBounds.w > bbox.w + Math.max(2, bbox.w * 0.02);

    if (doc.justification === ParagraphJustification.CENTER_JUSTIFY) {
      posX = textWidthLarger ? textBounds.x + textBounds.w / 2 : bbox.x + bbox.w / 2;
      anchorX = r.left + r.width / 2;
    } else if (doc.justification === ParagraphJustification.RIGHT_JUSTIFY) {
      posX = textWidthLarger ? textBounds.x + textBounds.w : bbox.x + bbox.w;
      anchorX = r.left + r.width;
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

    // Store URL/path in Comment
    if (node.src) layer.comment = "SRC: " + node.src;

    return { layer: layer, placeholderAlpha: placeholderAlpha, isPlaceholder: isPlaceholder };
  }

