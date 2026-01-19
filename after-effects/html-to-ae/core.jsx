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

  function getBorderSideWidth(border, sideKey) {
    if (!border) return 0;
    if (border.sides && border.sides[sideKey]) {
      var sw = Number(border.sides[sideKey].widthPx) || 0;
      return sw > 0 ? sw : 0;
    }
    return Number(border.widthPx) || 0;
  }

  function getBorderPadding(border) {
    if (!border) return { top: 0, right: 0, bottom: 0, left: 0 };
    var topW = getBorderSideWidth(border, "top") / 2;
    var rightW = getBorderSideWidth(border, "right") / 2;
    var bottomW = getBorderSideWidth(border, "bottom") / 2;
    var leftW = getBorderSideWidth(border, "left") / 2;
    return {
      top: Math.max(0, topW),
      right: Math.max(0, rightW),
      bottom: Math.max(0, bottomW),
      left: Math.max(0, leftW),
    };
  }

  function getShadowPadding(style) {
    var pad = { top: 0, right: 0, bottom: 0, left: 0 };
    if (!style || !style.boxShadow || !style.boxShadow.length) return pad;
    for (var i = 0; i < style.boxShadow.length; i++) {
      var sh = style.boxShadow[i];
      if (!sh || sh.inset) continue;
      var dx = Number(sh.offsetX) || 0;
      var dy = Number(sh.offsetY) || 0;
      var blur = Number(sh.blurRadius) || 0;
      var spread = Number(sh.spreadRadius) || 0;
      var extent = Math.max(0, blur + spread);
      var left = extent + Math.max(0, -dx);
      var right = extent + Math.max(0, dx);
      var top = extent + Math.max(0, -dy);
      var bottom = extent + Math.max(0, dy);
      if (left > pad.left) pad.left = left;
      if (right > pad.right) pad.right = right;
      if (top > pad.top) pad.top = top;
      if (bottom > pad.bottom) pad.bottom = bottom;
    }
    return pad;
  }

  function getDecorationPadding(node) {
    var borderPad = getBorderPadding(node && node.border ? node.border : null);
    var outlinePad = getBorderPadding(node && node.outline ? node.outline : null);
    return {
      top: borderPad.top + outlinePad.top,
      right: borderPad.right + outlinePad.right,
      bottom: borderPad.bottom + outlinePad.bottom,
      left: borderPad.left + outlinePad.left,
    };
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

  function compHasDirectText(comp) {
    if (!comp || !comp.layers) return false;
    for (var i = 1; i <= comp.layers.length; i++) {
      var layer = comp.layers[i];
      if (!layer) continue;
      try {
        if (layer.property("Text")) return true;
      } catch (e) {}
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
        var pad = getDecorationPadding(node);
        var hasPad =
          pad &&
          (pad.top > 0.001 || pad.right > 0.001 || pad.bottom > 0.001 || pad.left > 0.001);
        var preBBoxExpanded = hasPad
          ? {
              x: preBBox.x - pad.left,
              y: preBBox.y - pad.top,
              w: preBBox.w + pad.left + pad.right,
              h: preBBox.h + pad.top + pad.bottom,
            }
          : preBBox;
        layer = createPrecompLayer(node, comp, preBBoxExpanded, rootData);

        // 2. ��������� ����� � precomp layer
        applyOpacity(layer, node.style);
        applyBlendMode(layer, node.style);
        var styleForTransform = node.style || {};
        if (hasPad && typeof resolveTransformOrigin === "function") {
          var originOffset = resolveTransformOrigin(styleForTransform, preBBox);
          if (styleForTransform === node.style) {
            var cloned = {};
            for (var key in styleForTransform) cloned[key] = styleForTransform[key];
            styleForTransform = cloned;
          }
          if (originOffset) {
            styleForTransform.transformOrigin =
              Math.round(originOffset.x + pad.left) + "px " + Math.round(originOffset.y + pad.top) + "px";
          }
        }
        applyTransform(layer, styleForTransform, preBBoxExpanded, null);
        applyDropShadow(layer, node.style);
        applyMotion(layer, node, preBBox);

        // 3. parent (���� ����)
        if (parentLayer) layer.parent = parentLayer;

        // 4. ������ PRECOMP
        var childComp = layer.source;

        // ?? ����� ������� ���������
        var childOrigin = {
          x: node.bbox.x - (hasPad ? pad.left : 0),
          y: node.bbox.y - (hasPad ? pad.top : 0),
        };

        var contentBBox = {
          x: hasPad ? pad.left : 0,
          y: hasPad ? pad.top : 0,
          w: preBBox.w,
          h: preBBox.h,
        };

        // 5. ��� ������ (���� ����)
        if (CFG.makeShapeForGroupsWithBg && node.style && hasEffectiveBackground(node.style)) {
          var bgShape = createRectShape(childComp, node, contentBBox);
          if (bgShape) bgShape.moveToEnd();
        }
        if (node.style && node.style.backgroundGrid) {
          createGridLayer(childComp, node, contentBBox);
        }
        if (hasBorder(node.border)) {
          var borderShape = createBorderShape(childComp, node, contentBBox);
        }
        // 6. ����
        if (node.children && node.children.length) {
          var orderedChildren = orderChildrenByZIndex(node.children);
          var nestedOffset = layer && isFinite(layer.startTime) ? layer.startTime : 0;
          withCompTimeOffset(getCompTimeOffset() + nestedOffset, function () {
            for (var i = 0; i < orderedChildren.length; i++) {
              buildNode(orderedChildren[i], childComp, null, childOrigin, rootData, node.style);
            }
          });
        }

        if (typeof compHasDirectText === "function" && compHasDirectText(childComp)) {
          layer.collapseTransformation = true;
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
      var nestedSvgOffset = layer && isFinite(layer.startTime) ? layer.startTime : 0;
      withCompTimeOffset(getCompTimeOffset() + nestedSvgOffset, function () {
        createSvgShapeLayers(childComp, node, childBBox, rootData);
        if (node.children && node.children.length) {
          var svgChildOrigin = {
            x: node.bbox.x,
            y: node.bbox.y,
          };
          for (var sc = 0; sc < node.children.length; sc++) {
            buildNode(node.children[sc], childComp, null, svgChildOrigin, rootData, node.style);
          }
        }
      });
      if (typeof compHasDirectText === "function" && compHasDirectText(childComp)) {
        layer.collapseTransformation = true;
      }
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


