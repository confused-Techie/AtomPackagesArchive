function parseArgv(rawArg) {
  // the options will allow for choices of what to backup

  var returnObj = {
    status: true,
    backup: '',
  };

  if (rawArg.length < 1) {
    console.log('No Arguments passed. Defaulting to ALL');
    returnObj.backup == "ALL";
    return returnObj;
  } else {

    for (var i = 0; i < rawArg.length; i++) {
      if (rawArg[i].startsWith("--backup")) {
        var opt = rawArg[i].split("=")[1];
        returnObj.backup = opt;
      }
    }

    return returnObj;
  }

}

module.exports = { parseArgv };
