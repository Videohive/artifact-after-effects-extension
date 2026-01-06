function getCubicBezier (property, key, type) {
    if (type == 'y' && (property.propertyValueType == PropertyValueType.ThreeD_SPATIAL || property.propertyValueType == PropertyValueType.TwoD_SPATIAL)) {
        type = 'x';
    }

    var dimension = {
        'x': 0,
        'y': 1,
        'z': 2
    };

    if (property.numKeys > 1 && key <= property.numKeys) {
        var i = key;

        if (i == property.numKeys && i != 1) {
            i = key - 1;
        }

        var t1 = property.keyTime(i);
        var t2 = property.keyTime(i + 1);
        var val1, val2;

        if (type) {
            val1 = property.keyValue(i)[dimension[type]];
            val2 = property.keyValue(i + 1)[dimension[type]];
        } else {
            val1 = property.keyValue(i);
            val2 = property.keyValue(i + 1);
        }

        var delta_t = t2 - t1;
        var delta = val2 - val1;
        var avSpeed = Math.abs(delta) / delta_t;

        var x1, y1, x2, y2;

        x1 = property.keyOutTemporalEase(i)[0].influence / 100;
        x2 = 1 - property.keyInTemporalEase(i + 1)[0].influence / 100;

        if (val1 < val2) {
            y1 = x1 * property.keyOutTemporalEase(i)[0].speed / avSpeed;
            y2 = 1 - (1 - x2) * property.keyInTemporalEase(i + 1)[0].speed / avSpeed;
        } else {
            y1 = -x1 * property.keyOutTemporalEase(i)[0].speed / avSpeed;
            y2 = 1 + (1 - x2) * property.keyInTemporalEase(i + 1)[0].speed / avSpeed;
        }

        if (property.matchName === 'ADBE Position') {
            x1 = property.keyOutTemporalEase(i)[0].influence / 100;

            if (val1 < val2) {
                y1 = x1 * property.keyOutTemporalEase(i)[0].speed / avSpeed;
            } else if (val2 < val1) {
                y1 = x1 * property.keyOutTemporalEase(i)[0].speed / avSpeed;
            } else {
                y1 = 0;
            }

            if (i == 1) {
                x2 = 1 - property.keyInTemporalEase(i + 1)[0].influence / 100;
                y2 = 1 - (1 - x2) * (property.keyInTemporalEase(i)[0].speed / avSpeed);
            } else if (i == 2) {
                x2 = 1 - property.keyInTemporalEase(i + 1)[0].influence / 100;
                y2 = 1 - (1 - x2) * (property.keyInTemporalEase(i + 1)[0].speed / avSpeed);
            }
        }


        alert("Cubic-bezier[" + x1 + ", " + y1 + ", " + x2 + ", " + y2 + "]");

        return {
            'x1': x1,
            'y1': y1,
            'x2': x2,
            'y2': y2,
            'v': val2,
            'inInfluence': property.keyInTemporalEase(i)[0].influence / 100,
            'outInfluence': property.keyOutTemporalEase(i)[0].influence / 100,
        };
    }

    return null;
}

// getCubicBezier(app.project.activeItem.selectedLayers[0].transform.position, 1, 'x')
// getCubicBezier(app.project.activeItem.selectedLayers[0].transform.scale, 1, 'x')
// getCubicBezier(app.project.activeItem.selectedLayers[0].transform.rotation, 1, '')
// getCubicBezier(app.project.activeItem.selectedLayers[0].transform.rotation, 1, '')
