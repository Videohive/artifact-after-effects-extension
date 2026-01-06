$.ae = {
  expression: {},

  validControlLayer: function (layer) {
    function isNameValid(name, validNames) {
      for (var i = 0; i < validNames.length; i++) {
        if (name === validNames[i]) {
          return true; // Имя слоя найдено в списке валидных имен
        }
      }
      return false; // Имя слоя не найдено в списке валидных имен
    }

    function isEffectsValid(layer) {
      var valid = true;
      for (var i = 1; i <= layer.Effects.numProperties; i++) {
        var effect = layer.Effects(i);
        valid =
          effect(1).isDropdownEffect ||
          isNameValid(effect.matchName, $.CONTROL_EFFECT_MATCH_NAMES);

        if (!valid) {
          return false;
        }
      }

      return true;
    }

    if (layer.Effects && layer.Effects.numProperties) {
      if (
        (isNameValid(layer.name.toLowerCase(), $.CONTROL_LAYER_NAMES) &&
          isEffectsValid(layer)) ||
        (layer.source && layer.source.name.toLowerCase().includes("controls"))
      ) {
        return true;
      }
    }

    return false;
  },

  filePathDialog: function () {
    var f = File.openDialog("Select File");
    return f.fsName.toString();
  },

  validationName: function (name) {
    var invalidCharactersPattern = /[\\\/:*?"<>|\:]/;
    var foundChars = "";
    for (var i = 0; i < name.length; i++) {
      if (
        invalidCharactersPattern.test(name[i]) &&
        foundChars.indexOf(name[i]) === -1
      ) {
        foundChars += name[i] + " "; // Добавляем недопустимый символ к строке
      }
    }
    return foundChars;
  },

  checkPointText: function () {
    var paragraphText = [];
    for (var i = 1; i <= app.project.numItems; i++) {
      var comp = app.project.item(i);
      if (comp instanceof CompItem) {
        for (l = 1; l <= comp.numLayers; l++) {
          var layer = comp.layer(l);

          if (layer instanceof TextLayer) {
            var textProp = layer.property("Source Text");
            var textDocument = textProp.value;
            if (textDocument.boxText) {
              paragraphText.push(comp.name);
            }
          }
        }
      }
    }

    if (paragraphText.length == 0) {
      return true;
    } else {
      alert("Convert paragraph to point text\n" + paragraphText.join("\n"));
      return false;
    }
  },

  colorPicker: function (color) {
    var name = "Color Picker";
    app.executeCommand(2004); // Deselect all
    var comp = app.project.activeItem;
    var activeComp = false;

    // Проверяем наличие активной композиции
    if (comp && comp instanceof CompItem) {
      activeComp = true;
    } else {
      comp = app.project.items.addComp(name, 10, 10, 1, 1, 30); // Создаем временную композицию
    }

    // Добавляем слой с контролем цвета
    var layer = comp.layers.addShape();
    layer.name = name;
    var colorControl = layer.Effects.addProperty("ADBE Color Control");
    colorControl.name = name;
    colorControl(1).setValue(color);
    layer.moveToEnd(); // Перемещаем контрол в конец списка эффектов
    colorControl(1).selected = true;

    if (!activeComp) {
      comp.openInViewer(); // Открываем временную композицию в окне просмотра
    }

    app.executeCommand(2240); // Вызываем окно выбора цвета

    var colorValue = colorControl(1).value;
    colorValue.pop(); // Удаляем последнее значение, если это необходимо

    if (!activeComp) {
      comp.remove(); // Удаляем временную композицию
    } else {
      layer.remove();
    }

    return colorValue;
  },

  userFolder: function (projectName) {
    var authorName = "Harchenko";
    var scriptFolder = new Folder(Folder.userData.fsName + "/" + authorName);
    if (!scriptFolder.exists) scriptFolder.create();

    // Создаем папку для файлов проекта, если она не существует
    var filesFolder = new Folder(scriptFolder.fsName + "/" + projectName);
    if (!filesFolder.exists) filesFolder.create();

    var files = [
      "Double click here for help.jpg",
      "ma watermark.mp3",
      "preview watermark.mp3",
      "drop zone.tiff",
      "placeholder.png",
      "Placeholder.mp4",
      "After Effects Template Instructions.pdf",
      "Premiere Pro Template Instructions.pdf",
      "Motion Graphics Template Instructions.pdf",
      "Final Cut Pro Template Instructions.pdf",
      "Davinci Resolve Template Instructions.pdf",
      "Davinci Resolve Macros Instructions.pdf",
    ];

    // Создаем массив для хранения имен файлов, которые нужно добавить
    var requiredFiles = [];

    // Проверяем, существуют ли файлы в папке
    files.forEach(function (fileName) {
      var file = new File(filesFolder.fsName + "/" + fileName);
      if (!file.exists) {
        // Если файл не существует, добавляем его название в массив requiredFiles
        requiredFiles.push(fileName);
      }
    });

    // Возвращаем объект с путем и файлами
    return JSON.stringify({
      path: filesFolder.fsName,
      files: requiredFiles,
    });
  },

  layerID: function () {
    var comp = app.project.activeItem;
    if (!comp) {
      return false;
    }

    if (comp.selectedLayers.length == 0) {
      return false;
    }

    var layer = comp.selectedLayers[0];

    return JSON.stringify({
      id: layer.id,
      compName: comp.name,
      name: comp.name + " - " + layer.name,
    });
  },

  createProgressWindow: function (string) {
    // Загрузка
    var progressWindow = new Window("palette", string, undefined);
    progressWindow.add("statictext", undefined, string + ", please wait...");
    progressWindow.bar = progressWindow.add("progressbar", undefined, 0, 100);
    progressWindow.bar.preferredSize = [300, 20];
    progressWindow.show();

    return progressWindow;
  },

  toText: function (code) {
    //
    var string = code.toString();
    string = string.substring(string.indexOf("{") + 1, string.lastIndexOf("}"));
    return string;
  },

  expressionEngine: function () {
    if (app.project.expressionEngine == "extendscript") {
      alert(
        "Change Expression Engine to Java Script:\nProject Settings - Expression"
      );
      return false;
    }
    return true;
  },

  checkFileName: function (path, name) {
    // оригинальные имена с версией для Apple Motion
    var folder = new Folder(path);
    var files = folder.getFiles();
    var matchCount = 0;
    for (var i = 0; i < files.length; i++) {
      if (files[i] instanceof File) {
        var fileName = decodeURIComponent(files[i].name); // Декодируем специальные символы

        if (fileName.match(name)) {
          matchCount++;
        }
      }
    }
    if (matchCount >= 1) {
      var promptText = name + " v" + matchCount;
      return promptText;
    } else {
      return name;
    }
  },

  renameDuplicates: function () {
    // исправление дубликатов имен
    var comps = app.project.items;
    var compArray = [];
    var nameCounter = {};

    // Собираем все композиции в массив
    for (var i = 1; i <= comps.length; i++) {
      if (comps[i] instanceof CompItem) {
        compArray.push(comps[i]);
      }
    }

    // Функция для дополнения ведущих нулей
    function addLeadingZeros(number, length) {
      var numString = number.toString();
      while (numString.length < length) {
        numString = "0" + numString;
      }
      return numString;
    }

    // Обрабатываем все имена
    for (var i = 0; i < compArray.length; i++) {
      var comp = compArray[i];
      var baseName = comp.name;

      var matches = baseName.match(/(\d+)$/);
      if (matches) {
        var number = parseInt(matches[1]);
        var baseNameWithoutNumber = baseName.slice(
          0,
          baseName.lastIndexOf(matches[0])
        );

        // Если базовое имя уже было ранее, увеличиваем счетчик и добавляем его к имени
        if (nameCounter.hasOwnProperty(baseNameWithoutNumber)) {
          nameCounter[baseNameWithoutNumber]++;
          var newName =
            baseNameWithoutNumber +
            addLeadingZeros(
              nameCounter[baseNameWithoutNumber],
              matches[1].length
            );
          comp.name = newName;
        } else {
          nameCounter[baseNameWithoutNumber] = number; // Инициализируем счетчик для этого имени
        }
      } else {
        // Если имя не содержит чисел, добавляем его в счетчик с нулевым значением
        if (nameCounter.hasOwnProperty(baseName)) {
          nameCounter[baseName]++;
          comp.name =
            baseName + " " + addLeadingZeros(nameCounter[baseName], 2);
        } else {
          nameCounter[baseName] = 0; // Инициализируем счетчик для этого имени
        }
      }
    }
  },

  removeAllKeys: function (property) {
    while (property.numKeys > 0) {
      property.removeKey(1);
    }
  },

  unlockLayer: function () {
    for (var i = 1; i <= app.project.numItems; i++) {
      var comp = app.project.item(i);
      if (comp instanceof CompItem) {
        for (var l = 1; l <= comp.numLayers; l++) {
          var layer = comp.layer(l);
          if (layer.locked) {
            layer.locked = false;
          }
        }
      }
    }
  },

  deleteNullLayers: function (comp) {
    for (var i = comp.numLayers; i >= 1; i--) {
      var layer = comp.layer(i);
      if (layer.nullLayer) {
        layer.locked = false;
        layer.remove();
      }
    }
  },

  findMatch: function (matchName, nameArray) {
    var found = nameArray.find(function (name) {
      return name === matchName;
    });
    return found !== undefined ? matchName : false;
  },

  findPropertyLayer: function (property) {
    return property.propertyGroup(property.propertyDepth);
  },

  findCreateFolder: function (name, parentFolder) {
    for (var i = 1; i <= app.project.numItems; i++) {
      var item = app.project.item(i);
      if (
        item instanceof FolderItem &&
        item.name.toLowerCase() == name.toLowerCase()
      ) {
        return item;
      }
    }

    var newFolder = app.project.items.addFolder(name);
    parentFolder ? (newFolder.parentFolder = parentFolder) : null;

    return newFolder;
  },

  middleLayer: function (layer) {
    var comp = layer.containingComp;
    var inPoint = layer.inPoint;
    var outPoint = layer.outPoint;

    // Проверяем, не выходит ли слой за пределы композиции
    if (outPoint > comp.duration) {
      outPoint = comp.duration;
    }

    if (inPoint < 0) {
      inPoint = 0;
    }

    // Вычисляем продолжительность слоя с учетом ограничений композиции
    var layerDuration = outPoint - inPoint;

    // Возвращаем время середины слоя
    return inPoint + layerDuration / 2;
  },

  openTemplateFolder: function () {
    if (app.project.file) {
      var projectPath = app.project.file.path;
      var folder = new Folder(projectPath);
      folder.execute();
    } else {
      alert("Please Save Project");
    }
  },

  moveAnchor: function (anchor) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
      alert("Please select a composition.");
      return;
    }

    function anchorPositionKey(property, offset, cosR, sinR) {
      for (var i = 1; i <= property.numKeys; i++) {
        var key = i;
        var keyValue = property.keyValue(key);
        var newValue = [
          keyValue[0] + offset[0] * cosR - offset[1] * sinR,
          keyValue[1] + offset[0] * sinR + offset[1] * cosR,
          keyValue[2],
        ];

        property.setValueAtKey(key, newValue);
      }
    }

    function calculateBoundingBox(vertices) {
      var minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      vertices.forEach(function (vertex) {
        if (vertex[0] < minX) minX = vertex[0];
        if (vertex[0] > maxX) maxX = vertex[0];
        if (vertex[1] < minY) minY = vertex[1];
        if (vertex[1] > maxY) maxY = vertex[1];
      });

      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }

    function combineBounds(bounds) {
      if (bounds.length === 0) {
        return null; // возвращаем null, если массив пуст
      }

      var minX = Infinity;
      var maxX = -Infinity;
      var minY = Infinity;
      var maxY = -Infinity;

      for (var i = 0; i < bounds.length; i++) {
        var current = bounds[i];
        minX = Math.min(minX, current.left);
        maxX = Math.max(maxX, current.left + current.width);
        minY = Math.min(minY, current.top);
        maxY = Math.max(maxY, current.top + current.height);
      }

      return {
        left: minX,
        top: minY,
        width: maxX, // Здесь ширина всегда устанавливается в 500, как в вашем исходном коде
        height: maxY - minY,
      };
    }

    app.beginUndoGroup("Move Anchor");

    var layers = comp.selectedLayers;
    var curTime = comp.time;

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var layerAnchor = layer.anchorPoint.value;
      var layerMasks = layer.mask;
      var hasValidMasks = layerMasks && layerMasks.numProperties > 0;
      var matchType = layer.matchName;

      var layerRect;
      if (hasValidMasks) {
        var maskBounds = [];
        for (var m = 1; m <= layerMasks.numProperties; m++) {
          var mask = layerMasks.property(m);
          if (mask.maskMode !== MaskMode.NONE) {
            var maskPath = mask.property("maskShape");
            var maskVertices = maskPath.value.vertices;
            var maskBoundingBox = calculateBoundingBox(maskVertices);
            maskBounds.push(maskBoundingBox);
          }
        }
        layerRect = combineBounds(maskBounds);
      } else {
        layerRect = layer.sourceRectAtTime(curTime, false);
      }

      if (matchType == "ADBE Text Layer") {
        var textProp = layer.property("Source Text");
        var textDocument = textProp.value;
        var textParagraph = textDocument.justification;

        switch (textParagraph) {
          case ParagraphJustification.LEFT_JUSTIFY:
            textParagraph = "left";
            break;
          case ParagraphJustification.RIGHT_JUSTIFY:
            textParagraph = "right";
            break;
          case ParagraphJustification.CENTER_JUSTIFY:
            textParagraph = "center";
            break;
          case ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT:
            textParagraph = "left";
            break;
          case ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT:
            textParagraph = "right";
            break;
          case ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER:
            textParagraph = "center";
            break;
        }
      }

      var x = layerRect.width / 2;
      var y = layerRect.height / 2;
      var left = layerRect.left;
      var top = layerRect.top;

      var xAdd;
      var yAdd;

      var layerRotation = layer.rotation.value;
      var rad = layerRotation * (Math.PI / 180);
      var cosR = Math.cos(rad);
      var sinR = Math.sin(rad);

      switch (anchor) {
        case "center":
          x +=
            matchType == "ADBE Vector Layer" || matchType == "ADBE Text Layer"
              ? left
              : left / 2;
          y += top;
          break;

        case "top":
          x +=
            matchType == "ADBE Vector Layer" || matchType == "ADBE Text Layer"
              ? left
              : left / 2;
          y = top;
          break;

        case "bottom":
          x +=
            matchType == "ADBE Vector Layer" || matchType == "ADBE Text Layer"
              ? left
              : left / 2;
          y = top + y * 2;

          //matchType == 'ADBE Text Layer' ? y -= y : false;
          break;

        case "right":
          matchType == "ADBE Vector Layer" ? (x = left + x * 2) : (x += x);

          if (matchType == "ADBE Text Layer") {
            textParagraph == "center" || textParagraph == "right"
              ? (x += left)
              : (x = left + x);
          }

          y += top;
          break;

        case "left":
          x = left;
          y += top;
          break;

        case "top-left":
          x = left;
          y = top;
          break;

        case "top-right":
          matchType == "ADBE Vector Layer" ? (x = left + x * 2) : (x += x);

          if (matchType == "ADBE Text Layer") {
            x += left;
          }

          y = top;
          break;

        case "bottom-left":
          x = left;
          y = top + y * 2;

          //matchType == 'ADBE Text Layer' ? y -= y : false;
          break;

        case "bottom-right":
          matchType == "ADBE Vector Layer" ? (x = left + x * 2) : (x += x);

          if (matchType == "ADBE Text Layer") {
            textParagraph == "center" || textParagraph == "right"
              ? (x += left)
              : (x = left + x);
          }

          y = top + layerRect.height;
          //matchType == 'ADBE Text Layer' ? y -= y : false;
          break;
      }
      xAdd = (x - layerAnchor[0]) * (layer.scale.value[0] / 100);
      yAdd = (y - layerAnchor[1]) * (layer.scale.value[1] / 100);

      var vbFitEffect = layer.Effects("VB Text Fit and Align");
      var responsiveTextEffect = layer.Effects("Responsive Text");
      var stickEffect = layer.Effects("Stick");

      if (vbFitEffect || responsiveTextEffect) {
        var effect;
        if (vbFitEffect) {
          effect = vbFitEffect("Align");
        } else {
          effect = responsiveTextEffect("Anchor");
        }

        if (anchor === "center" || anchor === "top" || anchor === "bottom") {
          ae2Paragraph("center");
        }

        if (
          anchor === "left" ||
          anchor === "top-left" ||
          anchor === "bottom-left"
        ) {
          ae2Paragraph("left");
        }

        if (
          anchor === "right" ||
          anchor === "top-right" ||
          anchor === "bottom-right"
        ) {
          ae2Paragraph("right");
        }

        switch (anchor) {
          case "center":
            effect.setValue(5);
            break;

          case "top":
            effect.setValue(2);
            break;

          case "bottom":
            effect.setValue(8);
            break;

          case "right":
            effect.setValue(6);
            break;

          case "left":
            effect.setValue(4);
            break;

          case "top-left":
            effect.setValue(1);
            break;

          case "top-right":
            effect.setValue(3);
            break;

          case "bottom-left":
            effect.setValue(7);
            break;

          case "bottom-right":
            effect.setValue(9);
            break;
        }
      } else {
        layer.anchorPoint.setValue([x, y]);
      }

      var posExpression = false;

      var layerPosition = layer.position;

      if (layerPosition.expressionEnabled) {
        posExpression = true;
        layerPosition.expressionEnabled = false;
      }

      if (layerPosition.numKeys) {
        anchorPositionKey(layerPosition, [xAdd, yAdd], cosR, sinR);
      } else {
        if (!layerPosition.dimensionsSeparated) {
          layerPosition.setValue([
            layerPosition.value[0] + xAdd * cosR - yAdd * sinR,
            layerPosition.value[1] + xAdd * sinR + yAdd * cosR,
            layerPosition.value[2],
          ]);
        } else {
          var positionX = layer.transform.property("ADBE Position_0");
          var positionY = layer.transform.property("ADBE Position_1");

          positionX.setValue(
            layerPosition.value[0] + xAdd * cosR - yAdd * sinR
          );
          positionY.setValue(
            layerPosition.value[1] + xAdd * sinR + yAdd * cosR
          );
        }
      }

      if (posExpression) {
        layerPosition.expressionEnabled = true;
      }

      app.endUndoGroup();
    }
  },

  getUniqueEffectName: function (layer, baseName) {
    var effectsCount = layer.effect.numProperties;
    var maxNumber = 0;

    for (var i = 1; i <= effectsCount; i++) {
      var effectName = layer.effect(i).name;
      var match = effectName.match(new RegExp("^" + baseName + "\\s+(\\d+)$"));

      if (match) {
        var currentNumber = parseInt(match[1], 10);
        if (currentNumber > maxNumber) {
          maxNumber = currentNumber;
        }
      }
    }

    return baseName + " " + (maxNumber + 1);
  },
  // Использование вашего обновленного кода
  getUniqueCompName: function (baseName) {
    function trimString(str) {
      return str.replace(/^\s+|\s+$/g, "");
    }

    var project = app.project;
    var compsCount = project.numItems;
    var maxNumber = 0;

    // Очистить базовое имя от чисел
    baseName = trimString(baseName);

    for (var i = 1; i <= compsCount; i++) {
      var item = project.item(i);

      if (item instanceof CompItem) {
        var compName = item.name;
        var match = compName.match(
          new RegExp("^" + baseName + "\\s*(\\d+)?$", "i")
        );

        if (match && match[1]) {
          var currentNumber = parseInt(match[1], 10);
          if (currentNumber > maxNumber) {
            maxNumber = currentNumber;
          }
        }
      }
    }

    return maxNumber ? baseName + " " + (maxNumber + 1) : baseName + " 1";
  },

  isImageSequence: function (layer) {
    if (!layer) return false;
    if (layer.source && layer.source.file) {
      var file = layer.source.file;
      var fileExtension = file.name.split(".").pop().toLowerCase();
      var imgExtensions = ["png", "jpg", "jpeg", "tif", "tiff", "bmp", "gif"];

      // Замена метода includes на цикл для проверки расширения файла
      var isImageExt = false;
      for (var i = 0; i < imgExtensions.length; i++) {
        if (fileExtension === imgExtensions[i]) {
          isImageExt = true;
          break;
        }
      }

      if (isImageExt) {
        var seqRegExp = /(?:\d+)\.(?:png|jpg|jpeg|tif|tiff|bmp|gif)$/i;
        if (
          seqRegExp.test(file.name) &&
          layer.source.hasVideo &&
          layer.source.duration > layer.source.frameDuration
        ) {
          return layer;
        }
      }
    }
    return false;
  },

  removeKey: function (property) {
    while (property.numKeys != 0) {
      property.removeKey(1);
    }
  },

  templateName: function () {
    if (app.project.file) {
      var projectName = app.project.file.name;
      projectName = projectName.substring(0, projectName.lastIndexOf("."));
      projectName = projectName.replace(new RegExp("%20", "g"), " ");

      return projectName;
    }
    alert("Please save project");
    return false;
  },

  layerFit: function (layer) {
    var comp = layer.containingComp;

    if (layer.matchName == "ADBE AV Layer") {
      var x = (comp.height / layer.source.height) * 100;
      layer.scale.setValue([x, x]);
    }
  },

  templateFolder: function () {
    if (app.project.file) {
      return app.project.file.parent.fsName;
    }
    alert("Please save project");
    return false;
  },

  exportPng: function (comp, time, outputPngFile) {
    var pngFile = comp.saveFrameToPng(time, outputPngFile);

    while (!pngFile._isReady) {
      $.sleep(100);
    }

    return true;
  },

  arrayCheck: function (array, layer) {
    for (var i = 0; i < array.length; i++) {
      var arrayItem = array[i];
      if (arrayItem === layer) {
        return arrayItem;
      }
    }

    return false;
  },

  deselectAll: function () {
    app.executeCommand(2004);
  },

  getTime: function () {
    return {
      comp: app.project.activeItem.time,
      date: new Date().getTime(),
    };
  },

  pressed: new (function () {
    this.shift = function () {
      if (ScriptUI.environment.keyboardState.shiftKey) {
        return true;
      }
      return false;
    };
    this.alt = function () {
      if (ScriptUI.environment.keyboardState.altKey) {
        return true;
      }
      return false;
    };
    this.ctrl = function () {
      if (
        ScriptUI.environment.keyboardState.ctrlKey ||
        ScriptUI.environment.keyboardState.metaKey
      ) {
        return true;
      }
      return false;
    };
    this.keyName = function (keyName) {
      if (ScriptUI.environment.keyboardState.keyName === keyName) {
        return true;
      }
      return false;
    };
  })(),

  easeKey: function (type, property, keysList, value) {
    value < 1 ? (value = 0.1) : false;

    var easeIn, easeOut, keyEaseIn, keyEaseOut;

    for (var i = 0; i < keysList.length; i++) {
      var key = keysList[i];

      switch (type) {
        case "ease":
          easeIn = new KeyframeEase(0, value);
          easeOut = new KeyframeEase(0, value);

          switch (property.propertyValueType) {
            case PropertyValueType.TwoD:
              property.setTemporalEaseAtKey(
                key,
                [easeIn, easeIn],
                [easeOut, easeOut]
              );
              break;

            case PropertyValueType.ThreeD:
              property.setTemporalEaseAtKey(
                key,
                [easeIn, easeIn, easeIn],
                [easeOut, easeOut, easeOut]
              );
              break;

            default:
              property.setTemporalEaseAtKey(key, [easeIn], [easeOut]);
              break;
          }
          break;

        case "ease in":
          keyEaseOut = property.keyOutTemporalEase(key)[0].influence;

          easeIn = new KeyframeEase(0, value);
          easeOut = new KeyframeEase(0, keyEaseOut);

          switch (property.propertyValueType) {
            case PropertyValueType.TwoD:
              property.setTemporalEaseAtKey(
                key,
                [easeIn, easeIn],
                [easeOut, easeOut]
              );
              break;

            case PropertyValueType.ThreeD:
              property.setTemporalEaseAtKey(
                key,
                [easeIn, easeIn, easeIn],
                [easeOut, easeOut, easeOut]
              );
              break;

            default:
              property.setTemporalEaseAtKey(key, [easeIn], [easeOut]);
              break;
          }
          break;

        case "ease out":
          keyEaseIn = property.keyInTemporalEase(key)[0].influence;

          easeIn = new KeyframeEase(0, keyEaseIn);
          easeOut = new KeyframeEase(0, value);

          switch (property.propertyValueType) {
            case PropertyValueType.TwoD:
              property.setTemporalEaseAtKey(
                key,
                [easeIn, easeIn],
                [easeOut, easeOut]
              );
              break;

            case PropertyValueType.ThreeD:
              property.setTemporalEaseAtKey(
                key,
                [easeIn, easeIn, easeIn],
                [easeOut, easeOut, easeOut]
              );
              break;

            default:
              property.setTemporalEaseAtKey(key, [easeIn], [easeOut]);
              break;
          }
          break;
      }
    }
  },

  hideLayers: function (type) {
    var comp = $.ae.activeComposition();
    //var key = $.ae.pressed.ctrl()

    type === "false" ? (type = false) : null;

    typeof type === "string"
      ? (comp.hideShyLayers = true)
      : (comp.hideShyLayers = false);

    for (var i = 1; i <= comp.numLayers; i++) {
      var layer = comp.layer(i);
      typeof type === "string" ? (layer.shy = true) : (layer.shy = false);

      if (type === "text") {
        if (layer.matchName == "ADBE Text Layer") {
          layer.shy = false;
        }

        if (
          layer.matchName == "ADBE AV Layer" &&
          layer.source instanceof CompItem &&
          layer.name.toLowerCase().match("text")
        ) {
          layer.shy = false;
        }

        if (
          layer.matchName == "ADBE AV Layer" &&
          layer.source instanceof CompItem &&
          layer.source.numLayers > 0 &&
          layer.source.layer(1) instanceof TextLayer
        ) {
          layer.shy = false;
        }
      }

      if (type === "shape") {
        if (layer.matchName == "ADBE Vector Layer") {
          layer.shy = false;
        }

        if (
          layer.matchName == "ADBE AV Layer" &&
          layer.source instanceof CompItem &&
          layer.name.toLowerCase().match("shape")
        ) {
          layer.shy = false;
        }

        if (
          layer.matchName == "ADBE AV Layer" &&
          layer.source instanceof CompItem &&
          layer.source.numLayers > 0 &&
          layer.source.layer(1) instanceof ShapeLayer
        ) {
          layer.shy = false;
        }
      }

      if (type === "adjustment") {
        if (layer.adjustmentLayer === true) {
          layer.shy = false;
        }
      }

      if (type === "null") {
        if (layer.nullLayer === true) {
          layer.shy = false;
        }
      }
    }
  },

  getLayerTransform: function (layer, property) {
    switch (property) {
      case "Anchor Point":
        return layer("ADBE Transform Group")("ADBE Anchor Point");
      case "Position":
        return layer("ADBE Transform Group")("ADBE Position");
      case "Scale":
        return layer("ADBE Transform Group")("ADBE Scale");
      case "Rotation":
        return layer("ADBE Transform Group")("ADBE Rotate Z");
      case "Opacity":
        return layer("ADBE Transform Group")("ADBE Opacity");
    }
  },

  bakeExpression: function (property) {
    if (!property.expressionEnabled) return;

    var layer = property.propertyGroup(property.propertyDepth);
    var comp = layer.containingComp;
    var frame = comp.frameDuration;
    var fixed = 3;

    var valueArray = [];
    var timeArray = [];
    var currentKey = 0;

    try {
      var inPoint, outPoint;
      inPoint = layer.inPoint;
      outPoint = Math.min(layer.outPoint, comp.duration);

      // --- 1. КЭШИРОВАНИЕ ---
      var cache = [];
      for (var t = inPoint - frame; t <= outPoint + frame; t += frame) {
        var val = property.valueAtTime(t, false);

        var compareVal;
        if (typeof val === "number") {
          var rounded = parseFloat(val.toFixed(fixed));
          // Проверка на отрицательный ноль в стиле ES3
          if (rounded === 0 && 1 / rounded === -Infinity) {
            rounded = 0;
          }
          compareVal = rounded.toString();
        } else if (val instanceof Shape) {
          compareVal = val.vertices.toString() + val.outTangents.toString();
        } else {
          compareVal = val.toString();
        }

        cache.push({ raw: val, compare: compareVal, time: t });
      }

      // --- 2. СРАВНЕНИЕ (Ваша логика) ---
      for (var i = 1; i < cache.length - 1; i++) {
        var prev = cache[i - 1].compare;
        var curr = cache[i].compare;
        var next = cache[i + 1].compare;

        if (curr !== prev || curr !== next) {
          currentKey++;
          valueArray.push(cache[i].raw);
          timeArray.push(cache[i].time);
        }
      }

      // --- 3. ПРИМЕНЕНИЕ ---
      // Удаляем ключи перед записью новых
      if (property.numKeys > 0) {
        this.deleteKey(property);
      }

      if (property.matchName == "ADBE Time Remapping") {
        layer.timeRemapEnabled = true;
      }

      if (valueArray.length > 0) {
        // ВАЖНО: проверяем, не пустой ли массив и валидны ли данные
        property.setValuesAtTimes(timeArray, valueArray);
      } else {
        var staticVal = property.valueAtTime(layer.time, false);
        property.setValue(staticVal);
      }

      property.expression = "";

      if (property.matchName == "ADBE Time Remapping" && property.numKeys > 0) {
        property.removeKey(property.numKeys);
      }
    } catch (e) {
      alert("Ошибка в " + property.name + ":\n" + e.toString());
    }
  },

  deleteKey: function (property) {
    while (property.numKeys != 0) {
      // While there are still Keyframes, continue looping
      property.removeKey(1); // Delete the first Keyframe
    }
  },

  dataFolder: function (folderName, filename) {
    var projectName = folderName;
    var authorName = "Harchenko";

    var scriptFolder = new Folder(Folder.userData.fsName + "/" + authorName);
    if (!scriptFolder) scriptFolder.create();

    var filesFolder = new Folder(scriptFolder.fsName + "/" + projectName);
    if (scriptFolder) filesFolder.create();

    if (!filename) {
      var dataFile = new File(filesFolder.fsName + "/" + folderName + ".txt"); // Create temp text file
    } else {
      var dataFile = new File(filesFolder.fsName + "/" + filename);
    }

    var ownFiles =
      Folder.userData.absoluteURI + "/" + authorName + "/" + projectName + "/";

    return {
      data: dataFile,
      files: ownFiles,
    };
  },

  activeComposition: function () {
    var comp = app.project.activeItem;
    if (comp) {
      return comp;
    } else {
      alert("No active composition");
      return false;
    }
  },

  getCompSize: function (layer) {
    if (layer) {
      return [
        $.ae.layerComposition(layer).width,
        $.ae.layerComposition(layer).height,
      ];
    } else {
      return [$.ae.activeComposition().width, $.ae.activeComposition().height];
    }
  },

  setCompSize: function (comp, size) {
    comp.width = size[0];
    comp.height = size[1];
  },

  compResizeOffsetLayers: function (comp, size, position) {
    var nullObj = comp.layers.addNull();
    nullObjFootage = nullObj.source;
    nullObj.transform.position.setValue(size / 2);

    for (var l = comp.numLayers; l >= 1; l--) {
      var layer = comp.layer(l);

      if (layer.nullLayer == false) {
        layer.parent = nullObj;
      }
    }

    $.ae.setCompSize(comp, size);

    nullObj.transform.position.setValue(position);

    nullObj.remove();
    nullObjFootage.remove();
  },

  resizePreComp: function (comp, time) {
    comp instanceof CompItem ? null : (comp = comp.source);

    if (comp instanceof CompItem) {
      var data = [];
      var width = [];
      var height = [];

      for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        data.push($.ae.getRectPointsLayers(layer, "leftTop", time));
        data.push($.ae.getRectPointsLayers(layer, "rightTop", time));
        data.push($.ae.getRectPointsLayers(layer, "leftBottom", time));
        data.push($.ae.getRectPointsLayers(layer, "rightBottom", time));
      }

      if (!time) {
        for (var i = 0; i < data.length; i++) {
          width.push(data[i][0]);
          height.push(data[i][1]);
        }
      } else {
        for (var i = 0; i < data.length; i++) {
          var array = data[i];
          for (var a = 0; a < array.length; a++) {
            width.push(array[a][0]);
            height.push(array[a][1]);
          }
        }
      }

      var minWidth = Math.round($.ae.minArray(width));
      var maxWidth = Math.round($.ae.maxArray(width));

      var minHeight = Math.round($.ae.minArray(height));
      var maxHeight = Math.round($.ae.maxArray(height));

      newSize = [
        comp.width - minWidth - (comp.width - maxWidth),
        maxHeight - minHeight,
      ];
      newPositionLayers = [
        newSize[0] / 2 - minWidth,
        newSize[1] / 2 - minHeight,
      ];
      newPositionComp = [newSize[0] / 2 + minWidth, newSize[1] / 2 + minHeight];

      $.ae.compResizeOffsetLayers(comp, newSize, newPositionLayers);

      comp = comp.selectedLayers[0];

      if (comp) {
        comp.transform.position.setValue(newPositionComp);
      }

      return {
        size: [minWidth, minHeight],
        position: newPositionComp,
      };
    } else {
      return alert("Select composition");
    }
  },

  cropPrecomp: function (layer, time) {
    if (layer.source instanceof CompItem) {
      var offsetValue = $.ae.toComp(layer);

      writeLn(offsetValue.toString());

      comp = layer.source;

      var data = [];
      var width = [];
      var height = [];

      for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        data.push($.ae.getRectPointsLayers(layer, "leftTop", time));
        data.push($.ae.getRectPointsLayers(layer, "rightTop", time));
        data.push($.ae.getRectPointsLayers(layer, "leftBottom", time));
        data.push($.ae.getRectPointsLayers(layer, "rightBottom", time));
      }

      if (!time) {
        for (var i = 0; i < data.length; i++) {
          width.push(data[i][0]);
          height.push(data[i][1]);
        }
      } else {
        for (var i = 0; i < data.length; i++) {
          var array = data[i];

          for (var a = 0; a < array.length; a++) {
            width.push(array[a][0]);
            height.push(array[a][1]);
          }
        }
      }

      var minWidth = Math.round($.ae.minArray(width));
      var maxWidth = Math.round($.ae.maxArray(width));

      var minHeight = Math.round($.ae.minArray(height));
      var maxHeight = Math.round($.ae.maxArray(height));

      newSize = [
        comp.width - minWidth - (comp.width - maxWidth),
        maxHeight - minHeight,
      ];
      newPositionLayers = [
        newSize[0] / 2 - minWidth,
        newSize[1] / 2 - minHeight,
      ];
      newPositionComp = [newSize[0] / 2 + minWidth, newSize[1] / 2 + minHeight];

      $.ae.compResizeOffsetLayers(comp, newSize, newPositionLayers);

      layer = $.ae.selectedLayers()[0];

      layer.transform.position.setValue([
        newPositionComp[0] + offsetValue[0],
        newPositionComp[1] + offsetValue[1],
      ]);

      //layer.transform.position.setValue([layer.transform.position.value[0] + offsetValue[0], layer.transform.position.value[1] + offsetValue[1]])
    } else {
      return alert("Select composition");
    }
  },

  trimPreComp: function (originalLayer) {
    var comp = originalLayer.source;

    if (comp instanceof CompItem) {
      var inPointData = [];
      var outPointData = [];

      for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);

        inPointData.push(layer.inPoint);
        outPointData.push(layer.outPoint);
      }

      var minInPoint = Math.min.apply(null, inPointData);
      var maxOutPoint = Math.max.apply(null, outPointData);

      for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layer(i);
        var locked = layer.locked;
        layer.locked = false;

        $.ae.startTimeOffsetLayer(layer, minInPoint);
        layer.locked = locked;
      }

      comp.duration = maxOutPoint - minInPoint;
      originalLayer.startTime = minInPoint;
    }
  },

  startTimeOffsetLayer: function (layer, time) {
    layer.startTime = layer.startTime - time;
  },

  minArray: function (array) {
    return Math.min.apply(null, array);
  },

  maxArray: function (array) {
    return Math.max.apply(null, array);
  },

  smartPrecompose: function (time) {
    var comp = $.ae.activeComposition();
    var selectedLayers = comp.selectedLayers;

    var layerList = $.ae.getLayersInfo(selectedLayers, "index");
    var layers = selectedLayers.length;
    alert(layers);
    var label = selectedLayers[0].label;
    var preComposeName = layers === 1 ? selectedLayers[0].name : "Smart Comp";
    alert(preComposeName);

    var preComp = comp.layers.precompose(layerList, preComposeName, true);
    layers === 1 ? null : (preComp.comment = "smart comp");

    var data = $.ae.resizePreComp(
      comp.layer(Math.min.apply(null, layerList)),
      time
    );
    $.ae.trimPreComp(comp.layer(Math.min.apply(null, layerList)));

    $.ae.selectedLayers()[0].position.setValue(data.position);

    if (layers === 1) {
      $.ae.selectedLayers()[0].label = label;
    }
  },

  getLayersInfo: function (layerList, info) {
    var data = [];

    for (var i = 0; i < layerList.length; i++) {
      var layer = layerList[i];

      if (info === "index") {
        data.push(layer.index);
      }
    }

    return data;
  },

  checkAnimation: function (layer) {
    for (var p = 1; p <= layer("ADBE Transform Group").numProperties; p++) {
      var property = layer("ADBE Transform Group")(i);

      if (property.isTimeVarying) {
        return true;
      }
    }
  },

  getRectPointsLayers: function (layer, point, time) {
    function getStroke(group) {
      for (var i = 1; i <= group.numProperties; i++) {
        var property = group.property(i);
        if (
          property.matchName == "ADBE Vector Stroke Width" &&
          property.parentProperty.enabled
        ) {
          return property.value;
        }

        if (
          property.propertyType == PropertyType.INDEXED_GROUP ||
          property.propertyType == PropertyType.NAMED_GROUP
        ) {
          var result = getStroke(property);
          if (result !== false) {
            return result;
          }
        }
      }

      return false;
    }

    function calculateBoundingBox(vertices) {
      var minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      vertices.forEach(function (vertex) {
        if (vertex[0] < minX) minX = vertex[0];
        if (vertex[0] > maxX) maxX = vertex[0];
        if (vertex[1] < minY) minY = vertex[1];
        if (vertex[1] > maxY) maxY = vertex[1];
      });

      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }

    function combineBounds(bounds) {
      if (bounds.length === 0) {
        return null; // возвращаем null, если массив пуст
      }

      var minX = Infinity;
      var maxX = -Infinity;
      var minY = Infinity;
      var maxY = -Infinity;

      for (var i = 0; i < bounds.length; i++) {
        var current = bounds[i];
        minX = Math.min(minX, current.left);
        maxX = Math.max(maxX, current.left + current.width);
        minY = Math.min(minY, current.top);
        maxY = Math.max(maxY, current.top + current.height);
      }

      return {
        left: minX,
        top: minY,
        width: maxX,
        height: maxY,
      };
    }

    var maskPoint;
    var layerMasks = layer.mask;
    var hasValidMasks = layerMasks && layerMasks.numProperties > 0;

    if (hasValidMasks) {
      var maskBounds = [];
      for (var i = 1; i <= layerMasks.numProperties; i++) {
        var mask = layerMasks.property(i);
        if (mask.maskMode !== MaskMode.NONE) {
          var maskPath = mask.property("maskShape");
          var maskVertices = maskPath.value.vertices;
          var maskBoundingBox = calculateBoundingBox(maskVertices);
          maskBounds.push(maskBoundingBox);
        }
      }

      var maskBox = combineBounds(maskBounds);
    }

    var effects = layer.Effects;
    var expressionControl = effects.addProperty("ADBE Point Control");

    var stroke = 0;

    if (layer instanceof ShapeLayer) {
      stroke = getStroke(layer("ADBE Root Vectors Group"));
      stroke = stroke ? Math.round(stroke / 2) : 0;
    }

    var expression = "";
    expression += "sourceRect = thisLayer.sourceRectAtTime();\n";
    expression += "layerSize = [sourceRect.width, sourceRect.height];\n";
    expression += "layerPosition = [sourceRect.left, sourceRect.top];\n";

    if (point === "leftTop") {
      expression +=
        "toComp([layerPosition[0] - " +
        stroke +
        ", layerPosition[1] - " +
        stroke +
        "])";
      expressionControl.name = "leftTop";
      expressionControl(1).expression = expression;

      if (hasValidMasks) {
        maskPoint = layer.sourcePointToComp([maskBox.left, maskBox.top]);
      }
    }

    if (point === "rightTop") {
      expression +=
        "toComp([layerPosition[0] + layerSize[0] + " +
        stroke +
        ", layerPosition[1] - " +
        stroke +
        "])";
      expressionControl.name = "rightTop";
      expressionControl(1).expression = expression;

      if (hasValidMasks) {
        maskPoint = layer.sourcePointToComp([maskBox.width, maskBox.top]);
      }
    }

    if (point === "leftBottom") {
      expression +=
        "toComp([layerPosition[0] - " +
        stroke +
        ", layerPosition[1] + layerSize[1] + " +
        stroke +
        "])\n";
      expressionControl.name = "leftBottom";
      expressionControl(1).expression = expression;

      if (hasValidMasks) {
        maskPoint = layer.sourcePointToComp([maskBox.left, maskBox.height]);
      }
    }

    if (point === "rightBottom") {
      expression +=
        "toComp([layerPosition[0] + layerSize[0] + " +
        stroke +
        ", layerPosition[1] + layerSize[1] + " +
        stroke +
        "])";
      expressionControl.name = "rightBottom";
      expressionControl(1).expression = expression;

      if (hasValidMasks) {
        maskPoint = layer.sourcePointToComp([maskBox.width, maskBox.height]);
      }
    }

    if (!time) {
      value = hasValidMasks ? maskPoint : expressionControl(1).value;
    } else {
      var data = [];

      for (
        var i = layer.inPoint;
        i <= layer.outPoint;
        i += $.ae.layerComposition(layer).frameDuration
      ) {
        data.push(expressionControl(1).valueAtTime(i, false));
      }

      value = data;
    }

    expressionControl.remove();

    return value;
  },

  toComp: function (layer) {
    var compSize = $.ae.getCompSize(layer);
    var position = $.ae.getTransform(layer, "ADBE Position").value;
    var anchor = $.ae.getTransform(layer, "ADBE Anchor Point").value;

    var newValue = [
      -(compSize[0] - position[0] - anchor[0]),
      -(compSize[1] - position[1] - anchor[1]),
    ];

    return newValue;
  },

  returnData: function (data) {
    return data;
  },

  selectedLayer: function () {
    if (app.project.activeItem.selectedLayers[0]) {
      return app.project.activeItem.selectedLayers[0];
    } else {
      return alert("Select layer");
    }
  },

  selectedLayers: function () {
    if (app.project.activeItem.selectedLayers.length > 0) {
      return app.project.activeItem.selectedLayers;
    } else {
      return alert("Select layers");
    }
  },

  calculateSize: function (comp, layers) {
    var data = [];
    var width = [];
    var height = [];

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];

      data.push($.ae.getRectPointsLayers(layer, "leftTop"));
      data.push($.ae.getRectPointsLayers(layer, "rightTop"));
      data.push($.ae.getRectPointsLayers(layer, "leftBottom"));
      data.push($.ae.getRectPointsLayers(layer, "rightBottom"));
    }

    for (var i = 0; i < data.length; i++) {
      width.push(data[i][0]);
      height.push(data[i][1]);
    }

    var minWidth = $.ae.minArray(width);
    var maxWidth = $.ae.maxArray(width);

    var minHeight = $.ae.minArray(height);
    var maxHeight = $.ae.maxArray(height);

    newSize = [
      comp.width - minWidth - (comp.width - maxWidth),
      maxHeight - minHeight,
    ];
    newPositionComp = [newSize[0] / 2 + minWidth, newSize[1] / 2 + minHeight];

    return {
      width: [minWidth, maxWidth],
      height: [minHeight, maxHeight],
      size: newSize,
      position: newPositionComp,
    };
  },

  alignTo: function (align) {
    var comp = app.project.activeItem;
    var compSize = [comp.width, comp.height];
    var layers = $.ae.selectedLayers();

    var calculateData = $.ae.calculateSize(comp, layers);

    newSize = calculateData.size;
    newPositionComp = calculateData.position;

    switch (align) {
      case "center":
        if ($.ae.pressed.ctrl()) {
          align = [comp.width / 2, newPositionComp[1]];
        } else {
          align = compSize / 2;
        }
        break;

      case "top":
        align = [newPositionComp[0], newSize[1] / 2];
        break;

      case "bottom":
        align = [newPositionComp[0], comp.height - newSize[1] / 2];
        break;

      case "right":
        align = [comp.width - newSize[0] / 2, newPositionComp[1]];
        break;

      case "left":
        align = [newSize[0] / 2, newPositionComp[1]];
        break;

      case "top-left":
        align = newSize / 2;
        break;

      case "top-right":
        align = [comp.width - newSize[0] / 2, newSize[1] / 2];
        break;

      case "bottom-left":
        align = [newSize[0] / 2, comp.height - newSize[1] / 2];
        break;

      case "bottom-right":
        align = compSize - newSize / 2;
        break;
    }

    $.ae.alignToOffsetLayers(comp, layers, newPositionComp, align);
  },

  nullObj: function (comp) {
    var nullObj = comp.layers.addNull();
    nullObj.source.label = 0;
    nullObj.transform.anchorPoint.setValue([50, 50]);
    nullObj.label = 9;
    var name = "Control";
    nullObj.name = name;
    nullObj.source.name = name;
    nullObjFootage = nullObj.source;

    return {
      layer: nullObj,
      footage: nullObj.source,
    };
  },

  newShape: function (comp, size, position, name, type) {
    var shape = comp.layers.addShape();
    var group = shape
      .property("ADBE Root Vectors Group")
      .addProperty("ADBE Vector Group")("ADBE Vectors Group");

    var effects = shape.Effects;

    if (type === "Rectangle") {
      var controlSizeX = effects.addProperty("ADBE Slider Control");
      controlSizeX.name = "Width";
      controlSizeX(1).setValue(size[0]);

      var controlSizeY = effects.addProperty("ADBE Slider Control");
      controlSizeY.name = "Height";
      controlSizeY(1).setValue(size[1]);

      var Roundness = effects.addProperty("ADBE Slider Control");
      Roundness.name = "Roundness";

      form = group.addProperty("ADBE Vector Shape - Rect");
      form.property("ADBE Vector Rect Size").setValue(size);
      form.property("ADBE Vector Rect Size").expression =
        'width = effect("Width")(1);\nheight = effect("Height")(1);\n[width, height]';
      form.property("ADBE Vector Rect Roundness").expression =
        'effect("Roundness")(1)';
    }

    if (type === "Circle") {
      size = $.ae.maxArray(size);

      var controlSize = effects.addProperty("ADBE Slider Control");
      controlSize.name = "Size";
      controlSize(1).setValue(size);

      form = group.addProperty("ADBE Vector Shape - Ellipse");
      form.property("ADBE Vector Ellipse Size").setValue([size, size]);
      form.property("ADBE Vector Ellipse Size").expression =
        'size = effect("Size")(1);\n[size, size]';
    }

    var stroke = group.addProperty("ADBE Vector Graphic - Stroke");
    stroke.enabled = false;

    var fill = group.addProperty("ADBE Vector Graphic - Fill");
    fill("ADBE Vector Fill Color").setValue([1, 1, 1]);

    shape.transform.position.setValue(position);
    shape.name = name + " Matte";

    return shape;
  },

  alignToOffsetLayers: function (comp, layers, position, align) {
    var previousParent = [];

    var nullObj = $.ae.nullObj(comp);
    nullObj.layer.transform.position.setValue(position);

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];

      if (layer.parent) {
        previousParent.push([layer, layer.parent]);
      }

      layer.parent = nullObj.layer;
    }

    nullObj.layer.transform.position.setValue(align);

    nullObj.layer.remove();
    nullObj.footage.remove();

    if (previousParent.length > 0) {
      for (var i = 0; i < previousParent.length; i++) {
        var item = previousParent[i];

        item[0].parent = item[1];
      }
    }

    for (var i = 0; i < layers.length; i++) {
      var layer = (layers[i].selected = true);
    }
  },

  layerReact: function (layer) {
    var time = layer.containingComp.time;
    var reactAtTime = layer.sourceRectAtTime(time, true);

    return reactAtTime;
  },

  layerComposition: function (layer) {
    return layer.containingComp;
  },

  updateInfo: function (message) {
    clearOutput();
    writeLn(message);
  },

  message: function (message) {
    alert(message);
  },

  progressInfo: function (layer, key, property, value) {
    var duration =
      ((layer.outPoint - layer.inPoint) * 1) /
      $.ae.layerComposition(layer).frameDuration;

    percent = Math.round((key / duration) * 100); // Calculate progress
    $.ae.updateInfo(property.name + ": " + value.toString());
    $.ae.updateInfo("Progress: " + percent.toString() + " %");
  },

  getTransform: function (layer, matchName) {
    var transform = layer("ADBE Transform Group");

    for (var i = 1; i <= transform.numProperties; i++) {
      var property = transform.property(i);

      if (property.matchName === matchName) {
        return property;
      } else {
        false;
      }
    }
  },

  getEffect: function (layer, matchName) {
    var effects = layer("ADBE Effect Parade");

    for (var i = 1; i <= effects.numProperties; i++) {
      var effect = effects.property(i);

      if (effect.matchName === matchName) {
        return effect;
      } else {
        false;
      }
    }
  },

  getPropertyKey: function (layer, axis, property) {
    if (axis == "x") {
      axis = 0;
    }

    if (axis == "y") {
      axis = 1;
    }

    if (axis == "z") {
      axis = 2;
    }

    var comp = $.ae.layerComposition(layer);
    var frame = comp.frameDuration;
    var currentKey = 0;

    var value = [];
    var valueTime = [];

    var originalValue;
    var currentValue;
    var previousValue;
    var nextValue;

    var fixed = 3;
    var inPoint;
    var outPoint;

    if (property.expressionEnabled) {
      inPoint = layer.inPoint;
      outPoint =
        layer.outPoint < comp.duration ? layer.outPoint : comp.duration;
    } else if (!property.expressionEnabled && property.numKeys > 0) {
      inPoint = property.keyTime(1);
      outPoint = property.keyTime(property.numKeys) + frame;
    } else if (!property.expressionEnabled && property.numKeys === 0) {
      inPoint = layer.inPoint;
      outPoint = layer.inPoint + frame;
    }

    for (var i = inPoint; i <= outPoint; i += frame) {
      if (axis === "" && property.matchName != "ADBE Time Remapping") {
        originalValue = property.valueAtTime(i, false);

        if (property.propertyValueType === PropertyValueType.OneD) {
          currentValue = property.valueAtTime(i, false).toFixed(fixed);
          previousValue = property.valueAtTime(i - frame, false).toFixed(fixed);
          nextValue = property.valueAtTime(i + frame, false).toFixed(fixed);

          currentValue == -0.0
            ? (currentValue = Math.abs(currentValue))
            : false;
          previousValue == -0.0
            ? (previousValue = Math.abs(previousValue))
            : false;
          nextValue == -0.0 ? (nextValue = Math.abs(nextValue)) : false;
        }

        if (
          property.propertyValueType === PropertyValueType.TwoD ||
          property.propertyValueType === PropertyValueType.TwoD_SPATIAL
        ) {
          currentValue = [
            property.valueAtTime(i, false)[0].toFixed(fixed),
            property.valueAtTime(i, false)[1].toFixed(fixed),
          ];
          previousValue = [
            property.valueAtTime(i - frame, false)[0].toFixed(fixed),
            property.valueAtTime(i - frame, false)[1].toFixed(fixed),
          ];
          nextValue = [
            property.valueAtTime(i + frame, false)[0].toFixed(fixed),
            property.valueAtTime(i + frame, false)[1].toFixed(fixed),
          ];
        }

        if (
          property.propertyValueType === PropertyValueType.ThreeD ||
          property.propertyValueType === PropertyValueType.ThreeD_SPATIAL
        ) {
          currentValue = [
            property.valueAtTime(i, false)[0].toFixed(fixed),
            property.valueAtTime(i, false)[1].toFixed(fixed),
            property.valueAtTime(i, false)[2].toFixed(fixed),
          ];
          previousValue = [
            property.valueAtTime(i - frame, false)[0].toFixed(fixed),
            property.valueAtTime(i - frame, false)[1].toFixed(fixed),
            property.valueAtTime(i - frame, false)[2].toFixed(fixed),
          ];
          nextValue = [
            property.valueAtTime(i + frame, false)[0].toFixed(fixed),
            property.valueAtTime(i + frame, false)[1].toFixed(fixed),
            property.valueAtTime(i + frame, false)[2].toFixed(fixed),
          ];
        }
      }

      if (axis === "" && property.matchName == "ADBE Time Remapping") {
        originalValue = property.valueAtTime(i, false);

        currentValue = property.valueAtTime(i, false);
        previousValue = property.valueAtTime(i - frame, false);
        nextValue = property.valueAtTime(i + frame, false);
      }

      if (axis === 0) {
        originalValue = property.valueAtTime(i, false)[0];

        currentValue = property.valueAtTime(i, false)[0].toFixed(fixed);
        previousValue = property
          .valueAtTime(i - frame, false)[0]
          .toFixed(fixed);
        nextValue = property.valueAtTime(i + frame, false)[0].toFixed(fixed);
      }

      if (axis === 1) {
        originalValue = property.valueAtTime(i, false)[1];

        currentValue = property.valueAtTime(i, false)[1].toFixed(fixed);
        previousValue = property
          .valueAtTime(i - frame, false)[1]
          .toFixed(fixed);
        nextValue = property.valueAtTime(i + frame, false)[1].toFixed(fixed);
      }

      if (axis === 2) {
        originalValue = property.valueAtTime(i, false)[2];

        currentValue = property.valueAtTime(i, false)[2].toFixed(fixed);
        previousValue = property
          .valueAtTime(i - frame, false)[2]
          .toFixed(fixed);
        nextValue = property.valueAtTime(i + frame, false)[2].toFixed(fixed);
      }

      if (
        JSON.stringify(currentValue) != JSON.stringify(nextValue) ||
        JSON.stringify(currentValue) != JSON.stringify(previousValue)
      ) {
        currentKey++;

        $.ae.progressInfo(layer, currentKey, property, originalValue);

        value.push(originalValue);
        valueTime.push(i);
      }
    }

    if (value.length === 0) {
      value.push(originalValue);
      valueTime.push(layer.inPoint);
    }

    return [valueTime, value];
  },

  getKeyDr: function (layer, type, axis, property) {
    var propertyValueData = $.ae.getPropertyKey(layer, axis, property);

    var keyData = "";

    for (var i = 0; i < propertyValueData[0].length; i++) {
      if (type === "Position" && axis === 0) {
        value = propertyValueData[1][i] / $.ae.layerComposition(layer).width;
      }

      if (type === "Position" && axis === 1) {
        value =
          (propertyValueData[1][i] / $.ae.layerComposition(layer).height) * -1 +
          1;
      }

      if (type === "Rotation" && axis === "") {
        value = propertyValueData[1][i] * -1;
      }

      if (type === "Opacity" && axis === "") {
        value = propertyValueData[1][i] / 100;
      }

      if (
        (type === "Scale" && axis === "") ||
        (type === "Scale" && axis === 0)
      ) {
        value = propertyValueData[1][i] / 100;
      }

      if (type === "Scale" && axis === 1) {
        value = propertyValueData[1][i] / 100;
      }

      if (type === "Value" && axis === "") {
        value = propertyValueData[1][i];
      }

      keyData +=
        "			[" +
        Math.round(
          propertyValueData[0][i] / $.ae.layerComposition(layer).frameDuration
        ) +
        "] = { " +
        value +
        ", Flags = { StepIn = true } },\n";
    }

    return keyData;
  },

  getValueDr: function (layer, type, property) {
    if (type === "Position") {
      value = [
        property.value[0] / $.ae.layerComposition(layer).width,
        (property.value[1] / $.ae.layerComposition(layer).height) * -1 + 1,
      ];

      return [
        "            Center = Input { Value = { " +
          value[0] +
          ", " +
          value[1] +
          " }, },",
        value[0],
        value[1],
      ];
    }
  },
};

$.utils = {
  getArrayMinMax: function (arr) {
    var min = Math.min.apply(null, arr);
    var max = Math.max.apply(null, arr);
    return [min, max];
  },
  getLayersInOutPoints: function (layers) {
    var inOutPoints = [];
    var compDuration = layers[0].containingComp.duration;
    layers.forEach(function (layer) {
      var layerInPoint = layer.inPoint;
      var layerOutPoint = layer.outPoint;
      if (layerOutPoint > compDuration) {
        layerOutPoint = compDuration;
      }
      inOutPoints.push(layerInPoint);
      inOutPoints.push(layerOutPoint);
    });

    var minMaxPoints = $.utils.getArrayMinMax(inOutPoints);

    return minMaxPoints;
  },
  getLayersSize: function (options) {
    var comp = options.comp;
    var layers = options.layers;
    var animation = options.animation;
    var optimizeSize = options.optimizeSize;

    var data = [];
    var width = [];
    var height = [];

    layers.forEach(function (layer) {
      data.push($.ae.getRectPointsLayers(layer, "leftTop", animation));
      data.push($.ae.getRectPointsLayers(layer, "rightTop", animation));
      data.push($.ae.getRectPointsLayers(layer, "leftBottom", animation));
      data.push($.ae.getRectPointsLayers(layer, "rightBottom", animation));
    });

    if (!animation) {
      for (var i = 0; i < data.length; i++) {
        width.push(data[i][0]);
        height.push(data[i][1]);
      }
    } else {
      for (var i = 0; i < data.length; i++) {
        var array = data[i];
        for (var a = 0; a < array.length; a++) {
          width.push(array[a][0]);
          height.push(array[a][1]);
        }
      }
    }

    var widthMinMax = $.utils.getArrayMinMax(width);
    var heightMinMax = $.utils.getArrayMinMax(height);

    var minWidth = Math.round(widthMinMax[0]);
    var maxWidth = Math.round(widthMinMax[1]);
    var minHeight = Math.round(heightMinMax[0]);
    var maxHeight = Math.round(heightMinMax[1]);

    if (optimizeSize) {
      var compWidth = comp.width;
      var compHeight = comp.height;

      minWidth = minWidth < 0 ? 0 : minWidth;
      maxWidth = maxWidth > compWidth ? compWidth : maxWidth;
      minHeight = minHeight < 0 ? 0 : minHeight;
      maxHeight = maxHeight > compHeight ? compHeight : maxHeight;
    }
    var newWidth = comp.width - minWidth - (comp.width - maxWidth);
    var newHeight = maxHeight - minHeight;

    var newSize = [newWidth, newHeight];

    var newPositionLayers = [
      newSize[0] / 2 - minWidth,
      newSize[1] / 2 - minHeight,
    ];
    var newPositionComp = [
      newSize[0] / 2 + minWidth,
      newSize[1] / 2 + minHeight,
    ];

    return {
      minWidth: minWidth,
      maxWidth: maxWidth,
      minHeight: minHeight,
      maxHeight: maxHeight,
      size: newSize,
      positionLayers: newPositionLayers,
      positionComposition: newPositionComp,
    };
  },
};
