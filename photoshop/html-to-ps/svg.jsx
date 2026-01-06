// ============================================================
// SVG HELPERS (Photoshop)
// ============================================================

function writeTempSvgFile(svgContent) {
  if (!svgContent) return null;
  var name = "ae2-svg-" + String(new Date().getTime()) + ".svg";
  var file = new File(Folder.temp.fsName + "/" + name);
  if (!file.open("w")) return null;
  file.write(svgContent);
  file.close();
  return file;
}

function placeSvgFile(file) {
  if (!file || !file.exists) return null;
  var idPlc = charIDToTypeID("Plc ");
  var desc = new ActionDescriptor();
  desc.putPath(charIDToTypeID("null"), file);
  desc.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));
  desc.putUnitDouble(charIDToTypeID("Wdth"), charIDToTypeID("#Prc"), 100);
  desc.putUnitDouble(charIDToTypeID("Hght"), charIDToTypeID("#Prc"), 100);
  executeAction(idPlc, desc, DialogModes.NO);
  return app.activeDocument.activeLayer;
}

function fitLayerToBoxNonUniform(layer, bbox) {
  var bounds = getLayerBoundsPx(layer);
  var w = bounds.right - bounds.left;
  var h = bounds.bottom - bounds.top;
  if (w <= 0 || h <= 0 || bbox.w <= 0 || bbox.h <= 0) return;
  var scaleX = (bbox.w / w) * 100;
  var scaleY = (bbox.h / h) * 100;
  layer.resize(scaleX, scaleY, AnchorPosition.MIDDLECENTER);
}

function createSvgLayer(parent, node, bbox) {
  if (!node || !node.content) return null;
  var doc = getParentDocument(parent);
  if (!doc) return null;
  app.activeDocument = doc;

  var svgFile = writeTempSvgFile(node.content);
  if (!svgFile) return null;

  var layer = null;
  try {
    layer = placeSvgFile(svgFile);
  } catch (e) {
    layer = null;
  }
  if (!layer) return null;

  layer.name = safeName(getNodeDisplayName(node));
  moveLayerIntoParent(layer, parent);

  var preserveNone = /preserveAspectRatio\\s*=\\s*['"]none['"]/i.test(node.content);
  if (preserveNone) {
    fitLayerToBoxNonUniform(layer, bbox);
  } else {
    fitLayerToBox(layer, bbox, false);
  }
  moveLayerToTopLeft(layer, bbox);

  if (node.style && typeof node.style.opacity !== "undefined") {
    layer.opacity = Math.round(clampOpacity(node.style.opacity) * 100);
  }

  return layer;
}
