const { parseArgv } = require("./options.js");
const axios = require("axios");
var fs = require("fs");

async function run(rawArg) {
  // There are no arguments at this time, so we will just ignore any passed.
  // but the top level if exists incase later on a check for valid options needs to succeed.
  var options = parseArgv(rawArg);

  if (options.status) {
    // then check all valid backup choices
    if (options.backup == "ALL") {
      // First we want to get the paginated results of every single package uploaded to Atom.io
      getTotalPaginatedRequests()
        .then((res) => {
          paginatedRequests(options.backup);
        });
    } else if (options.backup == "PAGINATED") {
      getTotalPaginatedRequests()
        .then((res) => {
          paginatedRequests(options.backup);
        });
    } else if (options.backup == "WEB") {
      webBackup();
    } else {
      console.error(`Unrecognized Backup Method: ${options.backup}`);
      process.exit(1);
    }

  } else {
    console.error("Didn't like your options passed.");
    process.exit(1);
  }
}

module.exports = { run };

var paginatedObj = {
  page: 0,
  totalPages: 0
};

var failedAttempts = 0;
var retries = 50;

var packages = [];

const findPage = new RegExp('&page=(\\d*)');

function paginatedRequests(backup) {

  var loop = true;

  while(loop) {
    paginatedObj.page++;
    getIndividualPage(paginatedObj.page, backup, 0, retries);

    if (paginatedObj.page == paginatedObj.totalPages) {
      console.log('Reached last page. Calling Package Write');
      if (backup == "PACKAGES" || backup == "ALL") {
        fs.writeFileSync('./archive/packages/all_packages.json', JSON.stringify(packages, '  ', '  '));
        console.log('Wrote full packages.');
      }
      console.log('Exiting...');
      loop = false;
    }
  }
}

async function getIndividualPage(page, backup, failed, maxRetry) {
  axios.get(`https://atom.io/api/packages?page=${page}`)
    .then((response) => {
      if (backup == "PACKAGES" || backup == "ALL") {
        packages = packages.concat(response.data);
      }
      if (backup == "PAGINATED" || backup == "ALL") {
        var pageHeaders = response.headers;
        var pageContent = response.data;

        // now to write the content
        fs.writeFileSync(`./archive/paginated/page_${page}_content.json`,
          JSON.stringify(pageContent, '  ', '  '));
        fs.writeFileSync(`./archive/paginated/page_${page}_headers.txt`,
          JSON.stringify(pageHeaders, '  ', '  '));

        console.log(`Wrote Headers & Content for Page: ${page}`);

        if (backup == "PACKAGES" || backup == "ALL") {
          fs.writeFileSync('./archive/packages/all_packages.json', JSON.stringify(packages, '  ', '  '));
          console.log('Wrote full packages.');
        }
      }
    })
    .catch((err) => {
      failed++;
      console.error(`Something went wrong archiving data: ${err}`);
      console.error(`Current Attempt: ${page}`);

      if (failed < maxRetry) {
        console.log(`Attempting retry in ${2000 * failed} ms`);
        setTimeout(() => {
          getIndividualPage(page, backup, failed, maxRetry);
        }, 2000 * failed);
      } else {
        console.log(`There have been over ${maxRetry} retries on fail. Exiting...`);
        process.exit(1);
      }
    });
}

async function getTotalPaginatedRequests() {
  return new Promise(function (resolve, reject) {
    axios.get("https://atom.io/api/packages")
      .then((response) => {
        var rawLink = response.headers.link;
        // knowing the default format of these links we can remove everything but the last page.
        var linkArray = rawLink.split(",");

        for (var i = 0; i < linkArray.length; i++) {
          if (linkArray[i].includes("last")) {
            var lastPageNum = linkArray[i].match(findPage)[1];
            // each link has a rel to describe which page it points to. Including the alst page.
            // here we use some simple regex to extract the page number when the link includes last.
            // here we can assign that to the paginatedObj
            // and we then finally take the first idx of the array since its the first capture group.
            paginatedObj.totalPages = lastPageNum;
            console.log(`Last Page: ${paginatedObj.totalPages}`);
            resolve(true);
          }
        }
      })
      .catch((err) => {
        console.error(`Something went very wrong: ${err}`);
        process.exit(1);
      });
  });
}

async function webBackup() {
  var links = [ "https://atom.io/" ];

  while(links.length > 1) {

  }
}
