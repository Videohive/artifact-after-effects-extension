// ZIP Creator for After Effects ExtendScript
// Автор: Harchenko
// Создание ZIP архивов с логированием и сохранением структуры папок

// Главная функция для создания ZIP архивов
function createZipArchives(archives) {
  // === ДОБАВЛЕННЫЙ БЛОК ===
  // Если передана строка — пытаемся распарсить
  if (typeof archives === "string") {
    try {
      archives = JSON.parse(decodeURIComponent(archives));
    } catch (e) {
      throw new Error("Аргумент archives — строка, но JSON.parse не удался");
    }
  }

  // Если получилось НЕ массив — ошибка
  if (!Array.isArray(archives)) {
    throw new Error("Аргумент archives должен быть массивом или строкой JSON");
  }

  // Инициализация
  var projectName = "AE2AE";
  var authorName = "Harchenko";
  var scriptFolder = new Folder(Folder.userData.fsName + "/" + authorName);
  if (!scriptFolder.exists) scriptFolder.create();

  var filesFolder = new Folder(scriptFolder.fsName + "/" + projectName);
  if (!filesFolder.exists) filesFolder.create();

  var logFile = new File(filesFolder.fsName + "/log-zip.txt");

  // Открываем лог файл для перезаписи
  logFile.open("w");
  logFile.encoding = "UTF-8";

  writeLog(logFile, "=== Начало создания архивов ===");

  writeLog(logFile, "Время: " + new Date().toString());
  writeLog(
    logFile,
    "Платформа: " + ($.os.indexOf("Windows") !== -1 ? "Windows" : "macOS")
  );
  writeLog(logFile, "Количество архивов: " + archives.length);
  writeLog(logFile, "");

  var successList = [];
  var failList = [];
  var errorList = [];

  for (var i = 0; i < archives.length; i++) {
    var archive = archives[i];
    writeLog(
      logFile,
      "--- Архив " + (i + 1) + " из " + archives.length + " ---"
    );
    writeLog(logFile, "Имя архива: " + archive.name);
    writeLog(logFile, "Путь назначения: " + archive.finalPath);
    writeLog(logFile, "Количество элементов: " + archive.files.length);

    try {
      var result = createSingleZip(archive, logFile);
      if (result) {
        successList.push(archive.name);
        writeLog(logFile, "Successfully Created: " + archive.name);
      } else {
        failList.push(archive.name);
        writeLog(logFile, "Creation Fail: " + archive.name);
      }
    } catch (e) {
      errorList.push(archive.name);
      writeLog(
        logFile,
        "Critical Error: " + archive.name + " — " + e.toString()
      );
    }

    writeLog(logFile, "");
  }

  writeLog(logFile, "=== Завершение работы ===");
  writeLog(logFile, "Время завершения: " + new Date().toString());
  logFile.close();

  // --- Формирование итогового сообщения ---
  var resultMessage = [];

  if (successList.length > 0) {
    resultMessage.push(
      "Successfully Created:\n\n" +
        successList
          .map(function (x) {
            return x + ".zip";
          })
          .join("\n")
    );
  }

  if (failList.length > 0) {
    resultMessage.push(
      "Creation Fail:\n\n" +
        failList
          .map(function (x) {
            return x + ".zip";
          })
          .join("\n")
    );
  }

  if (errorList.length > 0) {
    resultMessage.push(
      "Critical Error:\n\n" +
        errorList
          .map(function (x) {
            return x + ".zip";
          })
          .join("\n")
    );
  }

  return resultMessage.join("\n\n"); // блоки разделяем пустой строкой
}

// Функция создания одного ZIP архива
function createSingleZip(archiveConfig, logFile) {
  var isWin = $.os.indexOf("Windows") !== -1;

  // Создаем временную папку для сбора файлов
  var tempFolder = new Folder(Folder.temp.fsName + "/zip_temp_" + Date.now());
  if (!tempFolder.exists) tempFolder.create();

  writeLog(logFile, "Временная папка: " + tempFolder.fsName);

  // Копируем файлы и папки во временную папку
  for (var i = 0; i < archiveConfig.files.length; i++) {
    var item = archiveConfig.files[i];

    if (item.type === "folder") {
      var sourceFolder = new Folder(item.path);
      if (sourceFolder.exists) {
        var folderName = sourceFolder.displayName;
        var destFolder = new Folder(tempFolder.fsName + "/" + folderName);
        copyFolder(sourceFolder, destFolder);
        writeLog(logFile, "  + Папка скопирована: " + folderName);
      } else {
        writeLog(logFile, "  ! Папка не найдена: " + item.path);
      }
    } else if (item.type === "file") {
      var sourceFile = new File(item.path);
      if (sourceFile.exists) {
        var fileName = sourceFile.displayName;
        var destFile = new File(tempFolder.fsName + "/" + fileName);
        sourceFile.copy(destFile);
        writeLog(logFile, "  + Файл скопирован: " + fileName);
      } else {
        writeLog(logFile, "  ! Файл не найден: " + item.path);
      }
    }
  }

  // === НОВЫЙ БЛОК: Проверка на вложенный архив ===
  var needsNestedZip = archiveConfig.name.indexOf("_PR_") !== -1 || 
                       archiveConfig.name.indexOf("_AE_") !== -1;

  if (needsNestedZip) {
    writeLog(logFile, "Архив требует вложенной архивации папки с цифрами");
    
    // Ищем папку, название которой начинается с цифры
    var items = tempFolder.getFiles();
    var folderToZip = null;

    for (var k = 0; k < items.length; k++) {
      if (items[k] instanceof Folder) {
        var name = items[k].displayName;
        // Проверяем, начинается ли с цифры
        if (/^\d/.test(name)) {
          folderToZip = items[k];
          writeLog(logFile, "  Найдена папка для архивации: " + name);
          break;
        }
      }
    }

    if (folderToZip !== null) {
      // Создаем ZIP из этой папки
      var nestedZipName = folderToZip.displayName + ".zip";
      var nestedZipPath = tempFolder.fsName + "/" + nestedZipName;

      writeLog(logFile, "  Создание вложенного архива: " + nestedZipName);

      var nestedSuccess = false;
      if (isWin) {
        nestedSuccess = createZipWindows(folderToZip.fsName, nestedZipPath, logFile);
      } else {
        nestedSuccess = createZipMac(folderToZip.fsName, nestedZipPath, logFile);
      }

      if (nestedSuccess) {
        writeLog(logFile, "  ✓ Вложенный архив создан");
        // Удаляем исходную папку, оставляем только ZIP
        removeFolder(folderToZip);
        writeLog(logFile, "  Исходная папка удалена, оставлен только ZIP");
      } else {
        writeLog(logFile, "  ✗ Не удалось создать вложенный архив");
      }
    } else {
      writeLog(logFile, "  ! Папка с цифрами в начале не найдена");
    }
  }
  // === КОНЕЦ НОВОГО БЛОКА ===

  // Создаем путь для выходного архива
  var outputFolder = new Folder(archiveConfig.finalPath);
  if (!outputFolder.exists) outputFolder.create();

  var outputZipPath = outputFolder.fsName + "/" + archiveConfig.name + ".zip";

  // Создаем ZIP архив в зависимости от платформы
  var success = false;

  if (isWin) {
    success = createZipWindows(tempFolder.fsName, outputZipPath, logFile);
  } else {
    success = createZipMac(tempFolder.fsName, outputZipPath, logFile);
  }

  // Удаляем временную папку
  removeFolder(tempFolder);
  writeLog(logFile, "Временная папка удалена");
  writeLog(logFile, success);
  return success;
}

// Создание ZIP на Windows
function createZipWindows(inputDir, outputZipPath, logFile) {
  writeLog(logFile, "Создание ZIP на Windows (fixed v3, UTF-8)...");

  // Создаем временную структуру
  var tempRoot = new Folder(Folder.temp.fsName + "/zip_pack_" + Date.now());
  tempRoot.create();
  var packageFolder = new Folder(tempRoot.fsName + "/package");
  packageFolder.create();

  // Копируем всё в package/
  copyFolder(new Folder(inputDir), packageFolder);

  var statusFile = new File(
    Folder.temp.fsName + "/zip_status_" + Date.now() + ".txt"
  );

  function psQuote(str) {
    return "'" + str.replace(/'/g, "''") + "'";
  }

  var packPS = psQuote(packageFolder.fsName);
  var outputPS = psQuote(outputZipPath);
  var statusPS = psQuote(statusFile.fsName);

  // PowerShell скрипт пишем в .ps1 (UTF-8), чтобы сохранить кириллицу, затем запускаем через BAT->VBS.
  var psFile = new File(
    Folder.temp.fsName + "/zip_runner_" + Date.now() + ".ps1"
  );
  psFile.open("w");
  psFile.encoding = "UTF-8";
  psFile.write(
    "\uFEFF" + // BOM, чтобы PowerShell точно прочитал UTF-8
    "$ErrorActionPreference = 'Stop'\n" +
      "$pack = " +
      packPS +
      "\n" +
      "$dest = " +
      outputPS +
      "\n" +
      "$status = " +
      statusPS +
      "\n" +
      "try {\n" +
      "  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force }\n" +
      "  $items = Get-ChildItem -LiteralPath $pack | ForEach-Object { $_.FullName }\n" +
      "  Compress-Archive -LiteralPath $items -DestinationPath $dest -Force\n" +
      "  'Success' | Out-File -FilePath $status -Encoding utf8\n" +
      "} catch {\n" +
      "  $_.Exception.Message | Out-File -FilePath $status -Encoding utf8\n" +
      "}\n"
  );
  psFile.close();

  // BAT
  var batFile = new File(
    Folder.temp.fsName + "/zip_runner_" + Date.now() + ".bat"
  );
  var statusBatEsc = statusFile.fsName.replace(/"/g, '""');
  var errBatEsc = (statusFile.fsName + ".err").replace(/"/g, '""');
  batFile.open("w");
  batFile.encoding = "UTF-8";
  batFile.write(
    "@echo off\n" +
      'if exist "' +
      statusBatEsc +
      '" del "' +
      statusBatEsc +
      "\"\n" +
      'if exist "' +
      errBatEsc +
      '" del "' +
      errBatEsc +
      "\"\n" +
      "chcp 65001 >nul\n" +
      'powershell -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' +
      psFile.fsName.replace(/\\/g, "\\\\") +
      '" 2> "' +
      errBatEsc +
      '"\n' +
      'if not exist "' +
      statusBatEsc +
      '" (\n' +
      '  if exist "' +
      errBatEsc +
      '" (\n' +
      "    type \"" +
      errBatEsc +
      "\" > \"" +
      statusBatEsc +
      "\"\n" +
      "  ) else (\n" +
      "    echo BAT rc %errorlevel% > \"" +
      statusBatEsc +
      "\"\n" +
      "  )\n" +
      ")\n"
  );
  batFile.close();

  // VBS — скрытый запуск
  var vbsFile = new File(
    Folder.temp.fsName + "/zip_launcher_" + Date.now() + ".vbs"
  );
  vbsFile.open("w");
  vbsFile.encoding = "UTF-8";
  vbsFile.write(
    'Set WshShell = CreateObject("WScript.Shell")\n' +
      'WshShell.Run chr(34) & "' +
      batFile.fsName.replace(/\\/g, "\\\\") +
      '" & chr(34), 0, True\n' +
      "Set WshShell = Nothing"
  );
  vbsFile.close();

  writeLog(logFile, "Запуск скрытого PowerShell через VBS...");

  vbsFile.execute();

  // Ждем result
  for (var i = 0; i < 30; i++) {
    $.sleep(1000);

    if (statusFile.exists) {
      statusFile.open("r");
      var status = statusFile.read();
      statusFile.close();

      if (status.indexOf("Success") !== -1) {
        var zipFile = new File(outputZipPath);
        if (zipFile.exists && zipFile.length > 0) {
          writeLog(logFile, "✓ ZIP создан успешно");
          try {
            statusFile.remove();
            psFile.remove();
            batFile.remove();
            vbsFile.remove();
          } catch (e) {}
          removeFolder(tempRoot);
          return true;
        }
      } else {
        writeLog(logFile, "✗ Ошибка: " + status);
        break;
      }
    }
  }

  writeLog(logFile, "✗ Не удалось создать ZIP");
  try {
    statusFile.remove();
    psFile.remove();
    batFile.remove();
    vbsFile.remove();
  } catch (e) {}

  removeFolder(tempRoot);
  return false;
}

// Создание ZIP на Mac
function createZipMac(inputDir, outputZipPath, logFile) {
  writeLog(logFile, "Создание ZIP на macOS...");

  // Удаляем существующий архив если есть
  var existingZip = new File(outputZipPath);
  if (existingZip.exists) {
    existingZip.remove();
  }

  // Используем ту же команду что работала
  var command = 'cd "' + inputDir + '" && zip -r -X "' + outputZipPath + '" *';

  writeLog(logFile, "Выполнение команды: " + command);
  var result = system.callSystem(command);
  writeLog(logFile, "Код возврата: " + result);

  // Проверяем результат
  var zipFile = new File(outputZipPath);
  if (zipFile.exists && zipFile.length > 0) {
    writeLog(logFile, "✓ ZIP создан успешно: " + outputZipPath);
    return true;
  } else {
    writeLog(logFile, "✗ Не удалось создать ZIP. Код возврата: " + result);
    return false;
  }
}

// Рекурсивное копирование папки
function copyFolder(sourceFolder, destFolder) {
  if (!destFolder.exists) {
    destFolder.create();
  }

  // Копируем файлы
  var files = sourceFolder.getFiles(function (f) {
    return f instanceof File;
  });
  for (var i = 0; i < files.length; i++) {
    var destFile = new File(destFolder.fsName + "/" + files[i].displayName);
    files[i].copy(destFile);
  }

  // Копируем подпапки
  var folders = sourceFolder.getFiles(function (f) {
    return f instanceof Folder;
  });
  for (var j = 0; j < folders.length; j++) {
    var newDestFolder = new Folder(
      destFolder.fsName + "/" + folders[j].displayName
    );
    copyFolder(folders[j], newDestFolder);
  }
}

// Рекурсивное удаление папки
function removeFolder(folder) {
  if (!folder.exists) return;

  // Удаляем файлы
  var files = folder.getFiles(function (f) {
    return f instanceof File;
  });
  for (var i = 0; i < files.length; i++) {
    files[i].remove();
  }

  // Удаляем подпапки
  var folders = folder.getFiles(function (f) {
    return f instanceof Folder;
  });
  for (var j = 0; j < folders.length; j++) {
    removeFolder(folders[j]);
  }

  // Удаляем саму папку
  folder.remove();
}

function getSystemFolderContents(folderPath) {
  var folder = new Folder(folderPath);
  if (!folder.exists) {
    throw new Error("Folder does not exist: " + folderPath);
  }

  var items = folder.getFiles();
  var result = [];

  for (var i = 0; i < items.length; i++) {
    var it = items[i];

    if (it instanceof Folder) {
      result.push({
        type: "folder",
        path: it.fsName,
      });
    } else if (it instanceof File) {
      result.push({
        type: "file",
        path: it.fsName,
      });
    }
  }

  return result;
}
