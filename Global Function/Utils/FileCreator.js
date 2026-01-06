var FileCreator = (function () {
  var authorName = "Harchenko";

  // --- схема валидации параметров ---
  var _schema = {
    fileName: function (val) {
      return typeof val === "string" && val.length > 0;
    },
    binaryString: function (val) {
      return typeof val === "string" || val instanceof String;
    },
    foldersName: function (val) {
      return typeof val === "string" && val.length > 0;
    },
  };

  _schema.fileName.required = true;
  _schema.binaryString.required = true;
  _schema.foldersName.required = true;

  function _validate(args) {
    for (var key in _schema) {
      if (!_schema.hasOwnProperty(key)) continue;
      var check = _schema[key];
      if (check.required || args.hasOwnProperty(key)) {
        if (!check(args[key])) {
          throw 'FileCreator: property "' + key + '" is invalid';
        }
      }
    }
  }

  // --- вспомогательная функция проверки/создания файла ---
  function _ensureFileContent(file, content) {
    var current = "";
    if (file.exists) {
      file.encoding = "BINARY";
      file.open("r");
      current = file.read();
      file.close();
    } else {
      var parentFolder = file.parent;
      if (!parentFolder.exists) {
        parentFolder.create();
      }
    }

    if (current !== content) {
      file.encoding = "BINARY";
      file.open("w");
      file.write(content);
      file.close();
      return false;
    }
    return true;
  }

  // --- публичный API ---
  var module = {};

  module.create = function (fileName, binaryString, foldersName) {
    var args = {
      fileName: fileName,
      binaryString: binaryString,
      foldersName: foldersName,
    };

    _validate(args);

    var scriptFolder = new Folder(Folder.userData.fsName + "/" + authorName);
    if (!scriptFolder.exists) scriptFolder.create();

    var targetFolder = new Folder(scriptFolder.fsName + "/" + args.foldersName);
    if (!targetFolder.exists) targetFolder.create();

    var file = new File(targetFolder.fsName + "/" + args.fileName);
    _ensureFileContent(file, args.binaryString);

    return file; // ← теперь возвращаем File
  };

  return module;
})();
