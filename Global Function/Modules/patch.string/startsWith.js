if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(search, pos) {
    pos = pos || 0;
    return this.substring(pos, pos + search.length) === search;
  };
}