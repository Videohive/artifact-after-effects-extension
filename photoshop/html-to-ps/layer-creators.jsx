// ============================================================
// LAYER CREATORS
// ============================================================

function createGroup(parent, name) {
  var group = parent.layerSets.add();
  group.name = safeName(name);
  return group;
}

function createArtLayer(parent, name) {
  var layer = parent.artLayers.add();
  layer.name = safeName(name);
  return layer;
}

function getParentDocument(parent) {
  if (!parent) return app.activeDocument;
  if (parent.typename === "Document") return parent;
  if (parent.typename === "LayerSet") {
    return parent.parent ? getParentDocument(parent.parent) : app.activeDocument;
  }
  return app.activeDocument;
}

function moveLayerIntoParent(layer, parent) {
  if (!layer || !parent) return;
  if (parent.typename === "LayerSet") {
    layer.move(parent, ElementPlacement.INSIDE);
  }
}

function moveLayerToBeginning(layer, parent) {
  if (!layer || !parent) return;
  if (parent.typename === "LayerSet") {
    try {
      layer.move(parent, ElementPlacement.PLACEATBEGINNING);
    } catch (e) {}
  }
}

function createRectShapeLayer(parent, bbox, cssColor, name, opacityOverride) {
  var doc = getParentDocument(parent);
  if (doc) app.activeDocument = doc;
  var colorInfo = cssColorToSolidColor(cssColor);
  if (!colorInfo || !colorInfo.color) return null;
  var x = bbox.x;
  var y = bbox.y;
  var w = Math.max(0, bbox.w);
  var h = Math.max(0, bbox.h);
  if (w === 0 || h === 0) return null;

  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putClass(stringIDToTypeID("contentLayer"));
  desc.putReference(charIDToTypeID("null"), ref);

  var descLayer = new ActionDescriptor();
  var descColor = new ActionDescriptor();
  var descColorSpec = new ActionDescriptor();
  descColorSpec.putDouble(charIDToTypeID("Rd  "), colorInfo.color.rgb.red);
  descColorSpec.putDouble(charIDToTypeID("Grn "), colorInfo.color.rgb.green);
  descColorSpec.putDouble(charIDToTypeID("Bl  "), colorInfo.color.rgb.blue);
  descColor.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), descColorSpec);
  descLayer.putObject(charIDToTypeID("Type"), stringIDToTypeID("solidColorLayer"), descColor);

  var descShape = new ActionDescriptor();
  descShape.putUnitDouble(charIDToTypeID("Top "), charIDToTypeID("#Pxl"), y);
  descShape.putUnitDouble(charIDToTypeID("Left"), charIDToTypeID("#Pxl"), x);
  descShape.putUnitDouble(charIDToTypeID("Btom"), charIDToTypeID("#Pxl"), y + h);
  descShape.putUnitDouble(charIDToTypeID("Rght"), charIDToTypeID("#Pxl"), x + w);
  descLayer.putObject(charIDToTypeID("Shp "), charIDToTypeID("Rctn"), descShape);

  desc.putObject(charIDToTypeID("Usng"), stringIDToTypeID("contentLayer"), descLayer);
  executeAction(charIDToTypeID("Mk  "), desc, DialogModes.NO);

  var layer = app.activeDocument.activeLayer;
  if (layer && name) layer.name = safeName(name);
  if (layer) {
    var alpha = typeof opacityOverride === "number" ? opacityOverride : colorInfo.alpha;
    if (alpha < 1) layer.opacity = Math.round(clampOpacity(alpha) * 100);
  }
  if (layer) moveLayerIntoParent(layer, parent);
  return layer;
}

function selectRect(doc, bbox) {
  var x = bbox.x;
  var y = bbox.y;
  var w = Math.max(0, bbox.w);
  var h = Math.max(0, bbox.h);
  if (w === 0 || h === 0) return false;
  var points = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h]
  ];
  doc.selection.select(points);
  return true;
}

function createBorderLayer(parent, bbox, border, name) {
  if (!border || !border.isUniform || !isVisibleBorderSide(border.sides ? border.sides.top : null)) {
    return null;
  }
  var doc = getParentDocument(parent);
  if (!doc) return null;
  app.activeDocument = doc;
  var side = border.sides ? border.sides.top : null;
  var colorInfo = cssColorToSolidColor(side.color);
  if (!colorInfo || !colorInfo.color) return null;
  var widthPx = Number(side.widthPx) || 0;
  if (widthPx <= 0) return null;

  var layer = doc.artLayers.add();
  layer.name = safeName(name || "Border");
  moveLayerIntoParent(layer, parent);

  if (selectRect(doc, bbox)) {
    doc.selection.stroke(colorInfo.color, widthPx, StrokeLocation.INSIDE);
    doc.selection.deselect();
  }

  if (colorInfo.alpha < 1) {
    layer.opacity = Math.round(clampOpacity(colorInfo.alpha) * 100);
  }

  return layer;
}

function getLayerBoundsPx(layer) {
  var b = layer.bounds;
  return {
    left: b[0].as("px"),
    top: b[1].as("px"),
    right: b[2].as("px"),
    bottom: b[3].as("px")
  };
}

function fitLayerToBox(layer, bbox, cover) {
  var bounds = getLayerBoundsPx(layer);
  var w = bounds.right - bounds.left;
  var h = bounds.bottom - bounds.top;
  if (w <= 0 || h <= 0 || bbox.w <= 0 || bbox.h <= 0) return;

  var scaleX = (bbox.w / w) * 100;
  var scaleY = (bbox.h / h) * 100;
  var scale = cover ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  layer.resize(scale, scale, AnchorPosition.MIDDLECENTER);
}

function moveLayerToTopLeft(layer, bbox) {
  var bounds = getLayerBoundsPx(layer);
  var dx = bbox.x - bounds.left;
  var dy = bbox.y - bounds.top;
  layer.translate(dx, dy);
}

function placeImageFromFile(parent, node, bbox) {
  if (!node || node.assetType !== "file" || !node.src) return null;
  var file = new File(node.src);
  if (!file.exists) return null;
  var targetDoc = getParentDocument(parent);
  if (!targetDoc) return null;
  var sourceDoc = app.open(file);
  if (!sourceDoc) return null;
  var layer = sourceDoc.activeLayer.duplicate(targetDoc, ElementPlacement.PLACEATEND);
  sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
  if (!layer) return null;
  app.activeDocument = targetDoc;
  moveLayerIntoParent(layer, parent);
  fitLayerToBox(layer, bbox, true);
  moveLayerToTopLeft(layer, bbox);
  return layer;
}

function createTextLayer(parent, node) {
  var layer = parent.artLayers.add();
  layer.kind = LayerKind.TEXT;
  layer.name = safeName(getNodeDisplayName(node));

  var content = "";
  if (node.lines && node.lines.length) {
    content = node.lines.join("\r");
  } else if (node.text) {
    content = String(node.text);
  }
  content = content.replace(/\r?\n/g, "\r");

  if (node.textTransform) {
    content = applyTextTransform(content, node.textTransform);
  }
  layer.textItem.contents = content || "Text";
  var bbox = getNodeBBox(node);
  layer.textItem.kind = TextType.POINTTEXT;
  layer.textItem.position = [UnitValue(0, "px"), UnitValue(0, "px")];

  if (node.font) {
    if (node.font.family) {
      var candidates = [];
      var styleValue = node.font.fontStyle || node.font.style || "";
      candidates = candidates.concat(buildFontCandidatesFromApp(node.font.family, node.font.weight, styleValue));
      candidates = candidates.concat(buildFontNameCandidates(node.font.family, node.font.weight, styleValue));
      var chosen = applyFontWithFallback(layer.textItem, candidates);
      if (!chosen) {
        debugLog("Font fallback failed for: " + node.font.family + " weight=" + node.font.weight + " style=" + styleValue);
      }
    }
    if (node.font.sizePx) layer.textItem.size = UnitValue(node.font.sizePx, "px");
    var leadingPx = null;
    var linesLeading = pickLineHeightFromTextLines(node);
    if (linesLeading && isFinite(linesLeading)) {
      leadingPx = linesLeading;
    } else if (node.font.lineHeightPx) {
      leadingPx = Number(node.font.lineHeightPx);
    }
    layer.textItem.useAutoLeading = false;
    if (leadingPx && isFinite(leadingPx)) {
      layer.textItem.leading = UnitValue(leadingPx, "px");
    } else if (node.font.sizePx) {
      layer.textItem.leading = UnitValue(Math.round(node.font.sizePx * 1.2 * 100) / 100, "px");
    }
    if (node.font.tracking || node.font.tracking === 0) layer.textItem.tracking = node.font.tracking;
    if (node.font.textAlign) layer.textItem.justification = textAlignToJustification(node.font.textAlign);
    var colorInfo = cssColorToSolidColor(node.font.color);
    if (colorInfo && colorInfo.color) layer.textItem.color = colorInfo.color;
  }

  if (node.style && typeof node.style.opacity !== "undefined") {
    layer.opacity = Math.round(clampOpacity(node.style.opacity) * 100);
  }

  var anchor = getTextAnchorFromLines(node, bbox);
  moveLayerToTopLeft(layer, anchor);

  if (node.textLines && node.textLines.length) {
    var bounds = getLayerBoundsPx(layer);
    var boundsH = bounds.bottom - bounds.top;
    var lineCount = node.textLines.length;
    var lineBoxH = null;
    if (isFinite(node.textLines[0].h)) {
      lineBoxH = Number(node.textLines[0].h);
    }
    var leadingPx = null;
    if (isFinite(pickLineHeightFromTextLines(node))) {
      leadingPx = pickLineHeightFromTextLines(node);
    } else if (layer.textItem && isFinite(layer.textItem.leading)) {
      leadingPx = Number(layer.textItem.leading);
    }
    var expectedH = null;
    if (lineBoxH && lineCount > 1 && leadingPx) {
      expectedH = lineBoxH + (lineCount - 1) * leadingPx;
    } else if (lineBoxH) {
      expectedH = lineBoxH;
    } else if (leadingPx && lineCount > 1) {
      expectedH = leadingPx * lineCount;
    }
    if (expectedH && isFinite(boundsH) && expectedH > boundsH + 0.1) {
      layer.translate(0, (expectedH - boundsH) / 2);
    }
  }

  return layer;
}

function createImageLayer(parent, node) {
  var label = getNodeDisplayName(node);
  if (!label || label === "Layer") {
    label = node.type ? node.type.toUpperCase() : "IMAGE";
  }
  var bbox = getNodeBBox(node);
  if (node.type === "svg" && node.assetType === "svg-code" && node.content) {
    var svgLayer = createSvgLayer(parent, node, bbox);
    if (svgLayer) return svgLayer;
  }
  var placed = placeImageFromFile(parent, node, bbox);
  if (placed) {
    placed.name = safeName(label);
    if (node.style && typeof node.style.opacity !== "undefined") {
      placed.opacity = Math.round(clampOpacity(node.style.opacity) * 100);
    }
    return placed;
  }
  var placeholder = createRectShapeLayer(parent, bbox, "rgba(200,200,200,0.35)", label);
  if (placeholder) {
    if (node.style && typeof node.style.opacity !== "undefined") {
      placeholder.opacity = Math.round(clampOpacity(node.style.opacity) * 100);
    }
    return placeholder;
  }
  return createArtLayer(parent, label);
}
