  // ============================================================
  // LAYER CREATORS
  // ============================================================

  function createSolidBackground(comp, cssColor, w, h, name) {
    var rgb = parseCssColor(cssColor);
    var solid = comp.layers.addSolid(
      rgb,
      safeName(name || "Background"),
      w,
      h,
      1
    );
    solid
      .property("Transform")
      .property("Position")
      .setValue([w / 2, h / 2]);
    applyOpacity(solid, null, parseCssAlpha(cssColor));
    return solid;
  }

  function createPrecompLayer(node, parentComp, localBBox, rootData) {
    var preName = safeName(node.name || "Precomp");
    var w = Math.max(1, Math.round(localBBox.w));
    var h = Math.max(1, Math.round(localBBox.h));

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
        (rootData.slideId || "") +
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
    fill.property("Color").setValue(parseCssColor(node.style.backgroundColor));

    // Position: shapes have their own Transform inside group; easiest: layer position to bbox center
    setLayerTransform(layer, localBBox);
    applyOpacity(layer, null, parseCssAlpha(node.style.backgroundColor));

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
      var grp = contents.addProperty("ADBE Vector Group");
      grp.name = "Border";

      var grpContents = grp.property("Contents");
      var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
      rect.property("Size").setValue([localBBox.w, localBBox.h]);
      if (border.radiusPx && border.radiusPx > 0)
        rect.property("Roundness").setValue(
          clampRoundnessValue(border.radiusPx, localBBox.w, localBBox.h)
        );

      var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("Color").setValue(parseCssColor(border.color));
      stroke.property("Stroke Width").setValue(border.widthPx);
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
      stroke.property("Color").setValue(parseCssColor(side.color));
      stroke.property("Stroke Width").setValue(side.widthPx);
      var opacityProp = stroke.property("ADBE Vector Stroke Opacity");
      if (opacityProp) opacityProp.setValue(Math.round(parseCssAlpha(side.color) * 100));

      var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
      fill.enabled = false
    }

    addSide("Top", 0, 0, localBBox.w, 0, sides.top);
    addSide("Right", localBBox.w, 0, localBBox.w, localBBox.h, sides.right);
    addSide("Bottom", 0, localBBox.h, localBBox.w, localBBox.h, sides.bottom);
    addSide("Left", 0, 0, 0, localBBox.h, sides.left);

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
    var base = trim(family.replace(/['"]/g, ""));
    var baseNoSpaces = base.replace(/\s+/g, "");

    var w = Number(weight) || 400;
    var isItalic = style === "italic";

    var names = [];

    // ���������������� ��������
    var weightNames = [];

    if (w >= 900) weightNames = ["Black", "Heavy"];
    else if (w >= 800) weightNames = ["ExtraBold", "UltraBold"];
    else if (w >= 700) weightNames = ["Bold"];
    else if (w >= 600) weightNames = ["SemiBold", "DemiBold"];
    else if (w >= 500) weightNames = ["Medium"];
    else weightNames = ["Regular", "Book", "Normal"];

    for (var i = 0; i < weightNames.length; i++) {
      if (isItalic) {
        names.push(base + "-" + weightNames[i] + "Italic");
        names.push(base + "-" + weightNames[i] + " Italic");
        names.push(baseNoSpaces + "-" + weightNames[i] + "Italic");
      }
      names.push(base + "-" + weightNames[i]);
      names.push(base + " " + weightNames[i]);
      names.push(baseNoSpaces + "-" + weightNames[i]);
    }

    // fallback
    names.push(base);
    names.push(baseNoSpaces);

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

  function addLineColorAnimators(layer, node) {
    if (!node || !node.lineRanges || node.lineRanges.length <= 1) return;

    var ranges = node.lineRanges;
    var groups = {};
    var keys = [];

    for (var i = 0; i < ranges.length; i++) {
      var range = ranges[i];
      if (!range || typeof range.lineIndex === "undefined") continue;
      if (!range.style || !range.style.color) continue;

      var rgb = parseCssColor(range.style.color);
      var key = rgb[0] + "," + rgb[1] + "," + rgb[2];

      if (!groups[key]) {
        groups[key] = { rgb: rgb, lineIndices: [] };
        keys.push(key);
      }
      groups[key].lineIndices.push(range.lineIndex);
    }

    if (keys.length <= 1) return;

    var animators = layer.property("Text").property("Animators");

    for (var k = 0; k < keys.length; k++) {
      var group = groups[keys[k]];
      var animator = animators.addProperty("ADBE Text Animator");
      animator.name = "Color " + (k + 1);

      var animatorProps = animator.property("ADBE Text Animator Properties");
      var fill = animatorProps.addProperty("ADBE Text Fill Color");
      fill.setValue(group.rgb);

      var selectors = animator.property("Selectors");
      for (var j = 0; j < group.lineIndices.length; j++) {
        var selector = selectors.addProperty("ADBE Text Selector");
        var advanced = selector.property("ADBE Text Range Advanced");
        if (advanced) {
          advanced.property("ADBE Text Range Units").setValue(2);
          advanced.property("ADBE Text Range Type2").setValue(4);
        }
        selector.property("ADBE Text Index Start").setValue(group.lineIndices[j]);
        if (k === 0) {
          selector.property("ADBE Text Index End").setValue(100);
        } else if (k === keys.length - 1) {
          selector.property("ADBE Text Index End").setValue(group.lineIndices[j] + 1);
        }
      }
    }
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

    if (node.font && node.font.color) {
      doc.applyFill = true;
      doc.fillColor = parseCssColor(node.font.color);
    }

    doc.justification = mapTextAlign(node.font ? node.font.textAlign : null);

    textProp.setValue(doc);

    addLineColorAnimators(layer, node);

    // 3. ������������� ��� TOP-LEFT (HTML-like)
    var textBBox = getLocalTextBounds(node, localBBox);
    placePointTextTopLeft(layer, textBBox || localBBox);

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

  function placePointTextTopLeft(layer, bbox) {
    var r = layer.sourceRectAtTime(0, false);
    var doc = layer.property("Text").property("Source Text").value;

    var posX = bbox.x;
    var anchorX = r.left;

    if (doc.justification === ParagraphJustification.CENTER_JUSTIFY) {
      posX = bbox.x + bbox.w / 2;
      anchorX = r.left + r.width / 2;
    } else if (doc.justification === ParagraphJustification.RIGHT_JUSTIFY) {
      posX = bbox.x + bbox.w;
      anchorX = r.left + r.width;
    }

    layer
      .property("Transform")
      .property("Anchor Point")
      .setValue([anchorX, r.top]);

    layer.property("Transform").property("Position").setValue([posX, bbox.y]);
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

