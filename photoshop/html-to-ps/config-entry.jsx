// -----------------------
// CONFIG
// -----------------------
var CFG = {
  defaultResolution: 72,
};

// -----------------------
// ENTRY
// -----------------------
var prevRulerUnits = app.preferences.rulerUnits;
app.preferences.rulerUnits = Units.PIXELS;
try {
  var jsonFile = new File("~/Desktop/Test PS.json");
  if (!jsonFile.exists) {
    jsonFile = File.openDialog("Select JSON file", "*.json");
  }
  if (!jsonFile) {
    return;
  }

  jsonFile.open("r");
  var data = JSON.parse(jsonFile.read());
  jsonFile.close();

  var slides = normalizeSlides(data);

  if (!slides.length) {
    alert("Invalid JSON: missing viewport/root");
    return;
  }

  for (var s = 0; s < slides.length; s++) {
    var slideData = slides[s];
    if (!isValidSlide(slideData)) {
      alert("Invalid slide JSON at index " + s + ": missing viewport/root");
      continue;
    }

    var doc = createSlideDocument(slideData, s);
    buildNode(slideData.root, doc, slideData);
  }
} finally {
  app.preferences.rulerUnits = prevRulerUnits;
}
