if (!String.prototype.includes) {
  String.prototype.includes = function (search, start) {
    if (typeof search !== "string") {
      throw new TypeError("First argument must be a string");
    }
    if (start === undefined) {
      start = 0;
    }
    return this.indexOf(search, start) !== -1;
  };
}
