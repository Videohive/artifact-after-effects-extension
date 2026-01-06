// Функция записи в лог
function writeLog(logFile, message) {
  logFile.writeln("[" + new Date().toLocaleTimeString() + "] " + message);
  $.writeln(message); // Также выводим в консоль для отладки
}