const { parseArgv } = require("./options.js");
const axios = require("axios");
var fs = require("fs");

async function run(rawArg) {
  // There are no arguments at this time, so we will just ignore any passed.
  // but the top level if exists incase later on a check for valid options needs to succeed.
  var options = parseArgv(rawArg);

  if (options.status) {

    // First we want to get the paginated results of every single package uploaded to Atom.io
    getTotalPaginatedRequests()
      .then((res) => {
        paginatedRequests();
      });
    //paginatedRequests();

  } else {
    console.error("Didn't like your options passed.");
    process.exit(1);
  }
}

module.exports = { run };

var paginatedObj = {
  page: 1,
  totalPages: 0
};

const findPage = new RegExp('&page=(\\d*)');

function paginatedRequests() {

  for (var i = 1; i < 2; i++) {
    var pageHeaders, pageContent;

    axios.get(`https://atom.io/api/packages?page=${paginatedObj.page}`)
      .then((response) => {
        pageHeaders = response.headers;
        pageContent = response.data;

        // now to write the content
        fs.writeFileSync(`./archive/paginated/page_${paginatedObj.page}_content.json`,
          JSON.stringify(pageContent, '  ', '  '));
        fs.writeFileSync(`./archive/paginated/page_${paginatedObj.page}_headers.txt`,
          JSON.stringify(pageHeaders, '  ', '  '));

        paginatedObj.page++;
      })
      .catch((err) => {
        console.error(`Something went wrong arching data: ${err}`);
        process.exit(1);
      });
  }

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
