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
    setControlsCompName(comp.name);

    if (data && data.pallete && data.pallete.length) {
      createPaletteAdjustmentLayer(comp, data.pallete);
    }

    return comp;
  }

  function createTimelineComp(slideComps, parentFolder, slideHasText) {
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
      if (slideHasText && slideHasText[j]) {
        layer.collapseTransformation = true;
      }
      layer.startTime = t;
      layer.inPoint = t;
      layer.outPoint = t + slideComp.duration;
      t += slideComp.duration;
    }

    return comp;
  }

  function nodeContainsText(node) {
    if (!node) return false;
    if (node.type === "text") return true;
    if (node.type === "svg") {
      if (node.svgData && node.svgData.textElements && node.svgData.textElements.length) return true;
      var content = String(node.content || "");
      if (/<text\b/i.test(content)) return true;
    }
    if (node.children && node.children.length) {
      for (var i = 0; i < node.children.length; i++) {
        if (nodeContainsText(node.children[i])) return true;
      }
    }
    return false;
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
    if (isRoot && wantsPrecomp) {
      var hasRootMotion = node.motion && node.motion.length;
      var hasRootClip = node.clip && node.clip.enabled;
      if (hasRootMotion || hasRootClip) allowRootPrecomp = true;
    }
    var needsPrecomp = (!isRoot || allowRootPrecomp) && wantsPrecomp;

    // ----------------------------
    // ROOT BACKGROUND
    // ----------------------------
    if (isRoot && CFG.createBackgroundFromRoot && !(node.style && node.style.backgroundGrid)) {
      var bgColor = node.style ? getEffectiveBackgroundColor(node.style) : null;
      var bgGradients = node.style ? getBackgroundGradients(node.style) : [];
      var bgGradient = bgGradients.length ? bgGradients[0] : null;
      if (!bgColor && bgGradient) {
        bgColor = pickGradientBaseColor(bgGradient);
      }
      var fillsComp =
        node.bbox &&
        Math.round(node.bbox.w) >= comp.width &&
        Math.round(node.bbox.h) >= comp.height;
      if ((bgColor || bgGradient) && fillsComp && !needsPrecomp) {
        var bgLayer = createSolidBackground(comp, bgColor || "rgb(0, 0, 0)", comp.width, comp.height, "Background");
        if (bgLayer && bgGradient) {
          applyBackgroundGradients(bgLayer, node.style, { x: 0, y: 0, w: comp.width, h: comp.height });
        }
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
        applyTransform(layer, node.style, preBBox, null);
        applyDropShadow(layer, node.style);
        applyMotion(layer, node, preBBox);

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
        if (node.style && node.style.backgroundGrid) {
          createGridLayer(childComp, node, {
            x: 0,
            y: 0,
            w: childComp.width,
            h: childComp.height,
          });
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
          applyTransform(clipLayer, node.style, preBBox, null);
          applyMotion(clipLayer, node, preBBox);
          applyClipPathMotion(clipLayer, node, preBBox);
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
        applyOpacity(bgShape, node.style);
        applyBlendMode(bgShape, node.style);
        applyTransform(bgShape, node.style, bgBBox, null);
        applyMotion(bgShape, node, bgBBox);
      }
      if (node.style && node.style.backgroundGrid) {
        var gridBBox = getLocalBBox(node, origin);
        var gridLayer = createGridLayer(comp, node, gridBBox);
        if (gridLayer && parentLayer) gridLayer.parent = parentLayer;
      }

      if (hasBorder(node.border)) {
        var borderBBox = getLocalBBox(node, origin);
        var borderShape = createBorderShape(comp, node, borderBBox);
        if (borderShape && parentLayer) borderShape.parent = parentLayer;
        if (!bgShape) applyDropShadow(borderShape, node.style);
        if (!bgShape) {
          applyOpacity(borderShape, node.style);
          applyBlendMode(borderShape, node.style);
          applyTransform(borderShape, node.style, borderBBox, null);
          applyMotion(borderShape, node, borderBBox);
        }
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
      applyTransform(layer, node.style, textBBox, node.font ? node.font.writingMode : null);
      applyDropShadow(layer, node.style);
      applyMotion(layer, node, textBBox);
      if (hasBorder(node.border)) {
        var borderShape = createBorderShape(comp, node, textBBox);
        if (borderShape) {
          if (parentLayer) borderShape.parent = parentLayer;
          applyOpacity(borderShape, node.style);
          applyBlendMode(borderShape, node.style);
          applyTransform(borderShape, node.style, textBBox, null);
          borderShape.moveAfter(layer);
        }
      }
      if (node.clip && node.clip.enabled) {
        var clipLayer = createClipShapeLayer(comp, node, textBBox, node.clip, parentLayer, layer);
        applyTransform(clipLayer, node.style, textBBox, null);
        applyMotion(clipLayer, node, textBBox);
        applyClipPathMotion(clipLayer, node, textBBox);
      }
      return layer;
    }

    // ============================================================
    // IMAGE / VIDEO
    // ============================================================
    if (node.type === "image" || node.type === "video") {
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
      applyTransform(layer, node.style, imgBBox, null);
      applyDropShadow(layer, node.style);
      applyMotion(layer, node, imgBBox);
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
          applyTransform(borderShape, node.style, imgBBox, null);
          borderShape.moveAfter(layer);
        }
      }
      if (node.clip && node.clip.enabled) {
        var clipLayer = createClipShapeLayer(comp, node, imgBBox, node.clip, parentLayer, layer);
        applyTransform(clipLayer, node.style, imgBBox, null);
        applyMotion(clipLayer, node, imgBBox);
        applyClipPathMotion(clipLayer, node, imgBBox);
      }
      return layer;
    }

    // ============================================================
    // SVG -> SHAPE LAYER
    // ============================================================
    if (node.type === "svg") {
      var svgBBox = getLocalBBox(node, origin);
      layer = createPrecompLayer(node, comp, svgBBox, rootData);
      if (parentLayer) layer.parent = parentLayer;
      applyOpacity(layer, node.style);
      applyBlendMode(layer, node.style);
      applyTransform(layer, node.style, svgBBox, null);
      applyDropShadow(layer, node.style);
      if (node.motion && node.motion.length) {
        var svgMotion = [];
        for (var m = 0; m < node.motion.length; m++) {
          var entry = node.motion[m];
          if (!entry || !entry.targets || !entry.targets.length) continue;
          for (var t = 0; t < entry.targets.length; t++) {
            var key = String(entry.targets[t] || "").replace(/^\s+|\s+$/g, "");
            if (key.indexOf("#") === 0) key = key.substring(1);
            if (key === node.name || safeName(key) === layer.name) {
              svgMotion.push(entry);
              break;
            }
          }
        }
        if (svgMotion.length) {
          applyMotion(layer, { motion: svgMotion }, svgBBox);
        }
      }

      var childComp = layer.source;
      var childBBox = {
        x: 0,
        y: 0,
        w: childComp.width,
        h: childComp.height,
      };
      createSvgShapeLayers(childComp, node, childBBox, rootData);
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


