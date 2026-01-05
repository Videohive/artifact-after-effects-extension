  // ============================================================
  // STYLES
  // ============================================================

  function applyOpacity(layer, style) {
    var extraAlpha = arguments.length > 2 ? arguments[2] : null;
    var hasStyleOpacity =
      style &&
      typeof style.opacity !== "undefined" &&
      style.opacity !== null;

    if (!hasStyleOpacity && (extraAlpha === null || typeof extraAlpha === "undefined")) return;

    var o = hasStyleOpacity ? Number(style.opacity) : 1;
    if (isNaN(o)) o = 1;

    var a = 1;
    if (!(extraAlpha === null || typeof extraAlpha === "undefined")) {
      a = Number(extraAlpha);
      if (isNaN(a)) a = 1;
    }

    var finalOpacity = o * a;
    if (finalOpacity < 0) finalOpacity = 0;
    if (finalOpacity > 1) finalOpacity = 1;
    layer
      .property("Transform")
      .property("Opacity")
      .setValue(finalOpacity * 100);
  }

  function applyBlendMode(layer, style) {
    if (!style || !style.blendMode) return;
    // Map only a few common modes; extend as needed
    var m = String(style.blendMode).toLowerCase();
    try {
      if (m === "normal") layer.blendingMode = BlendingMode.NORMAL;
      else if (m === "multiply") layer.blendingMode = BlendingMode.MULTIPLY;
      else if (m === "screen") layer.blendingMode = BlendingMode.SCREEN;
      else if (m === "overlay") layer.blendingMode = BlendingMode.OVERLAY;
      else if (m === "add" || m === "pluslighter")
        layer.blendingMode = BlendingMode.ADD;
    } catch (e) {}
  }

  function applyDropShadow(layer, style) {
    if (!layer || !style || !style.boxShadow || !style.boxShadow.length) return;
    var effects = layer.property("Effects");
    if (!effects) return;
    var currentCompName = layer.containingComp ? layer.containingComp.name : null;

    for (var i = 0; i < style.boxShadow.length; i++) {
      var sh = style.boxShadow[i];
      if (!sh || sh.inset) continue;
      var color = sh.color || "";
      if (isTransparentColor(color)) continue;

      var dx = Number(sh.offsetX) || 0;
      var dy = Number(sh.offsetY) || 0;
      var blur = Number(sh.blurRadius) || 0;
      var distance = Math.sqrt(dx * dx + dy * dy);
      var direction = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (direction < 0) direction += 360;

      var effect = effects.addProperty("ADBE Drop Shadow");
      if (!effect) continue;

      var colorProp = effect.property("Shadow Color") || effect.property("Color");
      if (colorProp) applyCssColorProperty(colorProp, color, currentCompName);
      var opacityProp = effect.property("Opacity");
      if (opacityProp) {
        var alpha = parseCssAlpha(color);
        var maxOpacity = opacityProp.maxValue;
        if (!isFinite(maxOpacity) || maxOpacity <= 0) maxOpacity = 100;
        opacityProp.setValue(Math.round(alpha * maxOpacity));
      }
      var directionProp = effect.property("Direction");
      if (directionProp) directionProp.setValue(direction);
      var distanceProp = effect.property("Distance");
      if (distanceProp) distanceProp.setValue(distance);
      var softnessProp = effect.property("Softness");
      if (softnessProp) softnessProp.setValue(blur);
    }
  }

  function mapTextAlign(align) {
    var a = (align || "start").toLowerCase();
    if (a === "center") return ParagraphJustification.CENTER_JUSTIFY;
    if (a === "end" || a === "right")
      return ParagraphJustification.RIGHT_JUSTIFY;
    return ParagraphJustification.LEFT_JUSTIFY;
  }

