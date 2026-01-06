// ============================================================
// HELPERS
// ============================================================

var PS2_DEBUG = typeof PS2_DEBUG !== "undefined" ? PS2_DEBUG : false;

function debugLog(msg) {
  if (!PS2_DEBUG) return;
  try {
    $.writeln("[PS2] " + msg);
  } catch (e) {}
}

function trim(s) {
  return String(s).replace(/^\s+|\s+$/g, "");
}

function safeName(n) {
  if (!n) return "Layer";
  var s = String(n);
  s = s.replace(/[\r\n\t]/g, " ").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
  s = trim(s);
  if (s.length === 0) s = "Layer";
  return s;
}

function parseCssColor(css) {
  if (!css) return null;
  var s = String(css).trim().toLowerCase();
  if (s === "transparent") return null;
  if (s.charAt(0) === "#") {
    var hex = s.slice(1);
    if (hex.length === 4) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    if (hex.length === 3) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }
    if (hex.length === 6) {
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return { r: r, g: g, b: b, a: 1 };
      }
    }
  }
  var m = s.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  var a = m.length >= 4 ? Number(m[3]) : 1;
  return { r: Number(m[0]), g: Number(m[1]), b: Number(m[2]), a: a };
}

function cssColorToSolidColor(css) {
  var c = parseCssColor(css);
  if (!c) return null;
  var color = new SolidColor();
  color.rgb.red = Math.max(0, Math.min(255, c.r));
  color.rgb.green = Math.max(0, Math.min(255, c.g));
  color.rgb.blue = Math.max(0, Math.min(255, c.b));
  return { color: color, alpha: c.a };
}

function parseCssAlpha(css) {
  var c = parseCssColor(css);
  if (!c) return 1;
  return typeof c.a === "number" ? clampOpacity(c.a) : 1;
}

function clampOpacity(value) {
  if (value === null || typeof value === "undefined") return 1;
  var v = Number(value);
  if (!isFinite(v)) return 1;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function getNodeBBox(node) {
  return node && node.bbox ? node.bbox : { x: 0, y: 0, w: 0, h: 0 };
}

function pickLineHeightFromTextLines(node) {
  if (!node || !node.textLines || node.textLines.length < 2) return null;
  var ys = [];
  for (var i = 0; i < node.textLines.length; i++) {
    var line = node.textLines[i];
    if (!line || !isFinite(line.y)) continue;
    ys.push(Number(line.y));
  }
  if (ys.length < 2) return null;
  ys.sort(function (a, b) { return a - b; });
  var diffs = [];
  for (var j = 1; j < ys.length; j++) {
    var d = ys[j] - ys[j - 1];
    if (isFinite(d) && d > 0.1) diffs.push(d);
  }
  if (!diffs.length) return null;
  diffs.sort(function (a, b) { return a - b; });
  var mid = Math.floor(diffs.length / 2);
  return diffs.length % 2 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
}

function getTextAnchorFromLines(node, fallbackBBox) {
  if (!node || !node.textLines || !node.textLines.length) return fallbackBBox;
  var minX = null;
  var minY = null;
  for (var i = 0; i < node.textLines.length; i++) {
    var line = node.textLines[i];
    if (!line) continue;
    if (isFinite(line.x)) {
      minX = minX === null ? Number(line.x) : Math.min(minX, Number(line.x));
    }
    if (isFinite(line.y)) {
      minY = minY === null ? Number(line.y) : Math.min(minY, Number(line.y));
    }
  }
  return {
    x: minX !== null ? minX : (fallbackBBox ? fallbackBBox.x : 0),
    y: minY !== null ? minY : (fallbackBBox ? fallbackBBox.y : 0),
    w: fallbackBBox ? fallbackBBox.w : 0,
    h: fallbackBBox ? fallbackBBox.h : 0
  };
}

function isTransparentColor(css) {
  if (!css) return true;
  var s = String(css).toLowerCase();
  if (s === "transparent") return true;
  var a = parseCssAlpha(css);
  return a <= 0;
}

function isVisibleBorderSide(side) {
  if (!side) return false;
  if (!side.widthPx || side.widthPx <= 0) return false;
  var style = String(side.style || "").toLowerCase();
  if (style === "none" || style === "hidden") return false;
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

function normalizeSlides(data) {
  if (!data) return [];
  if (data instanceof Array) return data;
  if (data.artifacts && data.artifacts instanceof Array) {
    var rootSettings = data.settings || null;
    var list = [];
    for (var i = 0; i < data.artifacts.length; i++) {
      var item = data.artifacts[i];
      if (!item) continue;
      if (!item.settings && rootSettings) item.settings = rootSettings;
      list.push(item);
    }
    return list;
  }
  if (data.slides && data.slides instanceof Array) return data.slides;
  return [data];
}

function isValidSlide(slide) {
  return slide && slide.viewport && slide.root;
}

function getZIndexValue(node) {
  if (!node || !node.style) return 0;
  var z = node.style.zIndex;
  if (z === null || typeof z === "undefined") return 0;
  var n = Number(z);
  if (isNaN(n)) return 0;
  return n;
}

function orderChildrenByZIndex(children) {
  if (!children || !children.length) return children;

  var list = [];
  for (var i = 0; i < children.length; i++) {
    list.push({ node: children[i], index: i, z: getZIndexValue(children[i]) });
  }

  list.sort(function (a, b) {
    if (a.z < b.z) return -1;
    if (a.z > b.z) return 1;
    if (a.index < b.index) return -1;
    if (a.index > b.index) return 1;
    return 0;
  });

  var ordered = [];
  for (var j = 0; j < list.length; j++) ordered.push(list[j].node);
  return ordered;
}

function getNodeDisplayName(node) {
  if (!node) return "Layer";
  if (node.name) return node.name;
  if (node.type === "text" && node.text) {
    var t = String(node.text).replace(/\s+/g, " ");
    if (t.length > 40) t = t.slice(0, 37) + "...";
    return "Text: " + t;
  }
  if (node.type) return node.type;
  return "Layer";
}

function textAlignToJustification(align) {
  var s = String(align || "").toLowerCase();
  if (s === "center") return Justification.CENTER;
  if (s === "right" || s === "end") return Justification.RIGHT;
  if (s === "justify") return Justification.FULLYJUSTIFIED;
  return Justification.LEFT;
}

function normalizeFamilyParts(family) {
  if (!family) return [];
  var parts = String(family).split(",");
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = trim(String(parts[i]).replace(/['"]/g, ""));
    if (!p) continue;
    out.push(p);
  }
  return out;
}

function parseFontWeight(weight) {
  if (typeof weight === "number" && isFinite(weight)) return weight;
  if (!weight) return 400;
  var w = String(weight).toLowerCase();
  if (w === "normal") return 400;
  if (w === "bold" || w === "bolder") return 700;
  if (w === "lighter") return 300;
  var n = parseInt(w, 10);
  return isFinite(n) ? n : 400;
}

function weightNamesForValue(weight) {
  var w = parseFontWeight(weight);
  if (w >= 900) return ["Black", "Heavy"];
  if (w >= 800) return ["ExtraBold", "UltraBold"];
  if (w >= 700) return ["Bold"];
  if (w >= 600) return ["SemiBold", "DemiBold"];
  if (w >= 500) return ["Medium"];
  return ["Regular", "Book", "Normal"];
}

function pushUnique(list, value) {
  for (var i = 0; i < list.length; i++) {
    if (list[i] === value) return;
  }
  list.push(value);
}

function buildFontCandidatesFromApp(family, weight, fontStyle) {
  var candidates = [];
  if (!family || !app || !app.fonts) return candidates;
  var families = normalizeFamilyParts(family);
  if (!families.length) return candidates;

  var weightNames = weightNamesForValue(weight);
  var italicWanted = /italic|oblique/i.test(String(fontStyle || ""));

  var fonts = app.fonts;
  for (var f = 0; f < families.length; f++) {
    var fam = families[f].toLowerCase();
    var matches = [];
    for (var i = 0; i < fonts.length; i++) {
      var font = fonts[i];
      if (!font || !font.family) continue;
      if (String(font.family).toLowerCase() !== fam) continue;
      matches.push(font);
    }

    if (!matches.length) continue;

    for (var w = 0; w < weightNames.length; w++) {
      var weightName = weightNames[w].toLowerCase();
      for (var j = 0; j < matches.length; j++) {
        var style = String(matches[j].style || "").toLowerCase();
        var hasItalic = style.indexOf("italic") !== -1 || style.indexOf("oblique") !== -1;
        var weightMatch = style.indexOf(weightName) !== -1;
        if (weightMatch && ((italicWanted && hasItalic) || (!italicWanted && !hasItalic))) {
          pushUnique(candidates, matches[j].postScriptName || matches[j].name);
        }
      }
    }

    for (var k = 0; k < matches.length; k++) {
      var style2 = String(matches[k].style || "").toLowerCase();
      var hasItalic2 = style2.indexOf("italic") !== -1 || style2.indexOf("oblique") !== -1;
      if (italicWanted && hasItalic2) {
        pushUnique(candidates, matches[k].postScriptName || matches[k].name);
      }
    }

    for (var r = 0; r < matches.length; r++) {
      var style3 = String(matches[r].style || "").toLowerCase();
      var regular =
        style3.indexOf("regular") !== -1 ||
        style3.indexOf("book") !== -1 ||
        style3.indexOf("normal") !== -1;
      if (!italicWanted && regular) {
        pushUnique(candidates, matches[r].postScriptName || matches[r].name);
      }
    }

    for (var m = 0; m < matches.length; m++) {
      pushUnique(candidates, matches[m].postScriptName || matches[m].name);
    }
  }

  return candidates;
}

function buildFontNameCandidates(family, weight, fontStyle) {
  var candidates = [];
  if (!family) return candidates;
  var families = normalizeFamilyParts(family);
  var weightNames = weightNamesForValue(weight);
  var italicWanted = /italic|oblique/i.test(String(fontStyle || ""));

  for (var f = 0; f < families.length; f++) {
    var base = families[f];
    var baseNoSpaces = base.replace(/\s+/g, "");
    for (var i = 0; i < weightNames.length; i++) {
      var w = weightNames[i];
      if (italicWanted) {
        pushUnique(candidates, base + "-" + w + "Italic");
        pushUnique(candidates, base + "-" + w + " Italic");
        pushUnique(candidates, baseNoSpaces + "-" + w + "Italic");
      }
      pushUnique(candidates, base + "-" + w);
      pushUnique(candidates, base + " " + w);
      pushUnique(candidates, baseNoSpaces + "-" + w);
    }
    pushUnique(candidates, base);
    pushUnique(candidates, baseNoSpaces);
  }

  return candidates;
}

function applyFontWithFallback(textItem, candidates) {
  if (!textItem || !candidates || !candidates.length) return null;
  for (var i = 0; i < candidates.length; i++) {
    try {
      textItem.font = candidates[i];
      if (textItem.font === candidates[i]) {
        debugLog("Font applied: " + candidates[i]);
        return candidates[i];
      }
    } catch (e) {}
  }
  return null;
}

function applyTextTransform(text, transform) {
  if (!text) return "";
  if (!transform || transform === "none") return text;

  var t = String(transform).toLowerCase();
  if (t === "uppercase") return text.toUpperCase();
  if (t === "lowercase") return text.toLowerCase();

  if (t === "capitalize") {
    var out = "";
    var makeUpper = true;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
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
        ch === "\"" ||
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
