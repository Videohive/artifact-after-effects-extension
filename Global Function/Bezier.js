//@include "./Ae2 Motion.js"

function getBezier(property) {
  var comp = property.propertyGroup(property.propertyDepth).containingComp;
  var layerOb = {};

  var ob = {};
  ob.roundNumber = roundNumber;
  ob.convertToBezierValues = convertToBezierValues;

  var extrasInstance = ob;
  layerOb.ks = {};

  function convertToBezierValues(property, frameRate, ob, propertyName) {
    function getPropertyValue(value, roundFlag) {
      switch (property.propertyValueType) {
        case PropertyValueType.SHAPE:
          var elem = {
            i: roundFlag ? extrasInstance.roundNumber(value.inTangents, 3) : value.inTangents,
            o: roundFlag ? extrasInstance.roundNumber(value.outTangents, 3) : value.outTangents,
            v: roundFlag ? extrasInstance.roundNumber(value.vertices, 3) : value.vertices
          };
          return elem;
        case PropertyValueType.COLOR:
          var i, len = value.length;
          for (i = 0; i < len; i += 1) {
            value[i] = Math.round(value[i] * 255);
          }
          return value;
        default:
          return roundFlag ? extrasInstance.roundNumber(value, 3) : value;
      }
    }

    var j = 1,
      jLen = property.numKeys;
    var beziersArray = [];
    var averageSpeed, duration;
    var bezierIn, bezierOut;

    function buildSegment(segmentOb, indexTime) {

      function getCurveLength(initPos, endPos, outBezier, inBezier) {
        var k, curveSegments = 200;
        var point, lastPoint = null;
        var ptDistance;
        var absToCoord, absTiCoord;
        var triCoord1, triCoord2, triCoord3, liCoord1, liCoord2, ptCoord, perc, addedLength = 0;
        for (k = 0; k < curveSegments; k += 1) {
          point = [];
          perc = k / (curveSegments - 1);
          ptDistance = 0;
          absToCoord = [];
          absTiCoord = [];
          outBezier.forEach(function (item, index) {
            if (absToCoord[index] == null) {
              absToCoord[index] = initPos[index] + outBezier[index];
              absTiCoord[index] = endPos[index] + inBezier[index];
            }
            triCoord1 = initPos[index] + (absToCoord[index] - initPos[index]) * perc;
            triCoord2 = absToCoord[index] + (absTiCoord[index] - absToCoord[index]) * perc;
            triCoord3 = absTiCoord[index] + (endPos[index] - absTiCoord[index]) * perc;
            liCoord1 = triCoord1 + (triCoord2 - triCoord1) * perc;
            liCoord2 = triCoord2 + (triCoord3 - triCoord2) * perc;
            ptCoord = liCoord1 + (liCoord2 - liCoord1) * perc;
            point.push(ptCoord);
            if (lastPoint !== null) {
              ptDistance += Math.pow(point[index] - lastPoint[index], 2);
            }
          });
          ptDistance = Math.sqrt(ptDistance);
          addedLength += ptDistance;
          lastPoint = point;
        }
        return addedLength;
      }

      var i, len;
      var key = {};
      var lastKey = {};
      var interpolationType = '';
      key.time = property.keyTime(indexTime + 1);
      lastKey.time = property.keyTime(indexTime);
      key.value = getPropertyValue(property.keyValue(indexTime + 1), false);
      lastKey.value = getPropertyValue(property.keyValue(indexTime), false);
      if (!(key.value instanceof Array)) {
        key.value = [key.value];
        lastKey.value = [lastKey.value];
      }
      if (property.keyOutInterpolationType(indexTime) == KeyframeInterpolationType.HOLD) {
        interpolationType = 'hold';
      } else {
        if (property.keyOutInterpolationType(indexTime) == KeyframeInterpolationType.LINEAR && property.keyInInterpolationType(indexTime + 1) == KeyframeInterpolationType.LINEAR) {
          interpolationType = 'linear';
        }
        buildKeyInfluence(key, lastKey, indexTime);
        switch (property.propertyValueType) {
          case PropertyValueType.ThreeD_SPATIAL:
          case PropertyValueType.TwoD_SPATIAL:
            lastKey.to = property.keyOutSpatialTangent(indexTime);
            key.ti = property.keyInSpatialTangent(indexTime + 1);
            break;
        }
      }
      if (interpolationType == 'hold') {
        segmentOb.t = extrasInstance.roundNumber(lastKey.time * frameRate, 3);
        segmentOb.s = getPropertyValue(property.keyValue(j), true);
        if (!(segmentOb.s instanceof Array)) {
          segmentOb.s = [segmentOb.s];
        }
        segmentOb.h = 1;
        j += 1;
        buildNextSegment();
        return;
      }
      duration = key.time - lastKey.time;
      len = key.value.length;
      bezierIn = {};
      bezierOut = {};
      averageSpeed = 0;
      var infOut, infIn;
      switch (property.propertyValueType) {
        case PropertyValueType.ThreeD_SPATIAL:
        case PropertyValueType.TwoD_SPATIAL:
          var curveLength = getCurveLength(lastKey.value, key.value, lastKey.to, key.ti);
          averageSpeed = curveLength / duration;
          if (curveLength === 0) {
            infOut = lastKey.easeOut.influence;
            infIn = key.easeIn.influence;
          } else {
            infOut = Math.min(100 * curveLength / (lastKey.easeOut.speed * duration), lastKey.easeOut.influence);
            infIn = Math.min(100 * curveLength / (key.easeIn.speed * duration), key.easeIn.influence);
          }
          bezierIn.x = 1 - infIn / 100;
          bezierOut.x = infOut / 100;
          break;
        case PropertyValueType.SHAPE:
          averageSpeed = 1;
          infOut = Math.min(100 / lastKey.easeOut.speed, lastKey.easeOut.influence);
          infIn = Math.min(100 / key.easeIn.speed, key.easeIn.influence);
          bezierIn.x = 1 - infIn / 100;
          bezierOut.x = infOut / 100;
          break;
        case PropertyValueType.ThreeD:
        case PropertyValueType.TwoD:
        case PropertyValueType.OneD:
        case PropertyValueType.COLOR:
          bezierIn.x = [];
          bezierOut.x = [];
          key.easeIn.forEach(function (item, index) {
            bezierIn.x[index] = 1 - item.influence / 100;
            bezierOut.x[index] = lastKey.easeOut[index].influence / 100;

          });
          averageSpeed = [];
          for (i = 0; i < len; i += 1) {
            averageSpeed[i] = (key.value[i] - lastKey.value[i]) / duration;
          }
          break;
      }
      if (averageSpeed == 0) {
        bezierIn.y = bezierIn.x;
        bezierOut.y = bezierOut.x;
      } else {
        switch (property.propertyValueType) {
          case PropertyValueType.ThreeD_SPATIAL:
          case PropertyValueType.TwoD_SPATIAL:
          case PropertyValueType.SHAPE:
            if (interpolationType == 'linear') {
              bezierIn.y = bezierIn.x;
              bezierOut.y = bezierOut.x;
            } else {
              bezierIn.y = 1 - ((key.easeIn.speed) / averageSpeed) * (infIn / 100);
              bezierOut.y = ((lastKey.easeOut.speed) / averageSpeed) * bezierOut.x;
            }
            break;
          case PropertyValueType.ThreeD:
          case PropertyValueType.TwoD:
          case PropertyValueType.OneD:
          case PropertyValueType.COLOR:
            bezierIn.y = [];
            bezierOut.y = [];
            key.easeIn.forEach(function (item, index) {
              if (averageSpeed[index] == 0 || interpolationType == 'linear') {
                bezierIn.y[index] = bezierIn.x[index];
                bezierOut.y[index] = bezierOut.x[index];
              } else {
                bezierIn.y[index] = 1 - ((item.speed) / averageSpeed[index]) * (item.influence / 100);
                bezierOut.y[index] = ((lastKey.easeOut[index].speed) / averageSpeed[index]) * bezierOut.x[index];
              }
            });
            break;
        }
      }

      bezierIn.x = extrasInstance.roundNumber(bezierIn.x, 3);
      bezierIn.y = extrasInstance.roundNumber(bezierIn.y, 3);
      bezierOut.x = extrasInstance.roundNumber(bezierOut.x, 3);
      bezierOut.y = extrasInstance.roundNumber(bezierOut.y, 3);
      segmentOb.i = bezierOut;
      segmentOb.o = bezierIn;
      // segmentOb.n = (bezierIn.x.toString()+'_'+bezierIn.y.toString()+'_'+bezierOut.x.toString()+'_'+bezierOut.y.toString()).replace(/\./g, 'p');
      segmentOb.t = extrasInstance.roundNumber(lastKey.time * frameRate, 3);
      segmentOb.v = getPropertyValue(property.keyValue(j), true);
      // segmentOb.e = getPropertyValue(property.keyValue(j+1), true);
      if (!(segmentOb.v instanceof Array)) {
        //segmentOb.v = [segmentOb.v];
        //segmentOb.e = [segmentOb.e];
      }
      if (property.propertyValueType == PropertyValueType.ThreeD_SPATIAL || property.propertyValueType == PropertyValueType.TwoD_SPATIAL) {
        segmentOb.ti = lastKey.to;
        segmentOb.to = key.ti;
      }
      j += 1;
      buildNextSegment();
    }

    if (property.numKeys <= 1) {
      //beziersArray.push(getPropertyValue(property.valueAtTime(0,true), true));
      ob[propertyName] = getPropertyValue(property.valueAtTime(0, true), true);
      return;
    }

    function buildKeyInfluence(key, lastKey, indexTime) {
      switch (property.propertyValueType) {
        case PropertyValueType.ThreeD_SPATIAL:
        case PropertyValueType.TwoD_SPATIAL:
        case PropertyValueType.SHAPE:
          key.easeIn = {
            influence: property.keyInTemporalEase(indexTime + 1)[0].influence,
            speed: property.keyInTemporalEase(indexTime + 1)[0].speed
          };
          lastKey.easeOut = {
            influence: property.keyOutTemporalEase(indexTime)[0].influence,
            speed: property.keyOutTemporalEase(indexTime)[0].speed
          };
          break;
        default:
          key.easeIn = [];
          lastKey.easeOut = [];
          var inEase = property.keyInTemporalEase(indexTime + 1);
          var outEase = property.keyOutTemporalEase(indexTime);
          inEase.forEach(function (item, index) {
            key.easeIn.push({
              influence: item.influence,
              speed: item.speed
            });
            lastKey.easeOut.push({
              influence: outEase[index].influence,
              speed: outEase[index].speed
            });
          });
      }
    }

    function buildNextSegment() {
      if (j < jLen) {
        var segmentOb = {};
        beziersArray.push(segmentOb);
        buildSegment(segmentOb, j);
      }
    }
    buildNextSegment();
    beziersArray.push({
      t: property.keyTime(j) * frameRate,
      v: getPropertyValue(property.keyValue(j), true)
    });
    ob[propertyName] = beziersArray;
  }

  function roundNumber(num, decimals) {
    if (typeof num == 'number') {
      return parseFloat(num.toFixed(decimals));
    } else {
      return roundArray(num, decimals);
    }
  }

  function roundArray(arr, decimals) {
    var i, len = arr.length;
    var retArray = [];
    for (i = 0; i < len; i += 1) {
      if (typeof arr[i] == 'number') {
        retArray.push(roundNumber(arr[i], decimals));
      } else {
        retArray.push(roundArray(arr[i], decimals));
      }
    }
    return retArray;
  }

  extrasInstance.convertToBezierValues(property, comp.frameRate, layerOb.ks, 'p')

  return layerOb.ks.p;
}

function getBezierValue(v1, v2, x) {
  if (x instanceof Array) {
    x = x[0];
  }

  return (v1 + (v2 - v1) * x).toFixed(10);
}

function getTimeBezier(v1, v2, x) {
  var timeDifference = Math.abs(v2 - v1);
  return timeDifference * x;
}

function amBezierKeys(data) {

  function checkBezier(v) {
    var percent = 0;
    if (v instanceof Array) {
      v = v[0];
    }
    if(property.matchName === "ADBE Text Percent Start" || property.matchName == "ADBE Text Percent Offset"){
      var easeHign = property.parentProperty.advanced.easeHigh.value;
      if(easeHign > 0){
        percent = easeHign / 100;
        //alert(percent)
      }
    }

    return v - v * percent
  }

  var bezier = data.bezier;
  var property = data.property;
  //var type = data.type;
  var axis = data.axis;
  var comp = property.propertyGroup(property.propertyDepth).containingComp;

  if (property.isSpatial || property.matchName == 'ADBE Position_0' || property.matchName == 'ADBE Position_1') {
    var compAxis;
    if (axis === 'x') {
      compAxis = comp.width;
    };
    if (axis === 'y') {
      compAxis = comp.height;
    };
  };

  var result = [];

  try {

    for (var i = 0; i < bezier.length; i++) {
      var item = bezier[i];
      var time = item.t;
      var prevValue, currentValue, value, nextValue;

      if (property.isSpatial || property.matchName == 'ADBE Position_0' || property.matchName == 'ADBE Position_1' || property.matchName == 'ADBE Geometry2-0002') {
        if (axis === 'x' || axis === 'y') {
          if (property.value instanceof Array) {
            var axisIndex = axis === 'x' ? 0 : 1;
            value = axis === 'x' ? (item.v[axisIndex] * (-1) + compAxis / 2) * (-1) : item.v[axisIndex] * (-1) + compAxis / 2;

            if (i === 0) {
              nextValue = axis === 'x' ? (bezier[i + 1].v[axisIndex] * (-1) + compAxis / 2) * (-1) : bezier[i + 1].v[axisIndex] * (-1) + compAxis / 2;
            } else if (i === bezier.length - 1) {
              prevValue = axis === 'x' ? (bezier[i - 1].v[axisIndex] * (-1) + compAxis / 2) * (-1) : bezier[i - 1].v[axisIndex] * (-1) + compAxis / 2;
            } else {
              nextValue = axis === 'x' ? (bezier[i + 1].v[axisIndex] * (-1) + compAxis / 2) * (-1) : bezier[i + 1].v[axisIndex] * (-1) + compAxis / 2;
              prevValue = axis === 'x' ? (bezier[i - 1].v[axisIndex] * (-1) + compAxis / 2) * (-1) : bezier[i - 1].v[axisIndex] * (-1) + compAxis / 2;
            };
          } else {
            value = axis === 'x' ? (item.v * (-1) + compAxis / 2) * (-1) : item.v * (-1) + compAxis / 2;
            if (i === 0) {
              nextValue = axis === 'x' ? (bezier[i + 1].v * (-1) + compAxis / 2) * (-1) : bezier[i + 1] * (-1) + compAxis / 2;
            } else if (i === bezier.length - 1) {
              prevValue = axis === 'x' ? (bezier[i - 1].v * (-1) + compAxis / 2) * (-1) : bezier[i - 1].v * (-1) + compAxis / 2;
            } else {
              nextValue = axis === 'x' ? (bezier[i + 1].v * (-1) + compAxis / 2) * (-1) : bezier[i + 1] * (-1) + compAxis / 2;
              prevValue = axis === 'x' ? (bezier[i - 1].v * (-1) + compAxis / 2) * (-1) : bezier[i - 1].v * (-1) + compAxis / 2;
            };
          };
        };
      };

      if (property.matchName == 'ADBE Scale') {
        var axisIndex = axis === 'x' ? 0 : 1;
        value = item.v[0] / 100;
        if (i === 0) {
          nextValue = bezier[i + 1].v[axisIndex] / 100;
        } else if (i === bezier.length - 1) {
          prevValue = bezier[i - 1].v[axisIndex] / 100;
        } else {
          nextValue = bezier[i + 1].v[axisIndex] / 100;
          prevValue = bezier[i - 1].v[axisIndex] / 100;
        };
      };

      if (property.matchName == "ADBE Rotate Z" || property.matchName == "ADBE Geometry2-0007" || property.matchName == "ADBE Geometry2-0005") {
        var r = 0.01745329251994332;
        value = r * item.v * (-1);
        if (i === 0) {
          nextValue = r * bezier[i + 1].v * (-1);
        } else if (i === bezier.length - 1) {
          prevValue = r * bezier[i - 1].v * (-1);
        } else {
          nextValue = r * bezier[i + 1].v * (-1);
          prevValue = r * bezier[i - 1].v * (-1);
        };
      }

      if (property.matchName == "ADBE Vector Skew") {
        var r = 0.01745329251994332;
        value = r * item.v;
        if (i === 0) {
          nextValue = r * bezier[i + 1].v;
        } else if (i === bezier.length - 1) {
          prevValue = r * bezier[i - 1].v;
        } else {
          nextValue = r * bezier[i + 1].v;
          prevValue = r * bezier[i - 1].v;
        };
      }

      if ((property.hasMax && property.maxValue == 100) ||
        property.matchName === "ADBE Text Tracking Amount" ||
        property.matchName == "ADBE Geometry2-0003" ||
        property.matchName == "ADBE Geometry2-0004") {

        value = item.v / 100;
        if (i === 0) {
          nextValue = bezier[i + 1].v / 100;
        } else if (i === bezier.length - 1) {
          prevValue = bezier[i - 1].v / 100;
        } else {
          nextValue = bezier[i + 1].v / 100;
          prevValue = bezier[i - 1].v / 100;
        };
      }

      if (property.matchName == "ADBE Text Percent Offset") {
        value = $.mot.convertTextAnimatorOffset(item.v);
        if (i === 0) {
          nextValue = $.mot.convertTextAnimatorOffset(bezier[i + 1].v);
        } else if (i === bezier.length - 1) {
          prevValue = $.mot.convertTextAnimatorOffset(bezier[i - 1].v);
        } else {
          nextValue = $.mot.convertTextAnimatorOffset(bezier[i + 1].v);
          prevValue = $.mot.convertTextAnimatorOffset(bezier[i - 1].v);
        };
      }

      // if (property.matchName == "ADBE Geometry2-0003" || property.matchName == "ADBE Geometry2-0004") {
      //   value = item.v / 100;
      //   if (i === 0) {
      //     nextValue = bezier[i + 1].v / 100;
      //   } else if (i === bezier.length - 1) {
      //     prevValue = bezier[i - 1].v / 100;
      //   } else {
      //     nextValue = bezier[i + 1].v / 100;
      //     prevValue = bezier[i - 1].v / 100;
      //   };
      // }

      var inTime, ourTime, inValue, outValue;
      var resultString = "<time>" + $.mot.retimeAnimation(time / comp.frameRate, comp) + " " + $.mot.timebase + " 1 0</time>";
      resultString += "<value>" + value + "</value>";

      //Для первого и последнего элемента обрабатываем отсутствие LH и RH
      if (i === 0) {
        // Обрабатываем RH
        // resultString += ", RH = { " + ourTime + ", " + $.dr.getBezierValue(value, nextValue, item.i.y) + " }";
        ourTime = (bezier[i + 1].t - time) * checkBezier(item.i.x);
        outValue = nextValue * checkBezier(item.i.y);
        resultString += "<outputTangentTime>" + ourTime / comp.frameRate + "</outputTangentTime>";
        resultString += "<outputTangentValue>" + outValue + "</outputTangentValue>";
      } else if (i === bezier.length - 1) {
        // Обрабатываем LH
        // inTime = $.dr.getBezierValue(bezier[i - 1].t, time, bezier[i - 1].o.x);
        // resultString += ", LH = { " + inTime + ", " + $.dr.getBezierValue(prevValue, value, bezier[i - 1].o.y) + " }";
        inTime = (time - bezier[i - 1].t) * (1 - checkBezier(bezier[i - 1].o.x));
        inValue = prevValue * (1 - checkBezier(bezier[i - 1].o.y));
        resultString += "<inputTangentTime>" + (inTime / comp.frameRate) * (-1) + "</inputTangentTime>";
        resultString += "<inputTangentValue>" + inValue + "</inputTangentValue>";
      } else {
        // Обрабатываем и LH, и RH
        // inTime = $.dr.getBezierValue(bezier[i - 1].t, time, bezier[i - 1].o.x);
        // ourTime = $.dr.getBezierValue(time, bezier[i + 1].t, item.i.x);
        // resultString += ", LH = { " + inTime + ", " + $.dr.getBezierValue(prevValue, value, bezier[i - 1].o.y) +
        //   " }, RH = { " + ourTime + ", " + $.dr.getBezierValue(value, nextValue, item.i.y) + " }";
        inTime = (time - bezier[i - 1].t) * (1 - checkBezier(bezier[i - 1].o.x));
        inValue = prevValue * (1 - checkBezier(bezier[i - 1].o.y));
        resultString += "<inputTangentTime>" + (inTime / comp.frameRate) * (-1) + "</inputTangentTime>";
        resultString += "<inputTangentValue>" + inValue + "</inputTangentValue>";

        ourTime = (bezier[i + 1].t - time) * checkBezier(item.i.x);
        outValue = nextValue * checkBezier(item.i.y);
        resultString += "<outputTangentTime>" + ourTime / comp.frameRate + "</outputTangentTime>";
        resultString += "<outputTangentValue>" + outValue + "</outputTangentValue>";

      }

      result.push(resultString);
    }

  } catch (e) {
    alert(e);
  }

  return result.join('');
}

// var property = app.project.activeItem.selectedLayers[0].selectedProperties[1];
// var bezier = getBezier(property);

// prompt('',JSON.stringify(bezier))

//prompt('',JSON.stringify(bezier))

//alert(getBezierValue(0, 30, 0))


//alert(calculateTimeProduct(0, 1, 0))
