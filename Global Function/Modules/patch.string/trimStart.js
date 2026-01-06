if (!String.prototype.trimStart) {
  String.prototype.trimStart = function() {
    return this.replace(/^\s+/, '');
  };
}