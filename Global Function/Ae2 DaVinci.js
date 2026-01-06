$.dr = {
  drName: function (str) {
    const specialChars = {
      "!": "",
      "?": "",
      "&": "",
      "<": "",
      "@": "",
      "#": "",
      ">": "",
      '"': "",
      "'": "",
      "/": "",
      "`": "",
      "=": "",
      " ": "_",
      "-": "",
      ",": "_",
      ".": "_",
      "*": "",
      "(": "",
      ")": "",
      "+": "", // Добавлено для замены +
      "[": "", // Добавлено для замены [
      "]": "", // Добавлено для замены ]
      "\u0003": "",
    };

    return str.replace(/[?!&@#<()>"*'`=.,\/ \[\]\-\+]/g, function (match) {
      return specialChars[match];
    });
  },

  formatKeyData: function (keyData) {
    var result = "";
    for (var k in keyData) {
      if (keyData.hasOwnProperty(k)) {
        result += "[" + k + "] = { ";
        var keyObj = keyData[k];
        var isFirstItem = true;
        for (var key in keyObj) {
          if (keyObj.hasOwnProperty(key)) {
            if (key === "value") {
              result += keyObj[key] + ", ";
            } else if (Array.isArray(keyObj[key])) {
              result += key + " = { " + keyObj[key].join(", ") + " }, ";
            } else {
              result += key + " = { " + keyObj[key] + " }, ";
            }
          }
          isFirstItem = false;
        }
        result = result.slice(0, -2); // удаляем последнюю запятую и пробел
        result += " },\n";
      }
    }
    return result;
  },

  getBezierValue: function (v1, v2, x) {
    if (x instanceof Array) {
      x = x[0];
    }
    return (v1 + (v2 - v1) * x).toFixed(10);
  },

  drBezierKeys: function (data) {
    var bezier = data.bezier;
    var property = data.property;
    //var type = data.type;
    var axis = data.axis;
    var comp = property.propertyGroup(property.propertyDepth).containingComp;
    var compStartTime = comp.displayStartTime / comp.frameDuration;

    if (
      property.isSpatial ||
      property.matchName == "ADBE Position_0" ||
      property.matchName == "ADBE Position_1"
    ) {
      var compAxis;
      if (axis === "x") {
        compAxis = comp.width;
      }
      if (axis === "y") {
        compAxis = comp.height;
      }
    }

    var result = [];

    try {
      for (var i = 0; i < bezier.length; i++) {
        var item = bezier[i];
        var time = compStartTime + item.t;
        var prevValue, value, nextValue;
        var prevHold, hold, nextHold;

        // if(i === 0){
        //   hold = item.h ? true : false;
        // } else if (i === bezier.length - 1) {
        //   prevHold = bezier[i - 1].h ? true : false;
        // }else {
        //   nextHold = bezier[i + 1].h ? true : false;
        //   prevHold = bezier[i - 1].h ? true : false;
        // }

        if (
          property.isSpatial ||
          property.matchName == "ADBE Position_0" ||
          property.matchName == "ADBE Position_1"
        ) {
          if (axis === "x" || axis === "y") {
            if (property.value instanceof Array) {
              var axisIndex = axis === "x" ? 0 : 1;
              value =
                axis === "x"
                  ? item.v[axisIndex] / compAxis
                  : (item.v[axisIndex] / compAxis) * -1 + 1;

              if (i === 0) {
                nextValue =
                  axis === "x"
                    ? bezier[i + 1].v[axisIndex] / compAxis
                    : (bezier[i + 1].v[axisIndex] / compAxis) * -1 + 1;
              } else if (i === bezier.length - 1) {
                prevValue =
                  axis === "x"
                    ? bezier[i - 1].v[axisIndex] / compAxis
                    : (bezier[i - 1].v[axisIndex] / compAxis) * -1 + 1;
              } else {
                nextValue =
                  axis === "x"
                    ? bezier[i + 1].v[axisIndex] / compAxis
                    : (bezier[i + 1].v[axisIndex] / compAxis) * -1 + 1;
                prevValue =
                  axis === "x"
                    ? bezier[i - 1].v[axisIndex] / compAxis
                    : (bezier[i - 1].v[axisIndex] / compAxis) * -1 + 1;
              }
            } else {
              value =
                axis === "x" ? item.v / compAxis : (item.v / compAxis) * -1 + 1;
              if (i === 0) {
                nextValue =
                  axis === "x"
                    ? bezier[i + 1].v / compAxis
                    : (bezier[i + 1].v / compAxis) * -1 + 1;
              } else if (i === bezier.length - 1) {
                prevValue =
                  axis === "x"
                    ? bezier[i - 1].v / compAxis
                    : (bezier[i - 1].v / compAxis) * -1 + 1;
              } else {
                nextValue =
                  axis === "x"
                    ? bezier[i + 1].v / compAxis
                    : (bezier[i + 1].v / compAxis) * -1 + 1;
                prevValue =
                  axis === "x"
                    ? bezier[i - 1].v / compAxis
                    : (bezier[i - 1].v / compAxis) * -1 + 1;
              }
            }
          }
        }

        if (property.matchName == "ADBE Scale") {
          if (axis === "x") {
            value = item.v[0] / 100;
            if (i === 0) {
              nextValue = bezier[i + 1].v[0] / 100;
            } else if (i === bezier.length - 1) {
              prevValue = bezier[i - 1].v[0] / 100;
            } else {
              nextValue = bezier[i + 1].v[0] / 100;
              prevValue = bezier[i - 1].v[0] / 100;
            }
          }
          if (axis === "y") {
            value = item.v[1] / 100;
            if (i === 0) {
              nextValue = bezier[i + 1].v[1] / 100;
            } else if (i === bezier.length - 1) {
              prevValue = bezier[i - 1].v[1] / 100;
            } else {
              nextValue = bezier[i + 1].v[1] / 100;
              prevValue = bezier[i - 1].v[1] / 100;
            }
          }
        }

        if (property.matchName == "ADBE Vector Ellipse Size") {
          var axisIndex = axis === "x" ? 0 : 1;
          value = item.v[axisIndex] / comp.width;
          if (i === 0) {
            nextValue = bezier[i + 1].v[axisIndex] / comp.width;
          } else if (i === bezier.length - 1) {
            prevValue = bezier[i - 1].v[axisIndex] / comp.width;
          } else {
            nextValue = bezier[i + 1].v[axisIndex] / comp.width;
            prevValue = bezier[i - 1].v[axisIndex] / comp.width;
          }
        }

        if (property.matchName == "ADBE Vector Rect Size") {
          var axisIndex = axis === "x" ? 0 : 1;
          var compAxis;
          if (axis === "x") {
            compAxis = comp.width;
          }
          if (axis === "y") {
            compAxis = comp.height;
          }
          value = item.v[axisIndex] / compAxis;
          if (i === 0) {
            nextValue = bezier[i + 1].v[axisIndex] / compAxis;
          } else if (i === bezier.length - 1) {
            prevValue = bezier[i - 1].v[axisIndex] / compAxis;
          } else {
            nextValue = bezier[i + 1].v[axisIndex] / compAxis;
            prevValue = bezier[i - 1].v[axisIndex] / compAxis;
          }
        }

        if (
          property.matchName == "ADBE Rotate Z" ||
          property.matchName == "ADBE Angle Control-0001" ||
          property.matchName == "ADBE Geometry2-0007"
        ) {
          value = item.v * -1;
          if (i === 0) {
            nextValue = bezier[i + 1].v * -1;
          } else if (i === bezier.length - 1) {
            prevValue = bezier[i - 1].v * -1;
          } else {
            nextValue = bezier[i + 1].v * -1;
            prevValue = bezier[i - 1].v * -1;
          }
        }

        if (
          (property.hasMax && property.maxValue == 100) ||
          property.matchName == "ADBE Slider Control-0001" ||
          property.matchName == "ADBE Gaussian Blur-0001" ||
          property.matchName == "ADBE Gaussian Blur 2-0001" ||
          property.matchName == "ADBE Geometry2-0003" ||
          property.matchName == "ADBE Geometry2-0004"
        ) {
          value = item.v / 100;
          if (i === 0) {
            nextValue = bezier[i + 1].v / 100;
          } else if (i === bezier.length - 1) {
            prevValue = bezier[i - 1].v / 100;
          } else {
            nextValue = bezier[i + 1].v / 100;
            prevValue = bezier[i - 1].v / 100;
          }
        }

        if (property.matchName == "ADBE Vector Trim Offset") {
          value = item.v / 360;
          if (i === 0) {
            nextValue = bezier[i + 1].v / 360;
          } else if (i === bezier.length - 1) {
            prevValue = bezier[i - 1].v / 360;
          } else {
            nextValue = bezier[i + 1].v / 360;
            prevValue = bezier[i - 1].v / 360;
          }
        }

        var lhTime, rhTime;
        var resultString = "[" + time + "] = { " + value.toFixed(10);

        // Для первого и последнего элемента обрабатываем отсутствие LH и RH
        if (i === 0) {
          // Обрабатываем RH
          rhTime = getBezierValue(
            time,
            compStartTime + bezier[i + 1].t,
            item.i.x
          );
          resultString +=
            ", RH = { " +
            rhTime +
            ", " +
            getBezierValue(value, nextValue, item.i.y) +
            " }";
        } else if (i === bezier.length - 1) {
          // Обрабатываем LH
          lhTime = getBezierValue(
            compStartTime + bezier[i - 1].t,
            time,
            bezier[i - 1].o.x
          );
          resultString +=
            ", LH = { " +
            lhTime +
            ", " +
            getBezierValue(prevValue, value, bezier[i - 1].o.y) +
            " }";
        } else {
          // Обрабатываем и LH, и RH
          lhTime = getBezierValue(
            compStartTime + bezier[i - 1].t,
            time,
            bezier[i - 1].o.x
          );
          rhTime = getBezierValue(
            compStartTime + time,
            bezier[i + 1].t,
            item.i.x
          );
          resultString +=
            ", LH = { " +
            lhTime +
            ", " +
            getBezierValue(prevValue, value, bezier[i - 1].o.y) +
            " }, RH = { " +
            rhTime +
            ", " +
            getBezierValue(value, nextValue, item.i.y) +
            " }";
        }

        resultString += " }";
        result.push(resultString);
      }
    } catch (e) {
      alert(e);
    }

    return result.join(",");
  },

  drBezierAnimator: function (data) {
    var bezier = data.bezier;
    var property = data.property;
    var animator = data.animator;
    var timeFactor = data.timeFactor;
    //var type = data.type;
    var axis = data.axis;
    var comp = property.propertyGroup(property.propertyDepth).containingComp;
    var compStartTime = comp.displayStartTime / comp.frameDuration;

    var result = [];

    try {
      for (var i = 0; i < bezier.length; i++) {
        var item = bezier[i];
        var time = compStartTime + item.t / timeFactor;
        var prevValue, value, nextValue;

        if (
          property.matchName == "ADBE Text Percent Start" ||
          property.name.toLowerCase().match("trim")
        ) {
          value = item.v / 100;
          if (i === 0) {
            nextValue = bezier[i + 1].v / 100;
          } else if (i === bezier.length - 1) {
            prevValue = bezier[i - 1].v / 100;
          } else {
            nextValue = bezier[i + 1].v / 100;
            prevValue = bezier[i - 1].v / 100;
          }
        }

        if (
          property.parentProperty == "Responsive Rectangle" &&
          !property.name.toLowerCase().match("trim")
        ) {
          if (
            property.name == "All" ||
            property.name == "Left" ||
            property.name == "Right"
          ) {
            value = item.v / comp.width;
            if (i === 0) {
              nextValue = bezier[i + 1].v / comp.width;
            } else if (i === bezier.length - 1) {
              prevValue = bezier[i - 1].v / comp.width;
            } else {
              nextValue = bezier[i + 1].v / comp.width;
              prevValue = bezier[i - 1].v / comp.width;
            }
          } else {
            value = item.v / comp.height;
            if (i === 0) {
              nextValue = bezier[i + 1].v / comp.height;
            } else if (i === bezier.length - 1) {
              prevValue = bezier[i - 1].v / comp.height;
            } else {
              nextValue = bezier[i + 1].v / comp.height;
              prevValue = bezier[i - 1].v / comp.height;
            }
          }
        }

        if (animator.matchName === "ADBE Text Position 3D") {
          var compAxis;
          if (axis === "x") {
            compAxis = comp.width;
          }
          if (axis === "y") {
            compAxis = comp.height * 2;
          }

          var axisIndex = axis === "x" ? 0 : 1;
          var multiply;
          multiply = axis === "x" ? 1 : -1;

          value =
            (animator.value[axisIndex] / compAxis) * (1 - value) * multiply;

          if (i === 0) {
            nextValue =
              (animator.value[axisIndex] / compAxis) *
              (1 - nextValue) *
              multiply;
          } else if (i === bezier.length - 1) {
            prevValue =
              (animator.value[axisIndex] / compAxis) *
              (1 - prevValue) *
              multiply;
          } else {
            nextValue =
              (animator.value[axisIndex] / compAxis) *
              (1 - nextValue) *
              multiply;
            prevValue =
              (animator.value[axisIndex] / compAxis) *
              (1 - prevValue) *
              multiply;
          }
        }

        if (animator.matchName === "ADBE Text Scale 3D") {
          var axisIndex = axis === "x" ? 0 : 1;

          value = (animator.value[axisIndex] / 100 - 1) * (1 - value) + 1;

          if (i === 0) {
            nextValue =
              (animator.value[axisIndex] / 100 - 1) * (1 - nextValue) + 1;
          } else if (i === bezier.length - 1) {
            prevValue =
              (animator.value[axisIndex] / 100 - 1) * (1 - prevValue) + 1;
          } else {
            nextValue =
              (animator.value[axisIndex] / 100 - 1) * (1 - nextValue) + 1;
            prevValue =
              (animator.value[axisIndex] / 100 - 1) * (1 - prevValue) + 1;
          }
        }

        if (animator.matchName === "ADBE Text Rotation") {
          value = animator.value * (1 - value) * -1;

          if (i === 0) {
            nextValue = animator.value * (1 - nextValue) * -1;
          } else if (i === bezier.length - 1) {
            prevValue = animator.value * (1 - prevValue) * -1;
          } else {
            nextValue = animator.value * (1 - nextValue) * -1;
            prevValue = animator.value * (1 - prevValue) * -1;
          }
        }

        if (animator.matchName === "ADBE Text Opacity") {
          value = animator.value + 1 * value;

          if (i === 0) {
            nextValue = animator.value + 1 * nextValue;
          } else if (i === bezier.length - 1) {
            prevValue = animator.value + 1 * prevValue;
          } else {
            nextValue = animator.value + 1 * nextValue;
            prevValue = animator.value + 1 * prevValue;
          }
        }

        var lhTime, rhTime;
        var resultString = "[" + time + "] = { " + value.toFixed(10);

        // Для первого и последнего элемента обрабатываем отсутствие LH и RH
        if (i === 0) {
          // Обрабатываем RH
          rhTime = getBezierValue(
            time,
            compStartTime + bezier[i + 1].t / timeFactor,
            item.i.x
          );
          resultString +=
            ", RH = { " +
            rhTime +
            ", " +
            getBezierValue(value, nextValue, item.i.y) +
            " }";
        } else if (i === bezier.length - 1) {
          // Обрабатываем LH
          lhTime = getBezierValue(
            compStartTime + bezier[i - 1].t / timeFactor,
            time,
            bezier[i - 1].o.x
          );
          resultString +=
            ", LH = { " +
            lhTime +
            ", " +
            getBezierValue(prevValue, value, bezier[i - 1].o.y) +
            " }";
        } else {
          // Обрабатываем и LH, и RH
          lhTime = getBezierValue(
            compStartTime + bezier[i - 1].t / timeFactor,
            time,
            bezier[i - 1].o.x
          );
          rhTime = getBezierValue(
            compStartTime + time,
            bezier[i + 1].t / timeFactor,
            item.i.x
          );
          resultString +=
            ", LH = { " +
            lhTime +
            ", " +
            getBezierValue(prevValue, value, bezier[i - 1].o.y) +
            " }, RH = { " +
            rhTime +
            ", " +
            getBezierValue(value, nextValue, item.i.y) +
            " }";
        }

        resultString += " }";
        result.push(resultString);
      }
    } catch (e) {
      alert(e);
    }

    return result.join(",");
  },

  getKeyDr: function (property, type, comment, template) {
    $.writeln(property.name);
    if (!type) {
      type = "";
    }

    var typePosition = ["ADBE Position", "ADBE Offset-0001"];

    var typeScale = ["ADBE Scale"];

    var typeRotation = [
      "ADBE Rotate Z",
      "ADBE Angle Control-0001",
      "ADBE Geometry2-0007",
    ];

    var typeOther = [
      "ADBE Opacity",
      "ADBE Slider Control-0001",
      "ADBE Vector Trim Start",
      "ADBE Vector Trim End",
      "ADBE Geometry2-0003",
      "ADBE Geometry2-0004",
      "ADBE Geometry2-0008",
      "ADBE Gaussian Blur-0001",
      "ADBE Gaussian Blur 2-0001",
    ];

    var layer = property.propertyGroup(property.propertyDepth);
    var position = layer.position;
    var anchor = layer.anchorPoint;
    var rect = layer.sourceRectAtTime(layer.time, false);

    var shapeAnchor;
    var comp = layer.containingComp;
    var propertyValueData = $.ae.getPropertyKey(layer, type, property);

    var matchName = property.matchName;
    var propertyType = property.propertyValueType;

    var keyData = "";

    for (var i = 0; i < propertyValueData[0].length; i++) {
      if (
        propertyType == PropertyValueType.ThreeD_SPATIAL ||
        propertyType == PropertyValueType.TwoD_SPATIAL
      ) {
        if (type === "x") {
          if (matchName.match("Corner")) {
            value = propertyValueData[1][i] / rect.width;
          } else {
            if (layer instanceof TextLayer) {
              value = propertyValueData[1][i] / comp.width;
            } else {
              value =
                propertyValueData[1][i] / comp.width -
                anchor.value[0] / comp.width +
                (rect.left + rect.width / 2) / comp.width;
            }
            if (
              matchName == "ADBE Vector Rect Position" ||
              matchName == "ADBE Vector Ellipse Position"
            ) {
              shapeAnchor = layer.property("ADBE Root Vectors Group")(1)(
                "ADBE Vector Transform Group"
              )("ADBE Vector Anchor");
              var offsetX =
                position.valueAtTime(propertyValueData[0][i], false)[0] -
                (position.valueAtTime(propertyValueData[0][i], false)[0] -
                  layer.sourcePointToComp(shapeAnchor.value)[0]);
              var anchorOffsetX =
                (layer.sourcePointToComp(anchor.value.slice(0, 2))[0] -
                  layer.sourcePointToComp([
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  ])[0]) *
                -1;
              value =
                propertyValueData[1][i] / comp.width +
                offsetX / comp.width -
                anchorOffsetX / comp.width +
                (rect.left + rect.width / 2) / comp.width;
            }
          }
        }

        if (type === "y") {
          if (matchName.match("Corner")) {
            value = (propertyValueData[1][i] / rect.height) * -1 + 1;
          } else {
            if (layer instanceof TextLayer) {
              value = (propertyValueData[1][i] / comp.height) * -1 + 1;
            } else {
              value =
                (propertyValueData[1][i] / comp.height -
                  anchor.value[1] / comp.height +
                  (rect.top + rect.height / 2) / comp.height) *
                  -1 +
                1;
              if (
                matchName == "ADBE Vector Rect Position" ||
                matchName == "ADBE Vector Ellipse Position"
              ) {
                shapeAnchor = layer.property("ADBE Root Vectors Group")(1)(
                  "ADBE Vector Transform Group"
                )("ADBE Vector Anchor");
                var offsetY =
                  position.valueAtTime(propertyValueData[0][i], false)[1] -
                  (position.valueAtTime(propertyValueData[0][i], false)[1] -
                    layer.sourcePointToComp(shapeAnchor.value)[1]);
                var anchorOffsetY =
                  (layer.sourcePointToComp(anchor.value.slice(0, 2))[1] -
                    layer.sourcePointToComp([
                      rect.left + rect.width / 2,
                      rect.top + rect.height / 2,
                    ])[1]) *
                  -1;
                value =
                  (propertyValueData[1][i] / comp.height) * -1 +
                  (offsetY / comp.height -
                    anchorOffsetY / comp.height +
                    (rect.top + rect.height / 2) / comp.height) *
                    -1 +
                  1;
              }
            }
          }
        }
      }

      if (
        propertyType == PropertyValueType.ThreeD ||
        propertyType == PropertyValueType.TwoD ||
        matchName == $.ae.findMatch(matchName, typeOther) ||
        comment == "scale"
      ) {
        value = propertyValueData[1][i] / 100;
      }

      if (matchName == $.ae.findMatch(matchName, typeRotation)) {
        value = propertyValueData[1][i] * -1;
      }

      if (property.matchName == "ADBE Vector Ellipse Size") {
        value = propertyValueData[1][i] / comp.width;
      }

      if (property.matchName == "ADBE Vector Trim Offset") {
        value = propertyValueData[1][i] / 360;
      }

      if (property.matchName == "ADBE Vector Rect Size") {
        if (type === "x") {
          value = propertyValueData[1][i] / comp.width;
        } else {
          value = propertyValueData[1][i] / comp.height;
        }
      }

      if (property.parentProperty == "Responsive Rectangle") {
        if (property.name.toLowerCase().match("trim")) {
          value = propertyValueData[1][i] / 100;
        } else {
          if (
            property.name == "All" ||
            property.name == "Left" ||
            property.name == "Right"
          ) {
            value = propertyValueData[1][i] / comp.width;
          } else {
            value = propertyValueData[1][i] / comp.height;
          }
        }
      }

      if (property.matchName == "ADBE Mosaic-0001") {
        value = propertyValueData[1][i];
      }

      // if (type === 'Value') {
      //     value = propertyValueData[1][i];
      // }

      if (template) {
        keyData +=
          "			[" +
          (comp.displayStartTime / comp.frameDuration +
            Math.round(propertyValueData[0][i] / comp.frameDuration) -
            layer.inPoint / comp.frameDuration) +
          // + (layer.inPoint - layer.startTime) / comp.frameDuration
          "] = { " +
          value +
          ", Flags = { StepIn = true } },\n";
        //keyData += "" + (comp.displayStartTime / comp.frameDuration + Math.round(propertyValueData[0][i] / comp.frameDuration)) + ".0: {1: " + value + ", 'StepIn': True}, ";
      } else {
        $.writeln(propertyValueData[1][i])
        $.writeln(value)
        keyData +=
          "			[" +
          (comp.displayStartTime / comp.frameDuration +
            Math.round(propertyValueData[0][i] / comp.frameDuration)) +
          "] = { " +
          value +
          ", Flags = { StepIn = true } },\n";
      }
    }

    return keyData;
  },

  isHoldKeys: function (property) {
    if (property.numKeys > 0) {
      for (var i = 1; i <= property.numKeys; i++) {
        if (
          property.keyInInterpolationType(i) ===
            KeyframeInterpolationType.HOLD ||
          property.keyOutInterpolationType(i) === KeyframeInterpolationType.HOLD
        ) {
          return true;
        }
      }
    }
    return false;
  },

  getValueDr: function (property) {
    var propertyType = property.propertyValueType;
    var layer = property.propertyGroup(property.propertyDepth);
    var rect = layer.sourceRectAtTime(layer.time, false);
    var anchor = layer.anchorPoint;
    var comp = layer.containingComp;

    if (
      propertyType == PropertyValueType.ThreeD_SPATIAL ||
      propertyType == PropertyValueType.TwoD_SPATIAL
    ) {
      if (layer instanceof TextLayer) {
        value = [
          property.value[0] / comp.width,
          (property.value[1] / comp.height) * -1 + 1,
        ];
      } else {
        value = [
          property.value[0] / comp.width -
            anchor.value[0] / comp.width +
            (rect.left + rect.width / 2) / comp.width,
          (property.value[1] / comp.height -
            anchor.value[1] / comp.height +
            (rect.top + rect.height / 2) / comp.height) *
            -1 +
            1,
        ];
      }

      return (
        "            Center = Input { Value = { " +
        value[0] +
        ", " +
        value[1] +
        " }, },"
      );
    }
  },

  createParentControl: function (layer, matchName) {
    var effects = layer.Effects;

    switch (matchName) {
      case PropertyValueType.ThreeD_SPATIAL || PropertyValueType.TwoD_SPATIAL:
        layer.transform.position.dimensionsSeparated = false;
        var expressionControl = effects.addProperty("ADBE Point3D Control");
        expressionControl(1).expression =
          "thisLayer.toWorld(transform.anchorPoint)";
        return expressionControl;

      case PropertyValueType.ThreeD || PropertyValueType.TwoD:
        var expressionControl = effects.addProperty("ADBE Point3D Control");
        expressionControl(1).expression =
          "(function(_0x15861b,_0x15d379){function _0x4abb90(_0x1fa4d7,_0x538af5){return _0x25a9(_0x538af5- -0xcb,_0x1fa4d7);}var _0x4f491c=_0x15861b();while(!![]){try{var _0x892622=parseInt(_0x4abb90(0xb3,0xab))/0x1*(parseInt(_0x4abb90(0xb4,0xad))/0x2)+-parseInt(_0x4abb90(0xae,0xb1))/0x3*(-parseInt(_0x4abb90(0xa9,0xaf))/0x4)+parseInt(_0x4abb90(0xae,0xb2))/0x5+-parseInt(_0x4abb90(0xab,0xac))/0x6*(-parseInt(_0x4abb90(0xb3,0xb3))/0x7)+parseInt(_0x4abb90(0xa6,0xa9))/0x8+parseInt(_0x4abb90(0xae,0xa7))/0x9+-parseInt(_0x4abb90(0xad,0xb0))/0xa*(parseInt(_0x4abb90(0xa9,0xaa))/0xb);if(_0x892622===_0x15d379)break;else _0x4f491c['push'](_0x4f491c['shift']());}catch(_0x3abaa2){_0x4f491c['push'](_0x4f491c['shift']());}}}(_0x490d,0xdd260));var l=thisLayer,originalSize=[l[_0x586db4(-0x12d,-0x12a)](time,!![])[_0x586db4(-0x12b,-0x126)],l[_0x586db4(-0x12d,-0x12f)](time,!![])[_0x586db4(-0x11f,-0x120)]],layerTopLeft=[0x0,0x0],layerTopRight=[originalSize[0x0],0x0],layerBottomLeft=[0x0,originalSize[0x1]];function _0x586db4(_0x1efb5a,_0x824fef){return _0x25a9(_0x1efb5a- -0x29e,_0x824fef);}var worldTopLeft=l[_0x586db4(-0x125,-0x123)](layerTopLeft),worldTopRight=l[_0x586db4(-0x125,-0x120)](layerTopRight),worldBottomLeft=l[_0x586db4(-0x125,-0x129)](layerBottomLeft),width=length(worldTopRight,worldTopLeft),height=length(worldBottomLeft,worldTopLeft),currentSize=[width,height],percentSize=[currentSize[0x0]/originalSize[0x0]*0x64,currentSize[0x1]/originalSize[0x1]*0x64];function _0x25a9(_0x5cf87a,_0x16d9f7){var _0x490d40=_0x490d();return _0x25a9=function(_0x25a9ca,_0x384bef){_0x25a9ca=_0x25a9ca-0x171;var _0x13c2f9=_0x490d40[_0x25a9ca];return _0x13c2f9;},_0x25a9(_0x5cf87a,_0x16d9f7);}function _0x490d(){var _0x1e5309=['width','12723976EKmKma','1994113EhGYPY','49pkakrD','1086RzXQaX','10446zLGmoi','toWorld','100KVMpNu','290qEibWr','117945QfTiod','7627780Fjjwwp','16457YrkdWS','height','sourceRectAtTime','12443805wddQwQ'];_0x490d=function(){return _0x1e5309;};return _0x490d();}percentSize;";
        return expressionControl;

      case "ADBE Rotate Z":
        var expressionControl = effects.addProperty("ADBE Angle Control");
        expressionControl(1).expression =
          "var p1 = thisLayer.toWorld([0,0,0]);\nvar p2 = thisLayer.toWorld([1,0,0]);\nvar angle = Math.atan2(p2[1]-p1[1], p2[0]-p1[0]);\nradiansToDegrees(angle);";
        return expressionControl;
    }
  },

  getParentAnimation: function (layer, matchName) {
    var expressionControl = $.dr.createParentControl(layer, matchName);
    return expressionControl;
  },
};
