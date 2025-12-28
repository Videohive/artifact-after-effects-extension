  // ============================================================
  // CORE
  // ============================================================

  function createSlideComp(data, parentFolder) {
    var w = Math.round(data.viewport.width);
    var h = Math.round(data.viewport.height);
    var settings = data && data.settings ? data.settings : null;
    var dur = pickNumber([data.duration, settings && settings.duration], CFG.defaultDuration);
    var fps = pickNumber([data.fps, settings && settings.fps], CFG.defaultFPS);

    var slideName = safeName(data.artifactId || data.slideId || "slide");

    // ?? ������ ����� � ������ slideId
    SLIDE_FOLDER = app.project.items.addFolder(slideName);
    if (parentFolder) {
      SLIDE_FOLDER.parentFolder = parentFolder;
    }

    // ?? root-����������
    var comp = app.project.items.addComp(slideName, w, h, 1, dur, fps);

    comp.bgColor = [0, 0, 0];

    // ?? ����� root-���� � �����
    comp.parentFolder = SLIDE_FOLDER;

    // ��������� ������
    ROOT_COMP = comp;

    return comp;
  }

  function createTimelineComp(slideComps, parentFolder) {
    var first = slideComps[0];
    var totalDur = 0;
    for (var i = 0; i < slideComps.length; i++) {
      totalDur += slideComps[i].duration;
    }

    var comp = app.project.items.addComp(
      "Timeline",
      first.width,
      first.height,
      1,
      totalDur,
      first.frameRate
    );

    if (parentFolder) {
      comp.parentFolder = parentFolder;
    }

    var t = 0;
    for (var j = 0; j < slideComps.length; j++) {
      var slideComp = slideComps[j];
      var layer = comp.layers.add(slideComp);
      layer.startTime = t;
      layer.inPoint = t;
      layer.outPoint = t + slideComp.duration;
      t += slideComp.duration;
    }

    return comp;
  }

  /**
   * Recursively builds layers into comp from node.
   * @param {Object} node
   * @param {CompItem} comp
   * @param {AVLayer|null} parentLayer
   * @param {{x:number,y:number}} origin Global slide origin offset for this comp
   * @param {Object} rootData entire json (for debugging/metadata if needed)
   */
  function buildNode(node, comp, parentLayer, origin, rootData, parentStyle) {
    if (!node || (node.renderHints && node.renderHints.isHidden)) return null;

    var isRoot = node === rootData.root;

    var wantsPrecomp =
      (node.renderHints && node.renderHints.needsPrecomp === true) ||
      (node.clip && node.clip.enabled === true);
    var allowRootPrecomp = false;
    if (isRoot && wantsPrecomp && node.bbox) {
      var rootW = Math.round(node.bbox.w);
      var rootH = Math.round(node.bbox.h);
      allowRootPrecomp = rootW < comp.width || rootH < comp.height;
    }
    var needsPrecomp = (!isRoot || allowRootPrecomp) && wantsPrecomp;

    // ----------------------------
    // ROOT BACKGROUND
    // ----------------------------
    if (isRoot && CFG.createBackgroundFromRoot) {
      var bgColor = node.style ? getEffectiveBackgroundColor(node.style) : null;
      var fillsComp =
        node.bbox &&
        Math.round(node.bbox.w) >= comp.width &&
        Math.round(node.bbox.h) >= comp.height;
      if (bgColor && fillsComp && !needsPrecomp) {
        createSolidBackground(comp, bgColor, comp.width, comp.height, "Background");
      }
    }

    var layer = null;

    // ============================================================
    // GROUP
    // ============================================================
    if (node.type === "group") {
      // ========================================
      // GROUP > PRECOMP (����� COMP)
      // ========================================
      if (needsPrecomp) {
        // 1. ������ precomp layer � PARENT comp
        var preBBox = getLocalBBox(node, origin);
        layer = createPrecompLayer(node, comp, preBBox, rootData);

        // 2. ��������� ����� � precomp layer
        applyOpacity(layer, node.style);
        applyBlendMode(layer, node.style);
        applyTransform(layer, node.style, preBBox);
        applyDropShadow(layer, node.style);

        // 3. parent (���� ����)
        if (parentLayer) layer.parent = parentLayer;

        // 4. ������ PRECOMP
        var childComp = layer.source;

        // ?? ����� ������� ���������
        var childOrigin = {
          x: node.bbox.x,
          y: node.bbox.y,
        };

        // 5. ��� ������ (���� ����)
        if (CFG.makeShapeForGroupsWithBg && node.style && hasEffectiveBackground(node.style)) {
          var bgShape = createRectShape(childComp, node, {
            x: 0,
            y: 0,
            w: childComp.width,
            h: childComp.height,
          });
          if (bgShape) bgShape.moveToEnd();
        }
        if (hasBorder(node.border)) {
          var borderShape = createBorderShape(childComp, node, {
            x: 0,
            y: 0,
            w: childComp.width,
            h: childComp.height,
          });
        }
        // 6. ����
        if (node.children && node.children.length) {
          var orderedChildren = orderChildrenByZIndex(node.children);
          for (var i = 0; i < orderedChildren.length; i++) {
            buildNode(orderedChildren[i], childComp, null, childOrigin, rootData, node.style);
          }
        }

        // 7. clip shape - � ��� �� COMP, ��� � PRECOMP LAYER
        if (node.clip && node.clip.enabled) {
          var clipLayer = createClipShapeLayer(comp, node, preBBox, node.clip, parentLayer, layer);
          applyTransform(clipLayer, node.style, preBBox);
        }

        return layer;
      }

      // ========================================
      // GROUP > ��� PRECOMP (���������� ���������)
      // ========================================

      // ? origin �� ��������

      // ��� ������ (���� ����)
      var bgShape = null;
      if (CFG.makeShapeForGroupsWithBg && node.style && hasEffectiveBackground(node.style)) {
        var bgBBox = getLocalBBox(node, origin);
        bgShape = createRectShape(comp, node, bgBBox);
        // Background is created before children, so it will already sit below them.
        if (parentLayer) bgShape.parent = parentLayer;
        applyDropShadow(bgShape, node.style);
      }

      if (hasBorder(node.border)) {
        var borderBBox = getLocalBBox(node, origin);
        var borderShape = createBorderShape(comp, node, borderBBox);
        if (borderShape && parentLayer) borderShape.parent = parentLayer;
        if (!bgShape) applyDropShadow(borderShape, node.style);
      }
      // ����
      if (node.children && node.children.length) {
        var orderedGroupChildren = orderChildrenByZIndex(node.children);
        for (var j = 0; j < orderedGroupChildren.length; j++) {
          buildNode(orderedGroupChildren[j], comp, parentLayer, origin, rootData, node.style);
        }
      }

      return null;
    }

    // ============================================================
    // TEXT
    // ============================================================
    if (node.type === "text") {
      var textBBox = getLocalBBox(node, origin);
      layer = createTextLayer(comp, node, textBBox);
      if (parentLayer) layer.parent = parentLayer;
      var fillAlpha = parseCssAlpha(node.font ? node.font.color : null);
      var strokeAlpha = node.font && node.font.strokeColor ? parseCssAlpha(node.font.strokeColor) : 0;
      var textAlpha = fillAlpha;
      if (fillAlpha === 0 && strokeAlpha > 0) textAlpha = strokeAlpha;
      applyOpacity(layer, node.style, textAlpha);
      applyBlendMode(layer, node.style);
      applyTransform(layer, node.style, textBBox);
      applyDropShadow(layer, node.style);
      if (hasBorder(node.border)) {
        var borderShape = createBorderShape(comp, node, textBBox);
        if (borderShape) {
          if (parentLayer) borderShape.parent = parentLayer;
          applyOpacity(borderShape, node.style);
          applyBlendMode(borderShape, node.style);
          applyTransform(borderShape, node.style, textBBox);
          borderShape.moveAfter(layer);
        }
      }
      if (node.clip && node.clip.enabled) {
        var clipLayer = createClipShapeLayer(comp, node, textBBox, node.clip, parentLayer, layer);
        applyTransform(clipLayer, node.style, textBBox);
      }
      return layer;
    }

    // ============================================================
    // IMAGE
    // ============================================================
    if (node.type === "image") {
      var imgBBox = getLocalBBox(node, origin);
      var imgResult = createImageLayer(comp, node, imgBBox);
      var placeholderAlpha =
        imgResult && typeof imgResult.placeholderAlpha !== "undefined"
          ? imgResult.placeholderAlpha
          : null;
      layer = imgResult && imgResult.layer ? imgResult.layer : imgResult;
      if (parentLayer) layer.parent = parentLayer;
      applyOpacity(layer, node.style, placeholderAlpha);
      applyBlendMode(layer, node.style);
      applyTransform(layer, node.style, imgBBox);
      applyDropShadow(layer, node.style);
      if (
        imgResult &&
        imgResult.isPlaceholder &&
        (!node.style || !node.style.boxShadow || !node.style.boxShadow.length) &&
        parentStyle &&
        parentStyle.boxShadow &&
        parentStyle.boxShadow.length
      ) {
        applyDropShadow(layer, parentStyle);
      }
      if (hasBorder(node.border)) {
        var borderShape = createBorderShape(comp, node, imgBBox);
        if (borderShape) {
          if (parentLayer) borderShape.parent = parentLayer;
          applyOpacity(borderShape, node.style);
          applyBlendMode(borderShape, node.style);
          applyTransform(borderShape, node.style, imgBBox);
          borderShape.moveAfter(layer);
        }
      }
      if (node.clip && node.clip.enabled) {
        var clipLayer = createClipShapeLayer(comp, node, imgBBox, node.clip, parentLayer, layer);
        applyTransform(clipLayer, node.style, imgBBox);
      }
      return layer;
    }

    // ============================================================
    // SVG -> SHAPE LAYER
    // ============================================================
    if (node.type === "svg") {
      var svgBBox = getLocalBBox(node, origin);
      layer = createSvgShapeLayer(comp, node, svgBBox, rootData);
      if (parentLayer) layer.parent = parentLayer;
      applyOpacity(layer, node.style);
      applyBlendMode(layer, node.style);
      applyTransform(layer, node.style, svgBBox);
      applyDropShadow(layer, node.style);
      return layer;
    }
    // ============================================================
    // FALLBACK: ������ ������ �����
    // ============================================================
    if (node.children && node.children.length) {
      var orderedFallbackChildren = orderChildrenByZIndex(node.children);
      for (var k = 0; k < orderedFallbackChildren.length; k++) {
        buildNode(orderedFallbackChildren[k], comp, parentLayer, origin, rootData, parentStyle);
      }
    }

    return null;
  }

