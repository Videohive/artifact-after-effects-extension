// ============================================================
// CORE
// ============================================================

function createSlideDocument(data, index) {
  var w = Math.round(data.viewport.width);
  var h = Math.round(data.viewport.height);
  var name = safeName(data.artifactId || data.slideId || data.name || "slide-" + (index + 1));

  var doc = app.documents.add(
    UnitValue(w, "px"),
    UnitValue(h, "px"),
    CFG.defaultResolution,
    name,
    NewDocumentMode.RGB,
    DocumentFill.TRANSPARENT
  );

  return doc;
}

function buildNode(node, parent, rootData) {
  if (!node || (node.renderHints && node.renderHints.isHidden)) return null;

  if (node.type === "group") {
    var group = createGroup(parent, getNodeDisplayName(node));
    if (node.style && node.style.backgroundColor && !isTransparentColor(node.style.backgroundColor)) {
      var bgLayer = createRectShapeLayer(
        group,
        getNodeBBox(node),
        node.style.backgroundColor,
        getNodeDisplayName(node) + " Background"
      );
      if (bgLayer && typeof node.style.opacity !== "undefined") {
        bgLayer.opacity = Math.round(clampOpacity(node.style.opacity) * 100);
      }
      if (bgLayer) moveLayerToBeginning(bgLayer, group);
    }
    if (hasBorder(node.border)) {
      createBorderLayer(group, getNodeBBox(node), node.border, getNodeDisplayName(node) + " Border");
    }
    if (node.children && node.children.length) {
      var orderedChildren = orderChildrenByZIndex(node.children);
      for (var i = 0; i < orderedChildren.length; i++) {
        buildNode(orderedChildren[i], group, rootData);
      }
    }
    return group;
  }

  if (node.type === "text") {
    var textLayer = createTextLayer(parent, node);
    if (hasBorder(node.border)) {
      createBorderLayer(parent, getNodeBBox(node), node.border, getNodeDisplayName(node) + " Border");
    }
    return textLayer;
  }

  if (node.type === "image" || node.type === "video" || node.type === "svg") {
    var imageLayer = createImageLayer(parent, node);
    if (hasBorder(node.border)) {
      createBorderLayer(parent, getNodeBBox(node), node.border, getNodeDisplayName(node) + " Border");
    }
    return imageLayer;
  }

  if (node.children && node.children.length) {
    var fallbackGroup = createGroup(parent, getNodeDisplayName(node));
    var orderedFallback = orderChildrenByZIndex(node.children);
    for (var j = 0; j < orderedFallback.length; j++) {
      buildNode(orderedFallback[j], fallbackGroup, rootData);
    }
    return fallbackGroup;
  }

  return createArtLayer(parent, getNodeDisplayName(node));
}
