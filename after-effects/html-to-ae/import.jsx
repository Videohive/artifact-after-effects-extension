  // ============================================================
  // IMPORT
  // ============================================================

  function importFootage(fileObj) {
    try {
      var io = new ImportOptions(fileObj);
      if (io.canImportAs(ImportAsType.FOOTAGE)) {
        io.importAs = ImportAsType.FOOTAGE;
      }
      return app.project.importFile(io);
    } catch (e) {
      return null;
    }
  }

