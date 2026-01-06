if (!Array.isArray) {
    Array.isArray = function(arg) {
      if (arg === void 0 || arg === null) {
        return false;
      };
        return (arg.__class__ === 'Array');
    };
  };