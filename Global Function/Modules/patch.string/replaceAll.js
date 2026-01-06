if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    // Экранируем спецсимволы в RegExp
    var escaped = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return target.replace(new RegExp(escaped, 'g'), replacement);
  };
}