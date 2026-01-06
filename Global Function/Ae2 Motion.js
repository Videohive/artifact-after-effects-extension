//@include "./Ae2 Function.jsx"

$.mot = {

    timebase: 153600,

    getSavePath: function (fullPath) {
        var amFile = new File(fullPath);

        // Если файл существует
        if (amFile.exists) {
            // Создание диалогового окна с кнопками
            var w = new Window("dialog", "File exists", undefined);
            w.add("statictext", undefined, "The file already exists. Choose an action:");

            var btnGroup = w.add("group");
            var saveButton = btnGroup.add("button", undefined, "Save");
            var saveAsButton = btnGroup.add("button", undefined, "Save As");
            var result = null;

            saveButton.onClick = function () {
                result = amFile;
                w.close();
            };

            saveAsButton.onClick = function () {
                var extractedPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
                var fileExtension = fullPath.substring(fullPath.lastIndexOf(".") + 1);
                var initialFileName = fullPath.substring(extractedPath.length + 1, fullPath.lastIndexOf("."));
                var newFile = new File(extractedPath + "/" + $.ae.checkFileName(extractedPath + "/", initialFileName)).saveDlg("Save As", "*" + "." + fileExtension);

                if (newFile) {
                    // Проверяем, есть ли у файла расширение, если нет - добавляем
                    if (newFile.name.indexOf('.') === -1) {
                        newFile = new File(newFile.fsName + '.' + fileExtension);
                    }

                    result = newFile;
                }
                w.close();
            };

            w.show();

            return result;
        } else {
            // Если файл не существует
            return amFile;
        }
    },

    deleteNotSelectedLayer: function () {
        function indexOfArray(arr, item) {
            for (var j = 0; j < arr.length; j++) {
                if (arr[j] === item) return j;
            }
            return -1;
        }

        function isParentOfSelected(layer, selectedLayers) {
            for (var i = 0; i < selectedLayers.length; i++) {
                if (selectedLayers[i].parent === layer) {
                    return true;
                }
            }
            return false;
        }

        if (!app.project.activeItem || !(app.project.activeItem instanceof CompItem)) {
            alert('Please select an active composition.');
            return false;
        }

        var comp = app.project.activeItem;
        var selectedLayers = comp.selectedLayers;

        if (!selectedLayers || selectedLayers.length === 0) {
            alert('Please select layers.');
            return false;
        }

        for (var i = comp.layers.length; i >= 1; i--) {
            var layer = comp.layers[i];
            if (indexOfArray(selectedLayers, layer) === -1 && !layer.nullLayer && !isParentOfSelected(layer, selectedLayers)) {
                layer.remove();
            }
        }

        var name = selectedLayers.length > 1 ? prompt('Preset Name', comp.name) : selectedLayers[0].name;
        if (name) {
            comp.name = name;
        }

        return name;

    },

    roundFrameRate: function () {
        for (var i = 1; i <= app.project.numItems; i++) {

            var comp = app.project.item(i);

            if (comp instanceof CompItem) {
                var frameRate = comp.frameRate
                var roundFrameRate = Math.round(frameRate)

                frameRate < roundFrameRate ? comp.frameRate = roundFrameRate : null;
            }
        }
    },

    responseComp: function (name) {

        var a = false;
        var b = false;
        var transitions = false;

        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);

            if (item instanceof CompItem) {
                if (item.name.toLowerCase() == 'a' && item.numLayers == 1) {
                    a = true;
                }
                if (item.name.toLowerCase() == 'b' && item.numLayers == 1) {
                    b = true;
                }
                if (a && b) {
                    transitions = true;
                };
            };
        };

        var comp = app.project.activeItem;

        var exportComp = app.project.items.addComp(name, comp.width, comp.height, 1, comp.duration, comp.frameRate);
        var layer = exportComp.layers.add(comp);
        //layer.collapseTransformation = true

        if (!transitions) {
            layer.comment = 'global';
        }

        exportComp.openInViewer();

        return compName = comp.name
    },

    responseScaleRig: function (layer) {

        amFile.writeln("		<behavior name=\"Response Data\" id=\"" + layer.id + "\" factoryID=\"27\">");
        amFile.writeln("			<channelBehavior affectingFactory=\"ee6b4918387a11d7a02100039375d2ba\" affectingChannel=\"./1/100/105\" sliderRange=\"4\"/>");
        //amFile.writeln("			<timing in="0 1 1 0" out="-5120 153600 1 0" offset="0 1 1 0"/>");
        amFile.writeln("			<baseFlags>8589934610</baseFlags>");
        amFile.writeln("			<parameter name=\"Affecting Object (Hidden)\" id=\"199\" flags=\"77309476882\" default=\"0\" value=\"" + layers[layer.id][1] + "\"/>");
        amFile.writeln("			<parameter name=\"Widget\" id=\"200\" flags=\"77309476880\" default=\"0\" value=\"10002\"/>");
        amFile.writeln("			<parameter name=\"Snapshots\" id=\"202\" flags=\"8590004242\">");
        amFile.writeln("				<flags>8590004242</flags>");

        setScale([
            [100, 100, 100],
            [100, 100, 100],
            [80, 80, 80],
            [56.25, 56.25, 56.25],
            [100, 100, 100]
        ])

        amFile.writeln("			</parameter>");
        amFile.writeln("		</behavior>");

        function setScale(array) {

            for (var i = 0; i < array.length; i++) {

                var data = array[i]

                var x = data[0]
                var y = data[1]
                var z = data[2]

                var index = i + 1

                amFile.writeln("				<parameter name=\"Scale\" id=\"" + index + "\" factoryID=\"34\">");
                amFile.writeln("					<foldFlags>11</foldFlags>");
                amFile.writeln("					<parameter name=\"X\" id=\"1\">");
                amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (x) / 100 + "\"/>");
                amFile.writeln("					</parameter>");
                amFile.writeln("					<parameter name=\"Y\" id=\"2\">");
                amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (y) / 100 + "\"/>");
                amFile.writeln("					</parameter>");
                amFile.writeln("					<parameter name=\"Z\" id=\"3\">");
                amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + z / 100 + "\"/>");
                amFile.writeln("					</parameter>");
                amFile.writeln("				</parameter>");
            }
        }
    },

    retimeAnimation: function (frame, comp) {
        var frames = Math.round((comp.displayStartTime + frame) * $.mot.timebase);
        return frames;
    },

    convertTextAnimatorOffset: function (value) {
        if (value < 0) {
            return Number((100 - Math.abs(value)) / 2) / 100;
        } else {
            return Number(50 + value / 2) / 100;
        }
    },

    normalizeID: function (number) {
        // Преобразование числа в строку
        var numberStr = number.toString();

        // Проверка длины строки и обрезка до 10 символов, если необходимо
        if (numberStr.length > 10) {
            numberStr = numberStr.substring(0, 10);
        }

        // Возвращение результата как числа
        return Number(numberStr);
    },

    getDataMotion: function (layer, property) {

        var comp = $.ae.layerComposition(layer);
        var frame = comp.frameDuration
        var currentKey = 0;

        var value = [];
        var valueTime = [];

        var originalValue
        var currentValue;
        var previousValue;
        var nextValue;

        var fixed = 3
        var inPoint;
        var outPoint;

        if (property.expressionEnabled) {
            inPoint = layer.inPoint;
            outPoint = layer.outPoint < comp.duration ? layer.outPoint : comp.duration;
        } else if (!property.expressionEnabled && property.numKeys > 0) {
            inPoint = property.keyTime(1);
            outPoint = property.keyTime(property.numKeys) + frame;
        } else if (!property.expressionEnabled && property.numKeys === 0) {
            inPoint = layer.inPoint;
            outPoint = layer.inPoint + frame;
        }

        for (var i = inPoint; i <= outPoint; i += frame) {

            originalValue = property.valueAtTime(i, false)

            currentValue = property.valueAtTime(i, false).toFixed(fixed)
            previousValue = property.valueAtTime(i - frame, false).toFixed(fixed)
            nextValue = property.valueAtTime(i + frame, false).toFixed(fixed)

            currentValue == -0.0 ? currentValue = Math.abs(currentValue) : false
            previousValue == -0.0 ? previousValue = Math.abs(previousValue) : false
            nextValue == -0.0 ? nextValue = Math.abs(nextValue) : false

            if (JSON.stringify(currentValue) != JSON.stringify(nextValue) || JSON.stringify(currentValue) != JSON.stringify(previousValue)) {
                currentKey++

                $.ae.progressInfo(layer, currentKey, property, originalValue)

                value.push(originalValue)
                valueTime.push(i)
            }
        }

        if (value.length === 0) {
            value.push(originalValue)
            valueTime.push(layer.inPoint)
        }

        return [valueTime, value]
    },

    getDataKeyMotion: function (layer, property, shapePosition) {

        format = property.name.split('|')[1]

        if (format == ' 4:5') {
            x = 1 //0.8
        } else if (format == ' 9:16') {
            x = 1 //0.5625
        } else {
            x = 1
        }

        comp = layer.containingComp.layer('Resolution Data').Effects('Resolution Data')

        shapePosition ? shapePos = $.ae.getPropertyKey(layer, axis, shapePosition) : false

        width_16_9 = comp('Width | 16:9').value
        height_16_9 = comp('Height | 16:9').value

        width_1_1 = comp('Width | 1:1').value
        height_1_1 = comp('Height | 1:1').value

        width_4_5 = Math.round(comp('Width | 4:5').value)
        height_4_5 = Math.round(comp('Height | 4:5').value)

        width_9_16 = Math.round(comp('Width | 9:16').value)
        height_9_16 = Math.round(comp('Height | 9:16').value)

        width_21_9 = comp('Width | 21:9').value
        height_21_9 = comp('Height | 1:1').value

        data = layer.Effects('Layer Data')

        var propertyValueData = $.mot.getDataMotion(layer, property);
        var keyData = ''

        for (var i = 0; i < propertyValueData[0].length; i++) {

            if (property.name == 'Position X |' + format) {

                if (!shapePosition) {
                    value = ((propertyValueData[1][i] * (-1) + comp('Width |' + format).value / 2) * x) * (-1)
                } else {
                    if (shapePos.length == 2) {
                        value = (shapePos[1][0] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[0]) - comp('Width |' + format).value / 2) * x
                    } else {
                        value = (shapePos[1][i] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[0]) - comp('Width |' + format).value / 2) * x
                    }
                }
            }

            if (property.name == 'Position Y |' + format) {
                if (!shapePosition) {
                    value = (propertyValueData[1][i] * (-1) + comp('Height |' + format).value / 2) * x
                } else {
                    if (shapePos.length == 2) {
                        value = ((shapePos[1][0] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[1]) - comp('Height |' + format).value / 2) * x) * (-1)
                    } else {
                        value = ((shapePos[1][i] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[1]) - comp('Height |' + format).value / 2) * x) * (-1)
                    }
                }
            }

            if (property.name == 'Position Z |' + format) {
                value = propertyValueData[1][i] * (-1)
            }

            if (property.name == 'Scale X |' + format || property.name == 'Scale Y |' + format || property.name == 'Scale Z |' + format) {
                value = propertyValueData[1][i] / 100;
            }

            if (property.name == 'Rotation X |' + format) {
                prop = from_ae_to_motion([propertyValueData[1][i], data('Rotation Y |' + format).valueAtTime(propertyValueData[0][i], false), data('Rotation Z |' + format).valueAtTime(propertyValueData[0][i], false)])[0];

                value = 0.01745329251994332 * prop
            }

            if (property.name == 'Rotation Y |' + format) {
                prop = from_ae_to_motion([data('Rotation X |' + format).valueAtTime(propertyValueData[0][i], false), propertyValueData[1][i], data('Rotation Z |' + format).valueAtTime(propertyValueData[0][i], false)])[1];

                value = 0.01745329251994332 * prop
            }

            if (property.name == 'Rotation Z |' + format) {
                prop = from_ae_to_motion([data('Rotation X |' + format).valueAtTime(propertyValueData[0][i], false), data('Rotation Y |' + format).valueAtTime(propertyValueData[0][i], false), propertyValueData[1][i]])[2];

                value = 0.01745329251994332 * prop
            }

            keyData += "                               <time>" + $.mot.retimeAnimation(propertyValueData[0][i], layer.containingComp) + " " + $.mot.timebase + " 1 0</time>\n"
            keyData += "                               <value>" + value + "</value>\n"
        }

        return keyData;
    },

    getKeyMotion: function (layer, type, axis, property, shapePosition) {
        var comp = layer.containingComp;
        if (layer.matchName !== "ADBE Camera Layer" && layer.matchName !== "ADBE Light Layer") {
            var rect = layer.sourceRectAtTime($.ae.middleLayer(layer), false);
        };
        var propertyValueData = $.ae.getPropertyKey(layer, axis, property);
        var fps = 1 / comp.frameDuration;

        shapePosition ? shapePos = $.ae.getPropertyKey(layer, axis, shapePosition) : false

        var keyData = ''

        for (var i = 0; i < propertyValueData[0].length; i++) {

            if (type === 'Position' && axis === 0) {

                if (!shapePosition) {
                    value = (propertyValueData[1][i] * (-1) + comp.width / 2) * (-1)
                } else {
                    if (shapePos.length == 2) {
                        value = (shapePos[1][0] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[0]) - comp.width / 2)
                    } else {
                        value = (shapePos[1][i] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[0]) - comp.width / 2)
                    }
                }
            }

            if (type === 'Position' && axis === 1) {
                if (!shapePosition) {
                    value = propertyValueData[1][i] * (-1) + comp.height / 2
                } else {
                    if (shapePos.length == 2) {
                        value = (shapePos[1][0] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[1]) - comp.height / 2) * (-1)
                    } else {
                        value = (shapePos[1][i] + (propertyValueData[1][i] - layer.transform.anchorPoint.valueAtTime(propertyValueData[0][i], false)[1]) - comp.height / 2) * (-1)
                    }
                }
            }

            if (property.matchName == 'ADBE Geometry2-0002') {
                if (axis === 0) {
                    value = (propertyValueData[1][i] * (-1) + rect.width / 2) * (-1)
                }

                if (axis === 1) {
                    value = propertyValueData[1][i] * (-1) + rect.height / 2
                }
            }

            if (type === 'offset' && axis === 0) {
                value = (propertyValueData[1][i] * (-1) + comp.width / 2) * (-1) / comp.width * 100

            }

            if (type === 'offset' && axis === 1) {
                value = (propertyValueData[1][i] * (-1) + comp.height / 2) / comp.height * 100

            }

            if (type === 'mirror' && axis === 0) {
                value = propertyValueData[1][i] / comp.width

            }

            if (type === 'mirror' && axis === 1) {
                value = (propertyValueData[1][i] * (-1) + comp.height) / comp.height

            }

            if (type === 'Position' && axis === 2) {
                value = propertyValueData[1][i] * (-1)
            }

            if (type === 'Anchor' && axis === 0) {
                x = layer.sourceRectAtTime(i, false).width;
                value = (propertyValueData[1][i] + x / 2) - x;
            }

            if (type === 'Anchor' && axis === 1) {
                y = layer.sourceRectAtTime(i, false).height;
                value = ((propertyValueData[1][i] + y / 2) - y) * (-1);
            }

            if (type === 'Rotation' && axis === '') {

                var r = from_ae_to_motion([layer("ADBE Transform Group")("ADBE Rotate X").valueAtTime(propertyValueData[0][i], false), layer("ADBE Transform Group")("ADBE Rotate Y").valueAtTime(propertyValueData[0][i], false), layer("ADBE Transform Group")("ADBE Rotate Z").valueAtTime(propertyValueData[0][i], false)]);

                if (property.matchName == "ADBE Rotate X") {
                    prop = r[0];
                }

                if (property.matchName == "ADBE Rotate Y") {
                    prop = r[1];
                }

                if (property.matchName == "ADBE Rotate Z") {
                    prop = r[2];
                }

                layer.threeDLayer ? value = 0.01745329251994332 * prop : value = 0.01745329251994332 * propertyValueData[1][i] * (-1);
            }

            if (property.matchName == "ADBE Motion Blur-0001") { // Directional Blur
                value = Math.abs(0.01745329251994332 * propertyValueData[1][i]);
            }

            if (type === 'corner') {

                axis === 0 ? value = propertyValueData[1][i] : value = propertyValueData[1][i] * -1;

                if (property.matchName == "ADBE Corner Pin-0002" && axis === 0 || property.matchName == "ADBE Corner Pin-0004" && axis === 0) {
                    value = propertyValueData[1][i] - layer.sourceRectAtTime(layer.time, false).width
                }

                if (property.matchName == "ADBE Corner Pin-0003" && axis === 1 || property.matchName == "ADBE Corner Pin-0004" && axis === 1) {
                    value = (propertyValueData[1][i] - layer.sourceRectAtTime(layer.time, false).height) * -1
                }
            }

            if (type === 'Opacity' && axis === '') {
                value = propertyValueData[1][i] / 100;
            }

            if (type === 'Scale' && axis === '' || type === 'Scale' && axis === 0) {
                value = propertyValueData[1][i] / 100;
            }

            if (type === 'Scale' && axis === 1) {
                value = propertyValueData[1][i] / 100;
            }

            if (type === 'Value' && axis === '') {
                value = propertyValueData[1][i];
            }

            if (property.matchName == "ADBE Box Blur2-0001") {
                value = propertyValueData[1][i] * property.parentProperty(2).valueAtTime(propertyValueData[0][i], false);
            }

            if (type === 'trimPathsOffset' && axis === '') {
                value = propertyValueData[1][i] / 360;
            }

            if (type === 'other' && axis === '') {
                value = propertyValueData[1][i] / 100;
            }

            if (type === 'ADBE Vector Rect Size' && (axis === 0 || axis === 1)) { // rectangle shape size
                value = propertyValueData[1][i];
            }

            if (type === 'ADBE Vector Ellipse Size' && (axis === 0 || axis === 1)) { // rectangle shape size
                value = propertyValueData[1][i] / 2;
            }

            if (type === 'ADBE Vector Rect Roundness') { // shape roundness
                value = propertyValueData[1][i] / 2;
            }

            if (property.matchName === 'ADBE Text Percent Offset') {
                value = $.mot.convertTextAnimatorOffset(propertyValueData[1][i]);
            };

            if (property.matchName === 'ADBE Vector Skew') {
                value = 0.01745329251994332 * propertyValueData[1][i];
            };

            if (property.matchName === 'ADBE Radial Blur-0001') {
                if (type == 'rotation') {
                    value = 0.01745329251994332 * propertyValueData[1][i];
                } else {
                    value = propertyValueData[1][i];
                };
            };

            if (property.matchName === "ADBE Radial Blur-0002") {
                if (axis == 0) {
                    value = propertyValueData[1][i] / layer.width;
                } else {
                    value = (propertyValueData[1][i] * (-1) + layer.height) / layer.height;
                };
            };

            if (type === 'TimeRemap') {
                value = Math.round((propertyValueData[1][i] + comp.frameDuration) * fps)
            };

            if (!layer.comment.match('clone')) {
                keyData += "                               <time>" + $.mot.retimeAnimation(propertyValueData[0][i], comp) + " " + $.mot.timebase + " 1 0</time>\n";
            } else {
                keyData += "                               <time>" + $.mot.retimeAnimation(propertyValueData[0][i] - layer.inPoint - comp.displayStartTime, comp) + " " + $.mot.timebase + " 1 0</time>\n";
                // keyData += "                               <time>" + $.mot.retimeAnimation(propertyValueData[0][i] - layer.inPoint - comp.displayStartTime, comp) + " " + $.mot.timebase + " 1 0</time>\n";
            };

            if (layer.matchName == "ADBE AV Layer" && layer.source instanceof FootageItem && layer.source.file != null && !layer.name.match('Drop Zone')) {
                keyData += "                               <time>" + $.mot.retimeAnimation(propertyValueData[0][i] - layer.inPoint - comp.displayStartTime, comp) + " " + $.mot.timebase + " 1 0</time>\n";
            };

            keyData += "                               <value>" + value + "</value>\n"
        }

        return keyData;
    },

    resolutionCompRig: function (layer) {

        comp = layer.source
        data = comp.layer('Resolution Data').Effects('Resolution Data')

        width_16_9 = data('Width | 16:9').value
        height_16_9 = data('Height | 16:9').value

        width_1_1 = data('Width | 1:1').value
        height_1_1 = data('Height | 1:1').value

        width_4_5 = Math.round(data('Width | 4:5').value)
        height_4_5 = Math.round(data('Height | 4:5').value)

        width_9_16 = Math.round(data('Width | 9:16').value)
        height_9_16 = Math.round(data('Height | 9:16').value)

        width_21_9 = data('Width | 21:9').value
        height_21_9 = data('Height | 1:1').value

        if (layer.comment != 'ignore' && layer.comment != 'lock') {

            amFile.writeln("		<behavior name=\"Width Data\" id=\"" + width_16_9 + layer.id + "\" factoryID=\"27\">");
            amFile.writeln("			<channelBehavior affectingFactory=\"ee6b4918387a11d7a02100039375d2ba\" affectingChannel=\"./2/302\" sliderRange=\"2000\"/>");
            //amFile.writeln("			<timing in=\"0 1 1 0\" out=\"-5120 153600 1 0\" offset=\"0 1 1 0\"/>");
            amFile.writeln("			<baseFlags>8589934610</baseFlags>");
            amFile.writeln("			<parameter name=\"Affecting Object (Hidden)\" id=\"199\" flags=\"77309476882\" default=\"0\" value=\"" + layers[layer.id][1] + "\"/>");
            amFile.writeln("			<parameter name=\"Widget\" id=\"200\" flags=\"77309476880\" default=\"0\" value=\"10002\"/>");
            amFile.writeln("			<parameter name=\"Snapshots\" id=\"202\" flags=\"8590004242\">");
            amFile.writeln("				<flags>8590004242</flags>");

            setSizeComp('Fixed Width', [width_16_9, width_1_1, width_4_5, width_9_16, width_21_9])

            amFile.writeln("			</parameter>");
            amFile.writeln("		</behavior>");

            amFile.writeln("		<behavior name=\"Height Data\" id=\"" + height_16_9 + layer.id + "\" factoryID=\"27\">");
            amFile.writeln("			<channelBehavior affectingFactory=\"ee6b4918387a11d7a02100039375d2ba\" affectingChannel=\"./2/303\" sliderRange=\"2000\"/>");
            //amFile.writeln("			<timing in=\"0 1 1 0\" out=\"-5120 153600 1 0\" offset=\"0 1 1 0\"/>");
            amFile.writeln("			<baseFlags>8589934610</baseFlags>");
            amFile.writeln("			<parameter name=\"Affecting Object (Hidden)\" id=\"199\" flags=\"77309476882\" default=\"0\" value=\"" + layers[layer.id][1] + "\"/>");
            amFile.writeln("			<parameter name=\"Widget\" id=\"200\" flags=\"77309476880\" default=\"0\" value=\"10002\"/>");
            amFile.writeln("			<parameter name=\"Snapshots\" id=\"202\" flags=\"8590004242\">");
            amFile.writeln("				<flags>8590004242</flags>");

            setSizeComp('Fixed Height', [height_16_9, height_1_1, height_4_5, height_9_16, height_21_9])

            amFile.writeln("			</parameter>");
            amFile.writeln("		</behavior>");

        }

        function setSizeComp(type, array) {

            for (var i = 0; i < array.length; i++) {

                var size = array[i]
                var index = i + 1

                amFile.writeln("				<parameter name=\"" + type + "\" id=\"" + index + "\" factoryID=\"32\">");
                amFile.writeln("					<flags>12901679120</flags>");
                amFile.writeln("					<curve type=\"0\" default=\"" + size + "\" value=\"" + size + "\">");
                amFile.writeln("						<min>0</min>");
                amFile.writeln("						<max>4294967295</max>");
                amFile.writeln("					</curve>");
                amFile.writeln("				</parameter>");

            }
        }
    },

    positionRig: function (layer) {

        comp = layer.containingComp.layer('Resolution Data').Effects('Resolution Data')

        width_16_9 = comp('Width | 16:9').value
        height_16_9 = comp('Height | 16:9').value

        width_1_1 = comp('Width | 1:1').value
        height_1_1 = comp('Height | 1:1').value

        width_4_5 = Math.round(comp('Width | 4:5').value)
        height_4_5 = Math.round(comp('Height | 4:5').value)

        width_9_16 = Math.round(comp('Width | 9:16').value)
        height_9_16 = Math.round(comp('Height | 9:16').value)

        width_21_9 = comp('Width | 21:9').value
        height_21_9 = comp('Height | 1:1').value

        size_16_9 = [width_16_9, height_16_9]
        size_1_1 = [width_1_1, height_1_1]
        size_4_5 = [width_4_5, height_4_5]
        size_9_16 = [width_9_16, height_9_16]
        size_21_9 = [width_21_9, height_21_9]

        data = layer.Effects('Layer Data')

        x_16_9 = data('Position X | 16:9')
        y_16_9 = data('Position Y | 16:9')
        z_16_9 = data('Position Z | 16:9')

        x_1_1 = data('Position X | 1:1')
        y_1_1 = data('Position Y | 1:1')
        z_1_1 = data('Position Z | 1:1')

        x_4_5 = data('Position X | 4:5')
        y_4_5 = data('Position Y | 4:5')
        z_4_5 = data('Position Z | 4:5')

        x_9_16 = data('Position X | 9:16')
        y_9_16 = data('Position Y | 9:16')
        z_9_16 = data('Position Z | 9:16')

        x_21_9 = data('Position X | 21:9')
        y_21_9 = data('Position Y | 21:9')
        z_21_9 = data('Position Z | 21:9')

        if (layer.comment != 'ignore') {

            amFile.writeln("		<behavior name=\"Position Data\" id=\"" + x_16_9.value + layer.id + "\" factoryID=\"27\">");
            amFile.writeln("			<channelBehavior affectingFactory=\"ee6b4918387a11d7a02100039375d2ba\" affectingChannel=\"./1/100/101\" sliderRange=\"3.4028234663852886e+38\"/>");
            //amFile.writeln("			<timing in="0 1 1 0" out="-5120 153600 1 0" offset="0 1 1 0"/>");
            amFile.writeln("			<baseFlags>8589934610</baseFlags>");
            amFile.writeln("			<parameter name=\"Affecting Object (Hidden)\" id=\"199\" flags=\"77309476882\" default=\"0\" value=\"" + layers[layer.id][1] + "\"/>");
            amFile.writeln("			<parameter name=\"Widget\" id=\"200\" flags=\"77309476880\" default=\"0\" value=\"10002\"/>");
            amFile.writeln("			<parameter name=\"Snapshots\" id=\"202\" flags=\"8590004242\">");
            amFile.writeln("				<flags>8590004242</flags>");

            setPosition([
                [x_16_9, y_16_9, z_16_9, size_16_9, [1]],
                [x_1_1, y_1_1, z_1_1, size_1_1, [1]],
                [x_4_5, y_4_5, z_4_5, size_4_5, [0.8]],
                [x_9_16, y_9_16, z_9_16, size_9_16, [0.5625]],
                [x_21_9, y_21_9, z_21_9, size_21_9, [1]]
            ])

            // amFile.writeln("				<parameter name=\"Position\" id=\"1\" factoryID=\"33\">");
            // amFile.writeln("					<foldFlags>15</foldFlags>");
            // amFile.writeln("					<parameter name=\"X\" id=\"1\">");
            // amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
            // amFile.writeln("							<keypoint flags=\"0\">");
            // amFile.writeln("								<time>0 1 1 0</time>");
            // amFile.writeln("								<value>0.5</value>");
            // amFile.writeln("							</keypoint>");
            // amFile.writeln("							<keypoint flags=\"0\">");
            // amFile.writeln("								<time>158720 153600 1 0</time>");
            // amFile.writeln("								<value>-958</value>");
            // amFile.writeln("							</keypoint>");
            // amFile.writeln("						</curve>");
            // amFile.writeln("					</parameter>");
            // amFile.writeln("					<parameter name=\"Y\" id=\"2\">");
            // amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"4.2632564145606011e-14\"/>");
            // amFile.writeln("					</parameter>");
            // amFile.writeln("					<parameter name=\"Z\" id=\"3\">");
            // amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\"/>");
            // amFile.writeln("					</parameter>");
            // amFile.writeln("				</parameter>");

            amFile.writeln("			</parameter>");
            amFile.writeln("		</behavior>");

        }

        function setPosition(array) {

            for (var i = 0; i < array.length; i++) {

                var data = array[i]

                var x = data[0]
                var y = data[1]
                var z = data[2]

                var compX = data[3][0]
                var compY = data[3][1]

                var scale = 1

                var index = i + 1

                amFile.writeln("				<parameter name=\"Position\" id=\"" + index + "\" factoryID=\"33\">");
                amFile.writeln("					<foldFlags>11</foldFlags>");

                amFile.writeln("					<parameter name=\"X\" id=\"1\">");
                if (x.isTimeVarying) {

                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, x))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + ((x.value * (-1) + compX / 2) * scale) * (-1) + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("					<parameter name=\"Y\" id=\"2\">");
                if (y.isTimeVarying) {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, y))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (y.value * (-1) + compY / 2) * scale + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("					<parameter name=\"Z\" id=\"3\">");
                if (z.isTimeVarying) {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, z))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (z.value * (-1)) + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("				</parameter>");
            }
        }
    },

    scaleRig: function (layer) {

        data = layer.Effects('Layer Data')

        x_16_9 = data('Scale X | 16:9')
        y_16_9 = data('Scale Y | 16:9')
        z_16_9 = data('Scale Z | 16:9')

        x_1_1 = data('Scale X | 1:1')
        y_1_1 = data('Scale Y | 1:1')
        z_1_1 = data('Scale Z | 1:1')

        x_4_5 = data('Scale X | 4:5')
        y_4_5 = data('Scale Y | 4:5')
        z_4_5 = data('Scale Z | 4:5')

        x_9_16 = data('Scale X | 9:16')
        y_9_16 = data('Scale Y | 9:16')
        z_9_16 = data('Scale Z | 9:16')

        x_21_9 = data('Scale X | 21:9')
        y_21_9 = data('Scale Y | 21:9')
        z_21_9 = data('Scale Z | 21:9')

        if (layer.comment != 'ignore') {

            amFile.writeln("		<behavior name=\"Scale Data\" id=\"" + x_16_9.value + layer.id + "\" factoryID=\"27\">");

            if (layer.matchName == 'ADBE AV Layer' && layer.source.mainSource instanceof SolidSource) {
                amFile.writeln("			<channelBehavior affectingFactory=\"615c4bf6406511d88802000a95af90f2\" affectingChannel=\"./1/100/105\" sliderRange=\"4\"/>");
            } else {
                amFile.writeln("			<channelBehavior affectingFactory=\"ee6b4918387a11d7a02100039375d2ba\" affectingChannel=\"./1/100/105\" sliderRange=\"4\"/>");
            }
            //amFile.writeln("			<timing in="0 1 1 0" out="-5120 153600 1 0" offset="0 1 1 0"/>");
            amFile.writeln("			<baseFlags>8589934610</baseFlags>");
            amFile.writeln("			<parameter name=\"Affecting Object (Hidden)\" id=\"199\" flags=\"77309476882\" default=\"0\" value=\"" + layers[layer.id][1] + "\"/>");
            amFile.writeln("			<parameter name=\"Widget\" id=\"200\" flags=\"77309476880\" default=\"0\" value=\"10002\"/>");
            amFile.writeln("			<parameter name=\"Snapshots\" id=\"202\" flags=\"8590004242\">");
            amFile.writeln("				<flags>8590004242</flags>");

            setScale([
                [x_16_9, y_16_9, z_16_9],
                [x_1_1, y_1_1, z_1_1],
                [x_4_5, y_4_5, z_4_5],
                [x_9_16, y_9_16, z_9_16],
                [x_21_9, y_21_9, z_21_9]
            ])

            amFile.writeln("			</parameter>");
            amFile.writeln("		</behavior>");

        }

        function setScale(array) {

            for (var i = 0; i < array.length; i++) {

                var data = array[i]

                var x = data[0]
                var y = data[1]
                var z = data[2]

                var index = i + 1

                amFile.writeln("				<parameter name=\"Scale\" id=\"" + index + "\" factoryID=\"34\">");
                amFile.writeln("					<foldFlags>11</foldFlags>");

                amFile.writeln("					<parameter name=\"X\" id=\"1\">");
                if (x.isTimeVarying) {

                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, x))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (x.value) / 100 + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("					<parameter name=\"Y\" id=\"2\">");
                if (y.isTimeVarying) {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, y))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (y.value) / 100 + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("					<parameter name=\"Z\" id=\"3\">");
                if (z.isTimeVarying) {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, z))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + z.value / 100 + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("				</parameter>");
            }
        }
    },

    rotationRig: function (layer) {

        data = layer.Effects('Layer Data')

        x_16_9 = data('Rotation X | 16:9')
        y_16_9 = data('Rotation Y | 16:9')
        z_16_9 = data('Rotation Z | 16:9')

        x_1_1 = data('Rotation X | 1:1')
        y_1_1 = data('Rotation Y | 1:1')
        z_1_1 = data('Rotation Z | 1:1')

        x_4_5 = data('Rotation X | 4:5')
        y_4_5 = data('Rotation Y | 4:5')
        z_4_5 = data('Rotation Z | 4:5')

        x_9_16 = data('Rotation X | 9:16')
        y_9_16 = data('Rotation Y | 9:16')
        z_9_16 = data('Rotation Z | 9:16')

        x_21_9 = data('Rotation X | 21:9')
        y_21_9 = data('Rotation Y | 21:9')
        z_21_9 = data('Rotation Z | 21:9')

        if (layer.comment != 'ignore') {

            amFile.writeln("			<behavior name=\"Rotation Data\" id=\"" + x_16_9.value + layer.id + "\" factoryID=\"27\">");
            amFile.writeln("				<channelBehavior affectingFactory=\"ee6b4918387a11d7a02100039375d2ba\" affectingChannel=\"./1/100/109\" sliderRange=\"1\"/>");
            //amFile.writeln("				<timing in="0 1 1 0" out="-5120 153600 1 0" offset="0 1 1 0"/>");
            amFile.writeln("				<baseFlags>8589934610</baseFlags>");
            amFile.writeln("				<parameter name=\"Affecting Object (Hidden)\" id=\"199\" flags=\"77309476882\" default=\"0\" value=\"" + layers[layer.id][1] + "\"/>");
            amFile.writeln("				<parameter name=\"Widget\" id=\"200\" flags=\"77309476880\" default=\"0\" value=\"10002\"/>");
            amFile.writeln("				<parameter name=\"Snapshots\" id=\"202\" flags=\"8590004242\">");
            amFile.writeln("					<flags>8590004242</flags>");

            setRotation([
                [x_16_9, y_16_9, z_16_9],
                [x_1_1, y_1_1, z_1_1],
                [x_4_5, y_4_5, z_4_5],
                [x_9_16, y_9_16, z_9_16],
                [x_21_9, y_21_9, z_21_9]
            ])


            amFile.writeln("				</parameter>");
            amFile.writeln("			</behavior>");

        }

        function setRotation(array) {

            for (var i = 0; i < array.length; i++) {

                var data = array[i]

                var x = data[0]
                var y = data[1]
                var z = data[2]

                var rotation = from_ae_to_motion([x.value, y.value, z.value]);

                var index = i + 1

                amFile.writeln("				<parameter name=\"Rotation\" id=\"" + index + "\" factoryID=\"35\">");
                amFile.writeln("					<foldFlags>11</foldFlags>");

                amFile.writeln("					<parameter name=\"X\" id=\"1\">");
                if (x.isTimeVarying) {

                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, x))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (0.01745329251994332 * rotation[0]) + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("					<parameter name=\"Y\" id=\"2\">");
                if (y.isTimeVarying) {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, y))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (0.01745329251994332 * rotation[1]) + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("					<parameter name=\"Z\" id=\"3\">");
                if (z.isTimeVarying) {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"0\">");
                    amFile.writeln("                           <keypoint interpolation=\"0\" flags=\"0\">");

                    amFile.writeln($.mot.getDataKeyMotion(layer, z))

                    amFile.writeln("							</keypoint>");
                    amFile.writeln("						</curve>");
                } else {
                    amFile.writeln("						<curve type=\"1\" default=\"0\" value=\"" + (0.01745329251994332 * rotation[2]) + "\"/>");
                }
                amFile.writeln("					</parameter>");

                amFile.writeln("						<parameter name=\"Animate\" id=\"4\">");
                amFile.writeln("							<flags>8606777360</flags>");
                amFile.writeln("							<curve type=\"0\" default=\"0\" value=\"0\">");
                amFile.writeln("								<min>0</min>");
                amFile.writeln("								<max>4294967295</max>");
                amFile.writeln("							</curve>");
                amFile.writeln("						</parameter>");

                amFile.writeln("				</parameter>");
            }
        }
    },

    returnValueTime: function (property, axis) {

        var layer = property.propertyGroup(property.propertyDepth);
        var comp = layer.containingComp;

        var frame = comp.frameDuration
        var currentKey = 0;

        var value = [];
        var valueTime = [];

        var originalValue
        var currentValue;
        var previousValue;
        var nextValue;

        var fixed = 1;

        var inPoint;
        var outPoint;

        if (property.expressionEnabled) {
            inPoint = layer.inPoint;
            outPoint = layer.outPoint < comp.duration ? layer.outPoint : comp.duration;
        } else if (!property.expressionEnabled && property.numKeys > 0) {
            inPoint = property.keyTime(1);
            outPoint = property.keyTime(property.numKeys) + frame;
        } else if (!property.expressionEnabled && property.numKeys === 0) {
            inPoint = layer.inPoint;
            outPoint = layer.inPoint + frame;
        }

        for (var i = inPoint; i <= outPoint; i += frame) {

            if (axis === '' && property.matchName != 'ADBE Time Remapping') {

                originalValue = property.valueAtTime(i, false)

                if (property.propertyValueType === PropertyValueType.OneD) {

                    currentValue = property.valueAtTime(i, false).toFixed(fixed)
                    previousValue = property.valueAtTime(i - frame, false).toFixed(fixed)
                    nextValue = property.valueAtTime(i + frame, false).toFixed(fixed)

                    currentValue == -0.0 ? currentValue = Math.abs(currentValue) : false
                    previousValue == -0.0 ? previousValue = Math.abs(previousValue) : false
                    nextValue == -0.0 ? nextValue = Math.abs(nextValue) : false
                }

                if (property.propertyValueType === PropertyValueType.TwoD || property.propertyValueType === PropertyValueType.TwoD_SPATIAL) {

                    currentValue = [property.valueAtTime(i, false)[0].toFixed(fixed), property.valueAtTime(i, false)[1].toFixed(fixed)]
                    previousValue = [property.valueAtTime(i - frame, false)[0].toFixed(fixed), property.valueAtTime(i - frame, false)[1].toFixed(fixed)]
                    nextValue = [property.valueAtTime(i + frame, false)[0].toFixed(fixed), property.valueAtTime(i + frame, false)[1].toFixed(fixed)]
                }

                if (property.propertyValueType === PropertyValueType.ThreeD || property.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {

                    currentValue = [property.valueAtTime(i, false)[0].toFixed(fixed), property.valueAtTime(i, false)[1].toFixed(fixed), property.valueAtTime(i, false)[2].toFixed(fixed)]
                    previousValue = [property.valueAtTime(i - frame, false)[0].toFixed(fixed), property.valueAtTime(i - frame, false)[1].toFixed(fixed), property.valueAtTime(i - frame, false)[2].toFixed(fixed)]
                    nextValue = [property.valueAtTime(i + frame, false)[0].toFixed(fixed), property.valueAtTime(i + frame, false)[1].toFixed(fixed), property.valueAtTime(i + frame, false)[2].toFixed(fixed)]
                }
            }

            if (axis === '' && property.matchName == 'ADBE Time Remapping') {

                originalValue = property.valueAtTime(i, false)

                currentValue = property.valueAtTime(i, false)
                previousValue = property.valueAtTime(i - frame, false)
                nextValue = property.valueAtTime(i + frame, false)

            }

            if (axis === 0) {

                originalValue = property.valueAtTime(i, false)[0]

                currentValue = property.valueAtTime(i, false)[0].toFixed(fixed);
                previousValue = property.valueAtTime(i - frame, false)[0].toFixed(fixed);
                nextValue = property.valueAtTime(i + frame, false)[0].toFixed(fixed);
            }

            if (axis === 1) {

                originalValue = property.valueAtTime(i, false)[1]

                currentValue = property.valueAtTime(i, false)[1].toFixed(fixed);
                previousValue = property.valueAtTime(i - frame, false)[1].toFixed(fixed);
                nextValue = property.valueAtTime(i + frame, false)[1].toFixed(fixed);
            }

            if (axis === 2) {

                originalValue = property.valueAtTime(i, false)[2]

                currentValue = property.valueAtTime(i, false)[2].toFixed(fixed);
                previousValue = property.valueAtTime(i - frame, false)[2].toFixed(fixed);
                nextValue = property.valueAtTime(i + frame, false)[2].toFixed(fixed);
            }

            if (currentValue.toString() != nextValue.toString() || currentValue.toString() != previousValue.toString()) {
                currentKey++

                $.ae.progressInfo(layer, currentKey, property, originalValue);
                valueTime.push(i);
            }
        }

        if (valueTime.length === 0) {
            valueTime.push(layer.inPoint);
        }

        return valueTime[valueTime.length - 1];
    },
}