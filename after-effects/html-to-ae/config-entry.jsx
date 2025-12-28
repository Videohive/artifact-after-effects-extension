
  // -----------------------
  // CONFIG
  // -----------------------
  var CFG = {
    defaultDuration: 10, // seconds
    defaultFPS: 30,
    createBackgroundFromRoot: true,
    makeShapeForGroupsWithBg: true,
    placeShapesBelowChildren: true,
    labelPrecomps: true,
  };

  function pickNumber(values, fallback) {
    for (var i = 0; i < values.length; i++) {
      var v = Number(values[i]);
      if (!isNaN(v) && v > 0) return v;
    }
    return fallback;
  }

  var SLIDE_FOLDER = null;
  var ROOT_COMP = null;

  // -----------------------
  // ENTRY
  // -----------------------
  app.beginUndoGroup("HTML JSON > AE");

  if (!app.project) app.newProject();

  var jsonFile = File.openDialog("Select layout JSON", "*.json");
  if (!jsonFile) {
    app.endUndoGroup();
    return;
  }

  jsonFile.open("r");
  var data = JSON.parse(jsonFile.read());
  jsonFile.close();


  var slides = normalizeSlides(data);

  if (!slides.length) {
    alert("Invalid JSON: missing viewport/root");
    app.endUndoGroup();
    return;
  }

  var projectFolder = null;
  if (slides.length > 1) {
    var isProjectJson = data && data.artifacts && data.artifacts instanceof Array;
    var folderName = isProjectJson ? safeName(data.name || "Project") : "Slides";
    projectFolder = app.project.items.addFolder(folderName);
  }

  var slideComps = [];

  for (var s = 0; s < slides.length; s++) {
    var slideData = slides[s];
    if (!isValidSlide(slideData)) {
      alert("Invalid slide JSON at index " + s + ": missing viewport/root");
      continue;
    }

    var slideComp = createSlideComp(slideData, projectFolder);
    // originOffset: where (0,0) of current comp sits in global slide coords
    buildNode(slideData.root, slideComp, null, { x: 0, y: 0 }, slideData, null);

    slideComps.push(slideComp);
  }

  if (slideComps.length > 1) {
    ROOT_COMP = createTimelineComp(slideComps, projectFolder);
  } else if (slideComps.length === 1) {
    ROOT_COMP = slideComps[0];
  }

  if (ROOT_COMP) {
    ROOT_COMP.openInViewer();
  }

  app.endUndoGroup();

