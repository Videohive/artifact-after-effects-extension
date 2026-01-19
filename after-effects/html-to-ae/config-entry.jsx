
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

  function collectExistingItemIds() {
    var ids = {};
    if (!app.project) return ids;
    for (var i = 1; i <= app.project.numItems; i++) {
      var item = app.project.items[i];
      if (item && item.id) ids[item.id] = true;
    }
    return ids;
  }

  function isItemInFolder(item, folder) {
    if (!item || !folder) return false;
    var parent = item.parentFolder;
    while (parent) {
      if (parent === folder) return true;
      if (parent === app.project.rootFolder) break;
      parent = parent.parentFolder;
    }
    return false;
  }

  function createBaseProjectFolders(projectFolder, placeholders) {
    var editComps = app.project.items.addFolder("01. Edit Comps");
    editComps.parentFolder = projectFolder;

    var finalComp = app.project.items.addFolder("02. Final Comp");
    finalComp.parentFolder = projectFolder;

    var others = app.project.items.addFolder("03. Others");
    others.parentFolder = projectFolder;

    var deleteFolder = app.project.items.addFolder("Delete");
    deleteFolder.parentFolder = projectFolder;

    var colorFolder = app.project.items.addFolder("Color");
    colorFolder.parentFolder = editComps;

    var hasMedia = placeholders && Number(placeholders.media || placeholders.Media || 0) > 0;
    var hasText = placeholders && Number(placeholders.text || placeholders.Text || 0) > 0;

    var imageFolder = null;
    var textFolder = null;
    if (hasMedia) {
      imageFolder = app.project.items.addFolder("Image");
      imageFolder.parentFolder = editComps;
    }
    if (hasText) {
      textFolder = app.project.items.addFolder("Text");
      textFolder.parentFolder = editComps;
    }

    return {
      editComps: editComps,
      finalComp: finalComp,
      others: others,
      deleteFolder: deleteFolder,
      colorFolder: colorFolder,
      imageFolder: imageFolder,
      textFolder: textFolder,
    };
  }

  function moveLooseItemsToOthers(projectFolder, folders, existingItemIds) {
    if (!projectFolder || !folders || !folders.others) return;

    for (var i = 1; i <= app.project.numItems; i++) {
      var item = app.project.items[i];
      if (!item) continue;
      if (existingItemIds && existingItemIds[item.id]) continue;
      if (item === projectFolder) continue;
      if (item === folders.editComps) continue;
      if (item === folders.finalComp) continue;
      if (item === folders.others) continue;
      if (item === folders.deleteFolder) continue;
      if (item === folders.colorFolder) continue;
      if (item === folders.imageFolder) continue;
      if (item === folders.textFolder) continue;

      if (isItemInFolder(item, folders.editComps)) continue;
      if (isItemInFolder(item, folders.finalComp)) continue;
      if (isItemInFolder(item, folders.others)) continue;
      if (isItemInFolder(item, folders.deleteFolder)) continue;
      if (isItemInFolder(item, folders.colorFolder)) continue;
      if (isItemInFolder(item, folders.imageFolder)) continue;
      if (isItemInFolder(item, folders.textFolder)) continue;

      if (isItemInFolder(item, projectFolder)) {
        item.parentFolder = folders.others;
        continue;
      }

      item.parentFolder = folders.others;
    }
  }

  // -----------------------
  // ENTRY
  // -----------------------
  app.beginUndoGroup("HTML JSON > AE");

  if (!app.project) app.newProject();

  var jsonFile = new File("~/Desktop/Test AE.json");
  if (!jsonFile) {
    app.endUndoGroup();
    return;
  }

  jsonFile.open("r");
  var data = JSON.parse(jsonFile.read());
  jsonFile.close();

  var existingItemIds = collectExistingItemIds();

  var slides = normalizeSlides(data);

  if (!slides.length) {
    alert("Invalid JSON: missing viewport/root");
    app.endUndoGroup();
    return;
  }

  var projectFolder = null;
  var projectFolders = null;
  var isProjectJson = data && data.artifacts && data.artifacts instanceof Array;
  if (isProjectJson) {
    projectFolder = app.project.rootFolder;
    projectFolders = createBaseProjectFolders(projectFolder, data && data.placeholders);
  } else if (slides.length > 1) {
    projectFolder = app.project.items.addFolder("Slides");
  }

  var slideComps = [];
  var slideHasText = [];
  var slideTimeOffset = 0;
  var currentArtifactIndex = null;

  for (var s = 0; s < slides.length; s++) {
    var slideData = slides[s];
    if (!isValidSlide(slideData)) {
      alert("Invalid slide JSON at index " + s + ": missing viewport/root");
      continue;
    }

    var slideParentFolder = projectFolder;
    if (isProjectJson && slideData && slideData._ae2ArtifactIndex !== currentArtifactIndex) {
      currentArtifactIndex = slideData._ae2ArtifactIndex;
      slideTimeOffset = 0;
    }

    var slideComp = createSlideComp(slideData, slideParentFolder);
    // originOffset: where (0,0) of current comp sits in global slide coords
    withCompTimeOffset(slideTimeOffset, function () {
      buildNode(slideData.root, slideComp, null, { x: 0, y: 0 }, slideData, null);
    });
    var controlsLayer = slideComp.layer("Controls");
    if (controlsLayer) {
      controlsLayer.moveToBeginning();
    }

    slideComps.push(slideComp);
    var hasDirectText = typeof compHasDirectText === "function" ? compHasDirectText(slideComp) : nodeContainsText(slideData.root);
    slideHasText.push(hasDirectText);
    slideTimeOffset += slideComp.duration;
  }

  if (slideComps.length > 1) {
    var timelineParentFolder =
      projectFolders && projectFolders.finalComp ? projectFolders.finalComp : projectFolder;
    ROOT_COMP = createTimelineComp(slideComps, timelineParentFolder, slideHasText);
  } else if (slideComps.length === 1) {
    ROOT_COMP = slideComps[0];
  }

  if (isProjectJson && projectFolder && projectFolders) {
    moveLooseItemsToOthers(projectFolder, projectFolders, existingItemIds);
  }

  if (ROOT_COMP) {
    ROOT_COMP.openInViewer();
  }

  app.endUndoGroup();

