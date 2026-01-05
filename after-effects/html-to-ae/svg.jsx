  // ============================================================
  if (typeof debugLog === "undefined") {
    function debugLog(msg) {}
  }

  function createSvgShapeLayers(comp, node, localBBox, rootData) {
    var layers = [];
    var svg = String(node.content || "");
    var svgOpenTag = extractSvgOpenTag(svg);
    var svgInner = extractSvgInner(svg);
    var topBlocks = extractSvgTopLevelBlocks(svgInner);
    var rootSvgData = parseSvgData(svg);
    normalizeSvgData(rootSvgData, localBBox, rootData);

    debugLog(
      "SVG: create layers name=" +
        safeName(node.name || "SVG") +
        " bbox=" +
        localBBox.w +
        "x" +
        localBBox.h +
        " blocks=" +
        topBlocks.length
    );

    if (!svgOpenTag || !topBlocks.length) {
      var fallbackData = rootSvgData;
      var single = buildSvgLayerFromData(
        comp,
        node,
        localBBox,
        fallbackData,
        node.name || "SVG",
        null
      );
      if (single) layers.push(single);
      if (fallbackData && fallbackData.textElements && fallbackData.textElements.length) {
        for (var ft = 0; ft < fallbackData.textElements.length; ft++) {
          var fallbackText = addSvgTextLayer(
            comp,
            null,
            fallbackData.textElements[ft],
            fallbackData,
            localBBox,
            1,
            null,
            rootSvgData
          );
          if (fallbackText) layers.push(fallbackText);
        }
      }
      return layers;
    }

    for (var i = 0; i < topBlocks.length; i++) {
      var block = topBlocks[i];
      var openTag = block.openTag;
      var attrs = parseSvgAttributes(openTag);
      var styledAttrs = parseSvgStyleAttributes(attrs);
      var blockOpacity = parseNumber(styledAttrs.opacity, 1);
      var blockTransform = parseSvgTransform(styledAttrs.transform);
      var id = styledAttrs.id || block.tag + "-" + (i + 1);
      var wrapped = svgOpenTag + block.raw + "</svg>";
      var svgData = parseSvgData(wrapped);
      normalizeSvgData(svgData, localBBox, rootData);

      var hasShapes = svgData && svgData.elements && svgData.elements.length;
      if (hasShapes) {
        var layer = buildSvgLayerFromData(comp, node, localBBox, svgData, id, blockTransform);
        if (layer) {
          if (isFinite(blockOpacity) && blockOpacity !== 1) {
            layer.property("Transform").property("Opacity").setValue(blockOpacity * 100);
          }
          layers.push(layer);
        }
      }

      if (svgData && svgData.textElements && svgData.textElements.length) {
        for (var t = 0; t < svgData.textElements.length; t++) {
          var textLayer = addSvgTextLayer(
            comp,
            null,
            svgData.textElements[t],
            svgData,
            localBBox,
            blockOpacity,
            blockTransform,
            rootSvgData
          );
          if (textLayer) layers.push(textLayer);
        }
      }
    }

    return layers;
  }

  function extractSvgOpenTag(svg) {
    if (!svg) return "";
    var match = String(svg).match(/<svg\b[^>]*>/i);
    return match ? match[0] : "";
  }

  function extractSvgInner(svg) {
    if (!svg) return "";
    var s = String(svg);
    var openMatch = s.match(/<svg\b[^>]*>/i);
    if (!openMatch) return "";
    var start = openMatch.index + openMatch[0].length;
    var end = s.lastIndexOf("</svg>");
    if (end === -1) end = s.length;
    return s.substring(start, end);
  }

  function extractSvgTopLevelBlocks(svgInner) {
    var out = [];
    var s = String(svgInner || "");
    var i = 0;
    var len = s.length;
    var depth = 0;
    var start = -1;
    var topTag = "";
    while (i < len) {
      var lt = s.indexOf("<", i);
      if (lt === -1) break;
      if (s.substr(lt, 4) === "<!--") {
        var endComment = s.indexOf("-->", lt + 4);
        if (endComment === -1) break;
        i = endComment + 3;
        continue;
      }

      if (s.substr(lt, 2) === "</") {
        var gtClose = s.indexOf(">", lt + 2);
        if (gtClose === -1) break;
        if (depth > 0) depth--;
        if (depth === 0 && start !== -1) {
          var raw = s.substring(start, gtClose + 1);
          out.push({ raw: raw, tag: topTag, openTag: extractOpenTag(raw) });
          start = -1;
          topTag = "";
        }
        i = gtClose + 1;
        continue;
      }

      var gt = s.indexOf(">", lt + 1);
      if (gt === -1) break;
      var tagText = s.substring(lt, gt + 1);
      var tag = parseTagName(tagText);
      var selfClosing = /\/>\s*$/.test(tagText);

      if (tag.toLowerCase() === "defs") {
        if (!selfClosing) {
          var defsClose = s.indexOf("</defs", gt + 1);
          if (defsClose !== -1) {
            var defsEnd = s.indexOf(">", defsClose + 6);
            if (defsEnd !== -1) {
              i = defsEnd + 1;
              continue;
            }
          }
        }
        i = gt + 1;
        continue;
      }

      if (depth === 0) {
        start = lt;
        topTag = tag;
      }

      if (!selfClosing) {
        depth++;
      } else if (depth === 0) {
        var rawSelf = s.substring(start, gt + 1);
        out.push({ raw: rawSelf, tag: topTag, openTag: extractOpenTag(rawSelf) });
        start = -1;
        topTag = "";
      }

      i = gt + 1;
    }
    return out;
  }

  function parseTagName(tagText) {
    var m = String(tagText).match(/<\s*([a-zA-Z0-9:_-]+)/);
    return m && m[1] ? m[1] : "unknown";
  }

  function extractOpenTag(block) {
    var m = String(block).match(/<[^>]+>/);
    return m ? m[0] : "";
  }

  function normalizeSvgData(svgData, localBBox, rootData) {
    if (!svgData) return;
    if (svgData && (svgData.percentWidth || svgData.percentHeight)) {
      var viewportScale = 1;
      if (rootData && rootData.viewport) {
        viewportScale = parseNumber(rootData.viewport.scale, 1);
        if (!isFinite(viewportScale) || viewportScale <= 0) viewportScale = 1;
      }
      var baseW = localBBox.w;
      var baseH = localBBox.h;
      if (viewportScale !== 1) {
        if (baseW > 0) baseW = baseW / viewportScale;
        if (baseH > 0) baseH = baseH / viewportScale;
      }
      if (svgData.percentWidth) svgData.width = baseW || svgData.width;
      if (svgData.percentHeight) svgData.height = baseH || svgData.height;
      svgData.minX = 0;
      svgData.minY = 0;
    }

    if (svgData && (svgData.width <= 0 || svgData.height <= 0)) {
      var fallback = getSvgFallbackSize(localBBox, rootData);
      if (fallback.w > 0 && fallback.h > 0) {
        // Fallback to source viewport size when SVG lacks viewBox/width/height.
        svgData.minX = 0;
        svgData.minY = 0;
        svgData.width = fallback.w;
        svgData.height = fallback.h;
      }
    }
  }

  function buildSvgLayerFromData(comp, node, localBBox, svgData, name, extraTransform) {
    if (!svgData || svgData.width <= 0 || svgData.height <= 0) return null;
    var layer = comp.layers.addShape();
    layer.name = safeName(name || node.name || "SVG");

    var contents = layer.property("Contents");
    var scaleData = getSvgScaleData(svgData, localBBox);
    var rootContents = contents;

    for (var i = 0; i < svgData.elements.length; i++) {
      var el = svgData.elements[i];
      if (!el) continue;

      if (el.tag === "circle") {
        addSvgCircle(rootContents, el.attrs, svgData, scaleData, comp.name);
      } else if (el.tag === "ellipse") {
        addSvgEllipse(rootContents, el.attrs, svgData, scaleData, comp.name);
      } else if (el.tag === "rect") {
        addSvgRect(rootContents, el.attrs, svgData, scaleData, comp.name);
      } else if (el.tag === "line") {
        addSvgLine(rootContents, el.attrs, svgData, scaleData, comp.name);
      } else if (el.tag === "polyline") {
        addSvgPolyline(rootContents, el.attrs, false, svgData, scaleData, comp.name);
      } else if (el.tag === "polygon") {
        addSvgPolyline(rootContents, el.attrs, true, svgData, scaleData, comp.name);
      } else if (el.tag === "path") {
        addSvgPath(rootContents, el.attrs, svgData, scaleData, comp.name);
      }
    }

    applySvgViewBoxTransformToContents(contents, svgData, localBBox, extraTransform);
    setLayerTopLeft(layer, localBBox);
    return layer;
  }

  function applySvgViewBoxTransformToContents(contents, svgData, localBBox, extraTransform) {
    if (!contents) return;
    var count = contents.numProperties || 0;
    for (var i = 1; i <= count; i++) {
      var group = contents.property(i);
      if (group && group.matchName === "ADBE Vector Group") {
        applySvgViewBoxTransform(group, svgData, localBBox, extraTransform);
      }
    }
  }

  function applySvgViewBoxTransform(rootGroup, svgData, localBBox, extraTransform) {
    // Map SVG viewBox to bbox via group transform (preserve aspect ratio).
    var scaleX = localBBox.w / svgData.width;
    var scaleY = localBBox.h / svgData.height;
    var preserve = String(svgData.preserveAspectRatio || "").toLowerCase();
    var useNonUniformScale = preserve.indexOf("none") !== -1;
    var scale = useNonUniformScale ? 1 : Math.min(scaleX, scaleY);
    var padX = useNonUniformScale ? 0 : (localBBox.w - svgData.width * scale) / 2;
    var padY = useNonUniformScale ? 0 : (localBBox.h - svgData.height * scale) / 2;
    var tr = rootGroup.property("Transform");
    tr.property("Anchor Point").setValue([0, 0]);
    var posX = -svgData.minX + padX;
    var posY = -svgData.minY + padY;
    if (extraTransform && extraTransform.length >= 6) {
      var tx = extraTransform[4] || 0;
      var ty = extraTransform[5] || 0;
      if (tx !== 0 || ty !== 0) {
        if (useNonUniformScale) {
          posX += tx * scaleX;
          posY += ty * scaleY;
        } else {
          posX += tx * scale;
          posY += ty * scale;
        }
      }
    }
    tr.property("Position").setValue([posX, posY]);
    if (useNonUniformScale) {
      tr.property("Scale").setValue([scaleX * 100, scaleY * 100]);
    } else {
      tr.property("Scale").setValue([scale * 100, scale * 100]);
    }
  }

  function parseSvgData(svg) {
    var out = {
      minX: 0,
      minY: 0,
      width: 0,
      height: 0,
      elements: [],
      preserveAspectRatio: "",
      percentWidth: false,
      percentHeight: false
    };
    if (!svg) return out;
    debugLog("SVG: parseSvgData len=" + String(svg).length);

    var viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (viewBoxMatch && viewBoxMatch[1]) {
      var vb = viewBoxMatch[1].replace(/,/g, " ").split(/\s+/);
      if (vb.length >= 4) {
        out.minX = parseNumber(vb[0], 0);
        out.minY = parseNumber(vb[1], 0);
        out.width = parseNumber(vb[2], 0);
        out.height = parseNumber(vb[3], 0);
      }
    }

    if (out.width <= 0 || out.height <= 0) {
      var wRaw = "";
      var hRaw = "";
      var openTagMatch = svg.match(/<svg\b[^>]*>/i);
      if (openTagMatch && openTagMatch[0]) {
        var svgAttrs = parseSvgAttributes(openTagMatch[0]);
        var styled = parseSvgStyleAttributes(svgAttrs);
        wRaw = svgAttrs.width || styled.width || "";
        hRaw = svgAttrs.height || styled.height || "";
      } else {
        var wMatch = svg.match(/width\s*=\s*["']([^"']+)["']/i);
        var hMatch = svg.match(/height\s*=\s*["']([^"']+)["']/i);
        wRaw = wMatch && wMatch[1] ? String(wMatch[1]) : "";
        hRaw = hMatch && hMatch[1] ? String(hMatch[1]) : "";
      }
      out.percentWidth = wRaw.indexOf("%") !== -1;
      out.percentHeight = hRaw.indexOf("%") !== -1;
      out.width = parseNumber(wRaw, 0);
      out.height = parseNumber(hRaw, 0);
      if (out.percentWidth) out.width = 0;
      if (out.percentHeight) out.height = 0;
      out.minX = 0;
      out.minY = 0;
    }

    var preserveMatch = svg.match(/preserveAspectRatio\s*=\s*["']([^"']+)["']/i);
    if (preserveMatch && preserveMatch[1]) {
      out.preserveAspectRatio = preserveMatch[1];
    }

    collectSvgElements(svg, "circle", out.elements);
    collectSvgElements(svg, "ellipse", out.elements);
    collectSvgElements(svg, "rect", out.elements);
    collectSvgElements(svg, "line", out.elements);
    collectSvgElements(svg, "polyline", out.elements);
    collectSvgElements(svg, "polygon", out.elements);
    collectSvgElements(svg, "path", out.elements);
    out.textElements = [];
    collectSvgTextElements(svg, out.textElements);

    debugLog("SVG: elements=" + out.elements.length);
    return out;
  }

  function collectSvgElements(svg, tag, list) {
    var re = new RegExp("<" + tag + "\\b[^>]*>", "gi");
    var match = null;
    while ((match = re.exec(svg)) !== null) {
      list.push({ tag: tag, attrs: parseSvgAttributes(match[0]) });
    }
  }

  function parseSvgAttributes(tagText) {
    var attrs = {};
    var re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*["']([^"']*)["']/g;
    var match = null;
    while ((match = re.exec(tagText)) !== null) {
      attrs[match[1]] = decodeSvgEntities(match[2]);
    }
    return attrs;
  }

  function collectSvgTextElements(svg, list) {
    if (!svg) return;
    var re = /<text\b[\s\S]*?<\/text>/gi;
    var match = null;
    while ((match = re.exec(svg)) !== null) {
      var block = match[0];
      var openTagMatch = block.match(/<text\b[^>]*>/i);
      var openTag = openTagMatch ? openTagMatch[0] : "<text>";
      var attrs = parseSvgAttributes(openTag);
      var textPathMatch = block.match(/<textPath\b[^>]*>[\s\S]*?<\/textPath>/i);
      var textContent = "";
      var pathRef = "";
      if (textPathMatch) {
        var textPathBlock = textPathMatch[0];
        var textPathOpen = textPathBlock.match(/<textPath\b[^>]*>/i);
        var textPathAttrs = parseSvgAttributes(textPathOpen ? textPathOpen[0] : "<textPath>");
        var href = textPathAttrs.href || textPathAttrs["xlink:href"] || "";
        if (href && href.charAt(0) === "#") pathRef = href.substring(1);
        textContent = textPathBlock.replace(/<textPath\b[^>]*>/i, "").replace(/<\/textPath>/i, "");
        textContent = stripSvgTags(textContent);
        list.push({
          tag: "text",
          attrs: attrs,
          text: decodeSvgEntities(textContent),
          pathRef: pathRef
        });
      } else {
        textContent = block.replace(/<text\b[^>]*>/i, "").replace(/<\/text>/i, "");
        textContent = stripSvgTags(textContent);
        list.push({ tag: "text", attrs: attrs, text: decodeSvgEntities(textContent) });
      }
    }
  }

  function stripSvgTags(text) {
    return String(text).replace(/<[^>]*>/g, "");
  }

  function decodeSvgEntities(text) {
    return String(text)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function parseNumber(value, fallback) {
    var n = parseFloat(value);
    return isNaN(n) ? fallback : n;
  }

  function addSvgCircle(parentContents, attrs, svgData, scaleData, compName) {
    var cx = parseSvgLength(attrs.cx, svgData.width, 0);
    var cy = parseSvgLength(attrs.cy, svgData.height, 0);
    var refLen = getSvgNormalizedLength(svgData.width, svgData.height);
    var r = parseSvgLength(attrs.r, refLen, 0);
    if (r <= 0) return;

    var grp = parentContents.addProperty("ADBE Vector Group");
    grp.name = attrs && attrs.id ? attrs.id : "Circle";
    var grpContents = grp.property("Contents");

    var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("Size").setValue([r * 2, r * 2]);
    ellipse.property("Position").setValue([cx, cy]);

    applySvgPaint(grpContents, attrs, false, compName);
  }

  function addSvgEllipse(parentContents, attrs, svgData, scaleData, compName) {
    var cx = parseSvgLength(attrs.cx, svgData.width, 0);
    var cy = parseSvgLength(attrs.cy, svgData.height, 0);
    var rx = parseSvgLength(attrs.rx, svgData.width, 0);
    var ry = parseSvgLength(attrs.ry, svgData.height, 0);
    if (rx <= 0 || ry <= 0) return;

    var grp = parentContents.addProperty("ADBE Vector Group");
    grp.name = attrs && attrs.id ? attrs.id : "Ellipse";
    var grpContents = grp.property("Contents");

    var ellipse = grpContents.addProperty("ADBE Vector Shape - Ellipse");
    ellipse.property("Size").setValue([rx * 2, ry * 2]);
    ellipse.property("Position").setValue([cx, cy]);

    applySvgPaint(grpContents, attrs, false, compName);
  }

  function addSvgRect(parentContents, attrs, svgData, scaleData, compName) {
    var x = parseSvgLength(attrs.x, svgData.width, 0);
    var y = parseSvgLength(attrs.y, svgData.height, 0);
    var w = parseSvgLength(attrs.width, svgData.width, 0);
    var h = parseSvgLength(attrs.height, svgData.height, 0);
    if (w <= 0 || h <= 0) return;

    var grp = parentContents.addProperty("ADBE Vector Group");
    grp.name = attrs && attrs.id ? attrs.id : "Rect";
    var grpContents = grp.property("Contents");

    var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
    rect.property("Size").setValue([w, h]);
    rect.property("Position").setValue([x + w / 2, y + h / 2]);

    var rx = parseNumber(attrs.rx, 0);
    var ry = parseNumber(attrs.ry, 0);
    var r = Math.max(rx, ry);
    if (r > 0) rect.property("Roundness").setValue(r);

    applySvgPaint(grpContents, attrs, true, compName);
  }

  function addSvgLine(parentContents, attrs, svgData, scaleData, compName) {
    var x1 = parseSvgLength(attrs.x1, svgData.width, 0);
    var y1 = parseSvgLength(attrs.y1, svgData.height, 0);
    var x2 = parseSvgLength(attrs.x2, svgData.width, 0);
    var y2 = parseSvgLength(attrs.y2, svgData.height, 0);

    var grp = parentContents.addProperty("ADBE Vector Group");
    grp.name = attrs && attrs.id ? attrs.id : "Line";
    var grpContents = grp.property("Contents");

    var pathProp = grpContents.addProperty("ADBE Vector Shape - Group");
    var shape = new Shape();
    shape.vertices = [
      [x1, y1],
      [x2, y2]
    ];
    shape.inTangents = [
      [0, 0],
      [0, 0]
    ];
    shape.outTangents = [
      [0, 0],
      [0, 0]
    ];
    shape.closed = false;
    pathProp.property("Path").setValue(shape);

    applySvgPaint(grpContents, attrs, false, compName);
  }

  function addSvgPolyline(parentContents, attrs, closed, svgData, scaleData, compName) {
    var points = parseSvgPoints(attrs.points || "", svgData.width, svgData.height);
    if (!points.length) return;

    var grp = parentContents.addProperty("ADBE Vector Group");
    grp.name = attrs && attrs.id ? attrs.id : closed ? "Polygon" : "Polyline";
    var grpContents = grp.property("Contents");

    var pathProp = grpContents.addProperty("ADBE Vector Shape - Group");
    var shape = new Shape();
    shape.vertices = points;
    shape.inTangents = buildTangents(points.length);
    shape.outTangents = buildTangents(points.length);
    shape.closed = closed;
    pathProp.property("Path").setValue(shape);

    applySvgPaint(grpContents, attrs, closed, compName);
  }

  function addSvgPath(parentContents, attrs, svgData, scaleData, compName) {
    var d = attrs.d;
    if (!d) return;

    debugLog("SVG: path d len=" + String(d).length + " transform=" + (attrs.transform ? "yes" : "no"));
    var subpaths = parseSvgPathData(d, svgData);
    var tr = parseSvgTransform(attrs.transform);
    if (tr) {
      for (var t = 0; t < subpaths.length; t++) {
        applyTransformToSubpath(subpaths[t], tr);
      }
    }
    debugLog("SVG: subpaths=" + subpaths.length);
    for (var i = 0; i < subpaths.length; i++) {
      var sp = subpaths[i];
      if (!sp || !sp.points.length) continue;
      if (AE2_DEBUG) {
        var p0 = sp.points[0];
        var pLast = sp.points[sp.points.length - 1];
        debugLog(
          "SVG: path points=" +
            sp.points.length +
            " first=" +
            (p0 ? p0[0] + "," + p0[1] : "n/a") +
            " last=" +
            (pLast ? pLast[0] + "," + pLast[1] : "n/a")
        );
      }
      if (!allSvgPointsFinite(sp.points)) {
        debugLog("SVG: skipping path with invalid points");
        continue;
      }

      var grp = parentContents.addProperty("ADBE Vector Group");
      grp.name = attrs && attrs.id ? attrs.id : "Path";
      var grpContents = grp.property("Contents");

      var pathProp = grpContents.addProperty("ADBE Vector Shape - Group");
      var shape = new Shape();
      shape.vertices = sp.points;
      shape.inTangents = sp.inTangents || buildTangents(sp.points.length);
      shape.outTangents = sp.outTangents || buildTangents(sp.points.length);
      shape.closed = sp.closed;
      pathProp.property("Path").setValue(shape);

      applySvgPaint(grpContents, attrs, sp.closed, compName);
    }
  }

  function parseSvgPoints(value, width, height) {
    var nums = String(value).replace(/,/g, " ").match(/-?\d*\.?\d+(?:e[-+]?\d+)?%?/gi);
    var out = [];
    if (!nums) return out;
    for (var i = 0; i < nums.length; i += 2) {
      var x = parseSvgLength(nums[i], width, NaN);
      var y = parseSvgLength(nums[i + 1], height, NaN);
      if (isNaN(x) || isNaN(y)) continue;
      out.push([x, y]);
    }
    return out;
  }

  function parseSvgPathNumber(token, axisLength) {
    if (token === undefined || token === null) return 0;
    var s = String(token);
    if (s.indexOf("%") !== -1) {
      var pct = parseFloat(s);
      if (isNaN(pct)) return 0;
      if (axisLength > 0) return (pct / 100) * axisLength;
      return 0;
    }
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function parseSvgPathData(d, svgData) {
    var tokens = tokenizeSvgPathData(d);
    var out = [];
    if (!tokens) return out;
    debugLog("SVG: path tokens=" + tokens.length);

    var i = 0;
    var cmd = "";
    var x = 0;
    var y = 0;
    var startX = 0;
    var startY = 0;
    var sub = null;
    var lastC2 = null;
    var lastQ = null;
    var hasZ = /[zZ]/.test(d);
    var safety = 0;

    function startSubpath(px, py) {
      if (sub && sub.points.length) out.push(sub);
      sub = { points: [], inTangents: [], outTangents: [], closed: false };
      sub.points.push([px, py]);
      sub.inTangents.push([0, 0]);
      sub.outTangents.push([0, 0]);
      x = px;
      y = py;
      startX = px;
      startY = py;
      lastC2 = null;
      lastQ = null;
    }

    function ensureSubpath() {
      if (!sub) startSubpath(x, y);
    }

    function addLine(px, py) {
      ensureSubpath();
      sub.points.push([px, py]);
      sub.inTangents.push([0, 0]);
      sub.outTangents.push([0, 0]);
      x = px;
      y = py;
      lastC2 = null;
      lastQ = null;
    }

    function addCubic(c1x, c1y, c2x, c2y, px, py) {
      ensureSubpath();
      var lastIndex = sub.points.length - 1;
      sub.outTangents[lastIndex] = [c1x - x, c1y - y];
      sub.points.push([px, py]);
      sub.inTangents.push([c2x - px, c2y - py]);
      sub.outTangents.push([0, 0]);
      x = px;
      y = py;
      lastC2 = [c2x, c2y];
      lastQ = null;
    }

    function addQuadratic(q1x, q1y, px, py) {
      var c1x = x + (2 / 3) * (q1x - x);
      var c1y = y + (2 / 3) * (q1y - y);
      var c2x = px + (2 / 3) * (q1x - px);
      var c2y = py + (2 / 3) * (q1y - py);
      addCubic(c1x, c1y, c2x, c2y, px, py);
      lastQ = [q1x, q1y];
    }

    while (i < tokens.length) {
      safety++;
      if (safety > 10000) {
        debugLog("SVG: path parse abort (safety) at i=" + i + " cmd=" + cmd);
        break;
      }
      if (safety % 200 === 0) {
        debugLog("SVG: path parse progress i=" + i + " cmd=" + cmd);
      }
      var prevI = i;
      var t = tokens[i++];
      if (/[a-zA-Z]/.test(t)) {
        cmd = t;
      } else {
        i--;
      }

      if (cmd === "M" || cmd === "m") {
        var first = true;
        if (i + 1 >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete M at i=" + i);
          i = tokens.length;
          break;
        }
        while (i + 1 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var px = parseSvgPathNumber(tokens[i++], svgData.width);
          var py = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "m") {
            px += x;
            py += y;
          }
          if (first) {
            startSubpath(px, py);
            first = false;
          } else {
            addLine(px, py);
          }
        }
      } else if (cmd === "L" || cmd === "l") {
        if (i + 1 >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete L at i=" + i);
          i = tokens.length;
          break;
        }
        while (i + 1 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var lx = parseSvgPathNumber(tokens[i++], svgData.width);
          var ly = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "l") {
            lx += x;
            ly += y;
          }
          addLine(lx, ly);
        }
      } else if (cmd === "H" || cmd === "h") {
        if (i >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete H at i=" + i);
          i = tokens.length;
          break;
        }
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var hx = parseSvgPathNumber(tokens[i++], svgData.width);
          if (cmd === "h") hx += x;
          addLine(hx, y);
        }
      } else if (cmd === "V" || cmd === "v") {
        if (i >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete V at i=" + i);
          i = tokens.length;
          break;
        }
        while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var vy = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "v") vy += y;
          addLine(x, vy);
        }
      } else if (cmd === "C" || cmd === "c") {
        if (i + 5 >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete C at i=" + i);
          i = tokens.length;
          break;
        }
        while (i + 5 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var c1x = parseSvgPathNumber(tokens[i++], svgData.width);
          var c1y = parseSvgPathNumber(tokens[i++], svgData.height);
          var c2x = parseSvgPathNumber(tokens[i++], svgData.width);
          var c2y = parseSvgPathNumber(tokens[i++], svgData.height);
          var cx = parseSvgPathNumber(tokens[i++], svgData.width);
          var cy = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "c") {
            c1x += x;
            c1y += y;
            c2x += x;
            c2y += y;
            cx += x;
            cy += y;
          }
          addCubic(c1x, c1y, c2x, c2y, cx, cy);
        }
      } else if (cmd === "S" || cmd === "s") {
        if (i + 3 >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete S at i=" + i);
          i = tokens.length;
          break;
        }
        while (i + 3 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var s2x = parseSvgPathNumber(tokens[i++], svgData.width);
          var s2y = parseSvgPathNumber(tokens[i++], svgData.height);
          var sx = parseSvgPathNumber(tokens[i++], svgData.width);
          var sy = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "s") {
            s2x += x;
            s2y += y;
            sx += x;
            sy += y;
          }
          var refl = lastC2 ? [2 * x - lastC2[0], 2 * y - lastC2[1]] : [x, y];
          addCubic(refl[0], refl[1], s2x, s2y, sx, sy);
        }
      } else if (cmd === "Q" || cmd === "q") {
        if (i + 3 >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete Q at i=" + i);
          i = tokens.length;
          break;
        }
        while (i + 3 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var q1x = parseSvgPathNumber(tokens[i++], svgData.width);
          var q1y = parseSvgPathNumber(tokens[i++], svgData.height);
          var qx = parseSvgPathNumber(tokens[i++], svgData.width);
          var qy = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "q") {
            q1x += x;
            q1y += y;
            qx += x;
            qy += y;
          }
          addQuadratic(q1x, q1y, qx, qy);
        }
      } else if (cmd === "T" || cmd === "t") {
        if (i + 1 >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete T at i=" + i);
          i = tokens.length;
          break;
        }
        while (i + 1 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var tx = parseSvgPathNumber(tokens[i++], svgData.width);
          var ty = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "t") {
            tx += x;
            ty += y;
          }
          var tq = lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
          addQuadratic(tq[0], tq[1], tx, ty);
        }
      } else if (cmd === "A" || cmd === "a") {
        if (i + 6 >= tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          debugLog("SVG: path incomplete A at i=" + i);
          i = tokens.length;
          break;
        }
        while (i + 6 < tokens.length && !/[a-zA-Z]/.test(tokens[i])) {
          var rx = parseFloat(tokens[i++]);
          var ry = parseFloat(tokens[i++]);
          var xAxisRotation = parseFloat(tokens[i++]);
          var largeArcFlag = parseFloat(tokens[i++]);
          var sweepFlag = parseFloat(tokens[i++]);
          var ax = parseSvgPathNumber(tokens[i++], svgData.width);
          var ay = parseSvgPathNumber(tokens[i++], svgData.height);
          if (cmd === "a") {
            ax += x;
            ay += y;
          }
          if (!isFinite(rx) || !isFinite(ry) || rx === 0 || ry === 0) {
            addLine(ax, ay);
            continue;
          }
          var curves = arcToCubicCurves(
            x,
            y,
            rx,
            ry,
            xAxisRotation,
            largeArcFlag,
            sweepFlag,
            ax,
            ay
          );
          for (var ci = 0; ci < curves.length; ci++) {
            var c = curves[ci];
            addCubic(c[0], c[1], c[2], c[3], c[4], c[5]);
          }
        }
      } else if (cmd === "Z" || cmd === "z") {
        if (sub) {
          sub.closed = true;
          x = startX;
          y = startY;
          lastC2 = null;
          lastQ = null;
        }
      } else {
        // Unsupported path commands are ignored.
        cmd = "";
      }

      if (i === prevI) {
        debugLog("SVG: path parse stuck at i=" + i + " cmd=" + cmd + " token=" + tokens[i]);
        break;
      }
    }

    if (hasZ && sub && !sub.closed) {
      sub.closed = true;
    }
    if (sub && sub.points.length) out.push(sub);
    return out;
  }

  function tokenizeSvgPathData(d) {
    var s = String(d);
    var tokens = [];
    var i = 0;
    var len = s.length;

    function isSpace(ch) {
      return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
    }

    function isDigit(ch) {
      return ch >= "0" && ch <= "9";
    }

    function isLetter(ch) {
      return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
    }

    while (i < len) {
      var ch = s.charAt(i);
      if (isSpace(ch) || ch === ",") {
        i++;
        continue;
      }
      if (isLetter(ch)) {
        tokens.push(ch);
        i++;
        continue;
      }

      var start = i;
      if (ch === "+" || ch === "-") i++;
      var hasDot = false;
      while (i < len) {
        var c = s.charAt(i);
        if (isDigit(c)) {
          i++;
          continue;
        }
        if (c === "." && !hasDot) {
          hasDot = true;
          i++;
          continue;
        }
        break;
      }
      if (i < len && (s.charAt(i) === "e" || s.charAt(i) === "E")) {
        i++;
        if (i < len && (s.charAt(i) === "+" || s.charAt(i) === "-")) i++;
        while (i < len && isDigit(s.charAt(i))) i++;
      }
      if (i < len && s.charAt(i) === "%") i++;

      if (i > start) {
        tokens.push(s.substring(start, i));
      } else {
        i++;
      }
    }

    return tokens;
  }

  function arcToCubicCurves(x1, y1, rx, ry, angle, largeArcFlag, sweepFlag, x2, y2) {
    var out = [];
    var rad = (parseFloat(angle) || 0) * (Math.PI / 180);
    var cosPhi = Math.cos(rad);
    var sinPhi = Math.sin(rad);

    var dx = (x1 - x2) / 2;
    var dy = (y1 - y2) / 2;
    var x1p = cosPhi * dx + sinPhi * dy;
    var y1p = -sinPhi * dx + cosPhi * dy;

    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (rx === 0 || ry === 0) return out;

    var lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
      var s = Math.sqrt(lambda);
      rx *= s;
      ry *= s;
    }

    var rx2 = rx * rx;
    var ry2 = ry * ry;
    var x1p2 = x1p * x1p;
    var y1p2 = y1p * y1p;
    var sign = largeArcFlag == sweepFlag ? -1 : 1;
    var sq = (rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2) / (rx2 * y1p2 + ry2 * x1p2);
    if (sq < 0) sq = 0;
    var coef = sign * Math.sqrt(sq);
    var cxp = (coef * rx * y1p) / ry;
    var cyp = (coef * -ry * x1p) / rx;

    var cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    var cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

    var vx1 = (x1p - cxp) / rx;
    var vy1 = (y1p - cyp) / ry;
    var vx2 = (-x1p - cxp) / rx;
    var vy2 = (-y1p - cyp) / ry;

    var theta1 = Math.atan2(vy1, vx1);
    var delta = Math.atan2(vx1 * vy2 - vy1 * vx2, vx1 * vx2 + vy1 * vy2);

    if (!sweepFlag && delta > 0) {
      delta -= Math.PI * 2;
    } else if (sweepFlag && delta < 0) {
      delta += Math.PI * 2;
    }

    var segments = Math.ceil(Math.abs(delta) / (Math.PI / 2));
    var deltaSeg = delta / segments;

    for (var i = 0; i < segments; i++) {
      var t1 = theta1 + i * deltaSeg;
      var t2 = t1 + deltaSeg;

      var sinT1 = Math.sin(t1);
      var cosT1 = Math.cos(t1);
      var sinT2 = Math.sin(t2);
      var cosT2 = Math.cos(t2);

      var alpha = (4 / 3) * Math.tan(deltaSeg / 4);

      var x1c = cosT1 - alpha * sinT1;
      var y1c = sinT1 + alpha * cosT1;
      var x2c = cosT2 + alpha * sinT2;
      var y2c = sinT2 - alpha * cosT2;
      var x2p = cosT2;
      var y2p = sinT2;

      var p1 = mapEllipsePoint(x1c, y1c, rx, ry, cosPhi, sinPhi, cx, cy);
      var p2 = mapEllipsePoint(x2c, y2c, rx, ry, cosPhi, sinPhi, cx, cy);
      var p = mapEllipsePoint(x2p, y2p, rx, ry, cosPhi, sinPhi, cx, cy);

      out.push([p1.x, p1.y, p2.x, p2.y, p.x, p.y]);
    }

    return out;
  }

  function mapEllipsePoint(x, y, rx, ry, cosPhi, sinPhi, cx, cy) {
    var xp = x * rx;
    var yp = y * ry;
    var xr = cosPhi * xp - sinPhi * yp;
    var yr = sinPhi * xp + cosPhi * yp;
    return { x: xr + cx, y: yr + cy };
  }

  function allSvgPointsFinite(points) {
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!p || p.length < 2) return false;
      if (!isFinite(p[0]) || !isFinite(p[1])) return false;
    }
    return true;
  }

  function buildTangents(len) {
    var arr = [];
    for (var i = 0; i < len; i++) arr.push([0, 0]);
    return arr;
  }

  function parseSvgLength(value, axisLength, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    var s = String(value);
    if (s.indexOf("%") !== -1) {
      var pct = parseFloat(s);
      if (isNaN(pct)) return fallback;
      if (axisLength > 0) return (pct / 100) * axisLength;
    }
    var n = parseFloat(s);
    return isNaN(n) ? fallback : n;
  }

  function getSvgNormalizedLength(width, height) {
    var w = parseNumber(width, 0);
    var h = parseNumber(height, 0);
    if (w <= 0 || h <= 0) return 0;
    return Math.sqrt((w * w + h * h) / 2);
  }

  function applySvgPaint(grpContents, attrs, defaultFillOn, compName) {
    var fillColor = parseSvgColor(attrs.fill);
    var strokeColor = parseSvgColor(attrs.stroke);
    var strokeWidth = parseNumber(attrs["stroke-width"], 1);
    var opacity = parseNumber(attrs.opacity, 1);
    var fillOpacity = parseNumber(attrs["fill-opacity"], 1);
    var strokeOpacity = parseNumber(attrs["stroke-opacity"], 1);
    var dashArray = parseSvgDashArray(attrs["stroke-dasharray"]);
    var dashOffset = parseNumber(attrs["stroke-dashoffset"], 0);

    if (defaultFillOn && !attrs.fill) {
      fillColor = fillColor || { rgb: [0, 0, 0], alpha: 1 };
    }

    var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
    if (fillColor) {
      applyRgbColorProperty(fill.property("Color"), fillColor.rgb, fillColor.alpha, compName);
      fill.property("Opacity").setValue(opacity * fillOpacity * fillColor.alpha * 100);
      fill.enabled = true;
    } else {
      fill.enabled = false;
    }

    var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
    if (strokeColor && strokeWidth > 0) {
      applyRgbColorProperty(stroke.property("Color"), strokeColor.rgb, strokeColor.alpha, compName);
      stroke.property("Stroke Width").setValue(strokeWidth);
      stroke.property("Opacity").setValue(opacity * strokeOpacity * strokeColor.alpha * 100);
      stroke.enabled = true;
      if (dashArray) {
        var dashes = stroke.property("ADBE Vector Stroke Dashes") || stroke.property("Dashes");
        if (dashes) {
          var pairCount = Math.min(3, Math.floor(dashArray.length / 2));
          for (var i = 0; i < pairCount; i++) {
            var dashVal = dashArray[i * 2];
            var gapVal = dashArray[i * 2 + 1];
            var dashMatch = "ADBE Vector Stroke Dash " + (i + 1);
            var gapMatch = "ADBE Vector Stroke Gap " + (i + 1);
            var dashProp = null;
            var gapProp = null;
            try {
              dashProp = dashes.addProperty(dashMatch);
            } catch (e) {
              dashProp = dashes.property(dashMatch);
            }
            try {
              gapProp = dashes.addProperty(gapMatch);
            } catch (e2) {
              gapProp = dashes.property(gapMatch);
            }
            if (dashProp) dashProp.setValue(dashVal);
            if (gapProp && typeof gapVal === "number") gapProp.setValue(gapVal);
          }
          if (!isNaN(dashOffset) && dashOffset !== 0) {
            var offsetProp = dashes.property("ADBE Vector Stroke Offset");
            if (offsetProp) offsetProp.setValue(dashOffset);
          }
        }
      }
    } else {
      stroke.enabled = false;
    }
  }

  function parseSvgStyleAttributes(attrs) {
    if (!attrs || !attrs.style) return attrs || {};
    var styleText = String(attrs.style);
    var out = {};
    for (var k in attrs) out[k] = attrs[k];
    var parts = styleText.split(";");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      var idx = part.indexOf(":");
      if (idx === -1) continue;
      var key = trim(part.substring(0, idx)).toLowerCase();
      var val = trim(part.substring(idx + 1));
      if (!key) continue;
      out[key] = val;
    }
    return out;
  }

  function parseSvgLengthList(value, axisLength, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    var m = String(value).match(/-?\d*\.?\d+(?:e[-+]?\d+)?%?/i);
    if (!m) return fallback;
    return parseSvgLength(m[0], axisLength, fallback);
  }

  function getSvgScaleData(svgData, localBBox) {
    var scaleX = localBBox.w / svgData.width;
    var scaleY = localBBox.h / svgData.height;
    var preserve = String(svgData.preserveAspectRatio || "").toLowerCase();
    var useNonUniformScale = preserve.indexOf("none") !== -1;
    var scale = useNonUniformScale ? 1 : Math.min(scaleX, scaleY);
    var padX = useNonUniformScale ? 0 : (localBBox.w - svgData.width * scale) / 2;
    var padY = useNonUniformScale ? 0 : (localBBox.h - svgData.height * scale) / 2;
    return {
      scaleX: scaleX,
      scaleY: scaleY,
      scale: scale,
      padX: padX,
      padY: padY,
      useNonUniformScale: useNonUniformScale
    };
  }

  function mapSvgPoint(x, y, svgData, localBBox, scaleData) {
    var sd = scaleData || getSvgScaleData(svgData, localBBox);
    var mx = sd.useNonUniformScale ? (x - svgData.minX) * sd.scaleX + sd.padX : (x - svgData.minX) * sd.scale + sd.padX;
    var my = sd.useNonUniformScale ? (y - svgData.minY) * sd.scaleY + sd.padY : (y - svgData.minY) * sd.scale + sd.padY;
    return { x: mx, y: my };
  }

  function normalizeSvgTextContent(text, attrs) {
    var content = String(text || "");
    var space = attrs && attrs["xml:space"] ? String(attrs["xml:space"]).toLowerCase() : "";
    if (space === "preserve") return content;
    return content.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function mapSvgTextAnchor(value) {
    var v = String(value || "").toLowerCase();
    if (v === "middle" || v === "center") return "center";
    if (v === "end" || v === "right") return "right";
    return "left";
  }

  function applySvgTextBaseline(layer, attrs) {
    var r = layer.sourceRectAtTime(0, false);
    var anchorY = r.top + r.height;
    var baseline = attrs && (attrs["dominant-baseline"] || attrs["alignment-baseline"]);
    var b = String(baseline || "").toLowerCase();
    if (b === "middle" || b === "central") {
      anchorY = r.top + r.height / 2;
    } else if (b === "hanging" || b === "text-before-edge") {
      anchorY = r.top;
    }
    return anchorY;
  }

  function addSvgTextLayer(
    comp,
    parentLayer,
    el,
    svgData,
    localBBox,
    extraOpacity,
    extraTransform,
    rootSvgData
  ) {
    if (!el || !el.text) return;
    var attrs = parseSvgStyleAttributes(el.attrs || {});
    var text = normalizeSvgTextContent(el.text, attrs);
    if (!text) return;

    var baseSvgData = rootSvgData || svgData;
    var scaleData = getSvgScaleData(baseSvgData, localBBox);
    var pos = { x: 0, y: 0 };
    var hasTextPath = !!el.pathRef;
    if (!hasTextPath) {
      var x = parseSvgLengthList(attrs.x, baseSvgData.width, 0);
      var y = parseSvgLengthList(attrs.y, baseSvgData.height, 0);
      pos = mapSvgPoint(x, y, baseSvgData, localBBox, scaleData);
      if (extraTransform && extraTransform.length >= 6) {
        var tx = extraTransform[4] || 0;
        var ty = extraTransform[5] || 0;
        if (tx !== 0 || ty !== 0) {
          if (scaleData.useNonUniformScale) {
            pos.x += tx * scaleData.scaleX;
            pos.y += ty * scaleData.scaleY;
          } else {
            pos.x += tx * scaleData.scale;
            pos.y += ty * scaleData.scale;
          }
        }
      }
    }

    var layer = comp.layers.addText(text);
    layer.name = safeName("svg-text");

    var textProp = layer.property("Text").property("Source Text");
    var doc = textProp.value;
    if (doc && doc.resetCharStyle) doc.resetCharStyle();

    var family = attrs["font-family"];
    var weight = attrs["font-weight"];
    var style = attrs["font-style"] || "normal";
    if (family) {
      var candidates = buildFontCandidates(family, weight, style);
      applyFontWithFallback(doc, candidates);
    }

    var sizePx = parseSvgLength(attrs["font-size"], baseSvgData.height, null);
    if (sizePx !== null) {
      var scaledSize = sizePx * (scaleData.useNonUniformScale ? scaleData.scaleY : scaleData.scale);
      var clamped = clampFontSize(scaledSize);
      if (clamped !== null) doc.fontSize = clamped;
    }

    var letterSpacing = parseSvgLength(attrs["letter-spacing"], doc.fontSize || 0, null);
    if (letterSpacing !== null) {
      var scaledSpacing = letterSpacing * (scaleData.useNonUniformScale ? scaleData.scaleX : scaleData.scale);
      doc.tracking = toAETracking(scaledSpacing);
    }

    var hasExplicitFill =
      typeof attrs.fill !== "undefined" || typeof attrs.color !== "undefined";
    var fillColor = parseSvgColor(attrs.fill) || parseSvgColor(attrs.color);
    if (!fillColor && !hasExplicitFill) {
      fillColor = { rgb: [0, 0, 0], alpha: 1 };
    }

    doc.fillColor = [1, 1, 1];
    doc.applyFill = true;
    if (!fillColor || fillColor.alpha === 0) {
      doc.applyFill = false;
    }

    doc.justification = mapTextAlign(mapSvgTextAnchor(attrs["text-anchor"]));
    textProp.setValue(doc);

    if (fillColor && fillColor.alpha > 0) {
      applyFillEffect(layer, fillColor.rgb, fillColor.alpha);
    }

    if (hasTextPath) {
      var pathEl = findSvgPathById(baseSvgData, el.pathRef);
      var textPathShape = buildSvgTextPathShape(pathEl, baseSvgData, localBBox, extraTransform);
      if (textPathShape) {
        var masks = layer.property("ADBE Mask Parade") || layer.property("Masks");
        var mask = masks ? masks.addProperty("ADBE Mask Atom") : null;
        if (!mask && masks) mask = masks.addProperty("Mask");
        if (mask) {
          var maskShapeProp = mask.property("ADBE Mask Shape") || mask.property("Mask Path");
          if (maskShapeProp) maskShapeProp.setValue(textPathShape);
          var pathOptions =
            layer.property("Text").property("ADBE Text Path Options") ||
            layer.property("Text").property("Path Options");
          if (pathOptions) {
            var pathProp = pathOptions.property("ADBE Text Path") || pathOptions.property("Path");
            if (pathProp) {
              try {
                pathProp.setValue(mask.index);
              } catch (e) {
                pathProp.setValue(1);
              }
            }
          }
        }
      }
      layer.property("Transform").property("Anchor Point").setValue([0, 0]);
      layer.property("Transform").property("Position").setValue([0, 0]);
    } else {
      layer.property("Transform").property("Anchor Point").setValue([0, 0]);
      layer.property("Transform").property("Position").setValue([pos.x, pos.y]);
    }

    var opacity = parseNumber(attrs.opacity, 1);
    var fillOpacity = parseNumber(attrs["fill-opacity"], 1);
    var extra = typeof extraOpacity === "number" ? extraOpacity : 1;
    layer.property("Transform").property("Opacity").setValue(opacity * fillOpacity * extra * 100);

    // Do not parent SVG text to avoid double transforms; position is absolute in comp space.
    return layer;
  }

  function getSvgFallbackSize(localBBox, rootData) {
    var vbW = 0;
    var vbH = 0;
    if (rootData && rootData.viewport) {
      vbW = Number(rootData.viewport.sourceWidth) || 0;
      vbH = Number(rootData.viewport.sourceHeight) || 0;
    }
    if (vbW > 0 && vbH > 0) return { w: vbW, h: vbH };
    var w = localBBox && localBBox.w ? localBBox.w : 0;
    var h = localBBox && localBBox.h ? localBBox.h : 0;
    return { w: w, h: h };
  }

  function parseSvgDashArray(value) {
    if (!value) return null;
    var s = String(value).trim().toLowerCase();
    if (!s || s === "none") return null;
    var nums = s.replace(/,/g, " ").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
    if (!nums || !nums.length) return null;
    var out = [];
    var hasPositive = false;
    for (var i = 0; i < nums.length; i++) {
      var v = parseFloat(nums[i]);
      if (isNaN(v) || v < 0) continue;
      if (v > 0) hasPositive = true;
      out.push(v);
    }
    if (!out.length || !hasPositive) return null;
    if (out.length % 2 === 1) out = out.concat(out);
    return out;
  }

  function parseSvgColor(value) {
    if (!value) return null;
    var s = String(value).toLowerCase();
    if (s === "none" || s === "transparent") return null;
    if (s.indexOf("url(") === 0) return null;
    if (s === "currentcolor") return null;
    var named = namedSvgColor(s);
    if (named) return named;
    if (s.indexOf("rgb") === 0) return parseCssColorWithAlpha(s);
    if (s.charAt(0) === "#") return parseHexColor(s);
    return null;
  }

  function parseSvgTransform(value) {
    if (!value) return null;
    var s = String(value);
    var re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
    var match = null;
    var m = [1, 0, 0, 1, 0, 0];
    while ((match = re.exec(s)) !== null) {
      var fn = match[1].toLowerCase();
      var nums = String(match[2]).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
      var t = null;
      if (fn === "matrix" && nums.length >= 6) {
        t = [
          parseFloat(nums[0]),
          parseFloat(nums[1]),
          parseFloat(nums[2]),
          parseFloat(nums[3]),
          parseFloat(nums[4]),
          parseFloat(nums[5])
        ];
      } else if (fn === "translate") {
        var tx = parseFloat(nums[0] || 0);
        var ty = parseFloat(nums[1] || 0);
        t = [1, 0, 0, 1, tx, ty];
      } else if (fn === "scale") {
        var sx = parseFloat(nums[0] || 1);
        var sy = nums.length > 1 ? parseFloat(nums[1]) : sx;
        t = [sx, 0, 0, sy, 0, 0];
      } else if (fn === "rotate" && nums.length >= 1) {
        var ang = (parseFloat(nums[0]) * Math.PI) / 180;
        var cosA = Math.cos(ang);
        var sinA = Math.sin(ang);
        var rot = [cosA, sinA, -sinA, cosA, 0, 0];
        if (nums.length >= 3) {
          var cx = parseFloat(nums[1]);
          var cy = parseFloat(nums[2]);
          t = multiplySvgMatrix([1, 0, 0, 1, cx, cy], multiplySvgMatrix(rot, [1, 0, 0, 1, -cx, -cy]));
        } else {
          t = rot;
        }
      } else if (fn === "skewx" && nums.length >= 1) {
        var ax = (parseFloat(nums[0]) * Math.PI) / 180;
        t = [1, 0, Math.tan(ax), 1, 0, 0];
      } else if (fn === "skewy" && nums.length >= 1) {
        var ay = (parseFloat(nums[0]) * Math.PI) / 180;
        t = [1, Math.tan(ay), 0, 1, 0, 0];
      }

      if (t) {
        m = multiplySvgMatrix(t, m);
      }
    }
    return m;
  }

  function multiplySvgMatrix(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }

  function applySvgMatrixToPoint(p, m) {
    return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  }

  function applySvgMatrixToVector(v, m) {
    return [m[0] * v[0] + m[2] * v[1], m[1] * v[0] + m[3] * v[1]];
  }

  function applyTransformToSubpath(sp, m) {
    if (!sp || !sp.points) return;
    for (var i = 0; i < sp.points.length; i++) {
      sp.points[i] = applySvgMatrixToPoint(sp.points[i], m);
      if (sp.inTangents && sp.inTangents[i]) {
        sp.inTangents[i] = applySvgMatrixToVector(sp.inTangents[i], m);
      }
      if (sp.outTangents && sp.outTangents[i]) {
        sp.outTangents[i] = applySvgMatrixToVector(sp.outTangents[i], m);
      }
    }
  }

  function findSvgPathById(svgData, id) {
    if (!svgData || !svgData.elements || !id) return null;
    for (var i = 0; i < svgData.elements.length; i++) {
      var el = svgData.elements[i];
      if (!el || el.tag !== "path") continue;
      var attrs = el.attrs || {};
      if (attrs.id === id) return el;
    }
    return null;
  }

  function mapSvgVectorToComp(vec, scaleData) {
    if (!vec) return [0, 0];
    if (scaleData.useNonUniformScale) {
      return [vec[0] * scaleData.scaleX, vec[1] * scaleData.scaleY];
    }
    return [vec[0] * scaleData.scale, vec[1] * scaleData.scale];
  }

  function buildSvgTextPathShape(pathEl, svgData, localBBox, extraTransform) {
    if (!pathEl || !pathEl.attrs || !pathEl.attrs.d) return null;
    var subpaths = parseSvgPathData(pathEl.attrs.d, svgData);
    if (!subpaths.length) return null;
    var tr = parseSvgTransform(pathEl.attrs.transform);
    if (tr) {
      for (var t = 0; t < subpaths.length; t++) {
        applyTransformToSubpath(subpaths[t], tr);
      }
    }
    if (extraTransform && extraTransform.length >= 6) {
      for (var j = 0; j < subpaths.length; j++) {
        applyTransformToSubpath(subpaths[j], extraTransform);
      }
    }

    var sp = subpaths[0];
    if (!sp || !sp.points || !sp.points.length) return null;
    if (!allSvgPointsFinite(sp.points)) return null;

    var scaleData = getSvgScaleData(svgData, localBBox);
    var shape = new Shape();
    var verts = [];
    var inT = [];
    var outT = [];
    for (var i = 0; i < sp.points.length; i++) {
      var p = sp.points[i];
      var mapped = mapSvgPoint(p[0], p[1], svgData, localBBox, scaleData);
      verts.push([mapped.x, mapped.y]);
      var inVec = sp.inTangents ? sp.inTangents[i] : [0, 0];
      var outVec = sp.outTangents ? sp.outTangents[i] : [0, 0];
      inT.push(mapSvgVectorToComp(inVec, scaleData));
      outT.push(mapSvgVectorToComp(outVec, scaleData));
    }

    shape.vertices = verts;
    shape.inTangents = inT;
    shape.outTangents = outT;
    shape.closed = sp.closed;
    return shape;
  }

  function namedSvgColor(name) {
    // Minimal named color support for common SVG values.
    if (name === "black") return { rgb: [0, 0, 0], alpha: 1 };
    if (name === "white") return { rgb: [1, 1, 1], alpha: 1 };
    if (name === "red") return { rgb: [1, 0, 0], alpha: 1 };
    if (name === "green") return { rgb: [0, 0.5, 0], alpha: 1 };
    if (name === "blue") return { rgb: [0, 0, 1], alpha: 1 };
    if (name === "gray" || name === "grey") return { rgb: [0.5, 0.5, 0.5], alpha: 1 };
    return null;
  }

  function parseHexColor(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) {
      var r = parseInt(h.charAt(0) + h.charAt(0), 16);
      var g = parseInt(h.charAt(1) + h.charAt(1), 16);
      var b = parseInt(h.charAt(2) + h.charAt(2), 16);
      return { rgb: [r / 255, g / 255, b / 255], alpha: 1 };
    }
    if (h.length === 4) {
      var rr4 = parseInt(h.charAt(0) + h.charAt(0), 16);
      var gg4 = parseInt(h.charAt(1) + h.charAt(1), 16);
      var bb4 = parseInt(h.charAt(2) + h.charAt(2), 16);
      var aa4 = parseInt(h.charAt(3) + h.charAt(3), 16);
      return { rgb: [rr4 / 255, gg4 / 255, bb4 / 255], alpha: aa4 / 255 };
    }
    if (h.length >= 6) {
      var rr = parseInt(h.substr(0, 2), 16);
      var gg = parseInt(h.substr(2, 2), 16);
      var bb = parseInt(h.substr(4, 2), 16);
      var aa = h.length >= 8 ? parseInt(h.substr(6, 2), 16) : 255;
      return { rgb: [rr / 255, gg / 255, bb / 255], alpha: aa / 255 };
    }
    return null;
  }

  function parseCssColorWithAlpha(css) {
    if (!css) return null;
    var s = String(css).toLowerCase();
    var m = s.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    var a = m.length >= 4 ? parseFloat(m[3]) : 1;
    if (isNaN(a)) a = 1;
    return {
      rgb: [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255],
      alpha: a
    };
  }

