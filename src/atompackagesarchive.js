const { parseArgv } = require("./options.js");
const axios = require("axios");
var fs = require("fs");
//var URL = require("url-parse");

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
        fs.mkdirSync('./archive/packages/', { recursive: true })
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
        fs.mkdirSync('./archive/paginated/', { recursive: true })
        fs.writeFileSync(`./archive/paginated/page_${page}_content.json`,
          JSON.stringify(pageContent, '  ', '  '));
        fs.writeFileSync(`./archive/paginated/page_${page}_headers.txt`,
          JSON.stringify(pageHeaders, '  ', '  '));

        console.log(`Wrote Headers & Content for Page: ${page}`);

        if (backup == "PACKAGES" || backup == "ALL") {
          fs.mkdirSync('./archive/packages/', { recursive: true })
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

// ============== WEB BACKUP ======================
var webObj = {
  start_url: "https://atom.io",
  visited: {},
  to_visit: [],
  pages_found: 1,
  pages_visited: 0,
  max_fails: 10,  // originally 50, but if it fails due to a consistent error this could go on some time. means max 50 secs
};

async function webBackup() {
  webObj.to_visit.push(webObj.start_url);

  crawl();
}

async function crawl() {
  if (webObj.pages_visited >= webObj.pages_found) {
    console.log(`All Pages visited: ${webObj.pages_visited}`);
    return;
  }
  var nextPage = webObj.to_visit.pop();
  if (nextPage in webObj.visited) {
    // we've already visited the page, so crawl again.
    crawl();
  } else {
    // link isn't in visited.
    requestPage(nextPage, crawl, 1, webObj.max_fails);
  }
}

function requestPage(url, callback, fails, max_fails) {
  // add the page to previously visisted.
  webObj.visited[url] = true;
  webObj.pages_visited++;

  axios.get(url)
    .then((response) => {
      if (response.headers["Content-Type"] == "image/png" || response.headers["Content-Type"] == "image/jpeg") {
        // if this is image ddata skip trying to find any links
        savePage(url, response.data);
        callback();
      } else if (response.headers["Content-Type"] == "text/css") {
        // we will assume no links are found within css
        savePage(url, response.data);
        callback();
      } else {
        // else we will assume we can find links.
        findLinks(response.data);
        savePage(url, response.data);
        callback();
      }
    })
    .catch((error) => {
      if (error.response) {
        // got a proper response, but outside of 2XX range.
        //findLinks(error.response);  // seems if this data is returned as json then our match fails.

        // check headers to see what to pass to savePage since it can't take an object.
        try {
          // in the event that a response comes as undefined for whatever reason, this should prevent a crash.
          if (error.headers["Content-Type"] == "application/json") {
            savePage(error.status, JSON.stringify(error.response));
          } else {
            // lets assume it'll be html
            try {
              savePage(error.status, error.response);
            } catch(err) {
              console.error(`Failed to save page after error with response. Status: ${error.status}, URL: ${url}`);
            }
          }

        } catch(err) {
          console.error(`Failed to find details of page after an error response: URL: ${url}, Status: ${error.status}`);
        }

        //savePage(error.status, error.response);

        if (error.status == 500) {
          // basically if the server just failed, lets try again.
          requestPage(url, callback, fails+1, max_fails);
        } else {
          // error may have been no auth, or 404, so we will move on.
          //callback();
        }
        callback();
      } else if (error.request) {
        // server never responded
        console.log(`No Response: ${error}`);
        console.log(`Error URL: ${url}`);
        console.log(`Waiting ${5000 * fails} ms to try again.`);
        // We will wait some time before trying again.
        setTimeout(() => {
          requestPage(url, callback, fails+1, max_fails);
        }, 5000 * fails);
      } else {
        // general error creating the request.
        console.log(`General Error: ${error}`);
        console.log(`Error URL: ${url}`);
        console.log(`Waiting ${5000 * fails} ms to try again.`);
        // we will wait some time before trying agian.
        setTimeout(() => {
          requestPage(url, callback, fails+1, max_fails);
        }, 5000 * fails);
      }
    });
}

function savePage(title, data) {
  var safe_title = slugToTitle(title);
  console.log(`Saving: ${safe_title} to ./archive/web/${safe_title}`);
  fs.mkdirSync("./archive/web/", { recursive: true});
  fs.writeFileSync(`./archive/web/${safe_title}`, data);
}

function slugToTitle(url) {
  if (typeof url === "string") {
    url = url.replace("https://", "");
    url = url.replace("http://", "");
    // additionally the bottom replacement uses regex, to ensure that all instances found are replaced. Not just the first.
    url = url.replace(/\//g, "--"); // this will be the new file seperator. Hopefully uncommon to find.

    // NOW to make it OS safe filenames.
    url = url.replace(/#/, "--POUND--").replace(/%/, "--PERCENT--").replace(/&/, "--AMPERSAND--").replace(/\{/, "--LBRACKET--")
              .replace(/\}/, "--RBRACKET--").replace(/\</, "--LANGLE--").replace(/>/, "--RANGLE--").replace(/\*/, "--ASTERISK")
              .replace(/\?/, "--QUESTION--").replace(/\\/, "--BACKSLASH").replace(/\$/, "--DOLLAR--").replace(/\!/, "--EXLAM--")
              .replace(/'/, "--QUOTE--").replace(/"/, "--DQUOTE--").replace(/\:/, "--COLON--").replace(/@/, "--AT--")
              .replace(/\+/, "--PLUS--").replace(/`/, "--BACKTICK--").replace(/\|/, "--PIPE--").replace(/\=/, "--EQUAL--");
  }
  // the URL could be a number if passing the status code for non-standard pages. In that case we don't want to touch it.
  return url;
}

const linkAbsReg = new RegExp('https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b[-a-zA-Z0-9()@:%_\\+.~#?&//=]*', 'g');
const linkRelReg = new RegExp('^[^\/]+\/[^\/].*$|^\/[^\/].*$');

const srcRelReg = new RegExp('(?!src=")(\\/\\S*)(?=")(?<!http[s]{0,1}:\\/\\/\\S*)', 'g');
// srcRelReg is made to only match if all of the following are true:
// * src="{MATCH}"
// * https:// OR http:// doesn't come before the string.
// * the strings starts with / then continues with any possible text until "
const hrefRelReg = new RegExp('(?!href=")(\\/\\S*)(?=")(?<!http[s]{0,1}:\\/\\/\\S*)', 'g');
// hrefRelReg works exactly as srcRelReg except checking for href="{MATCH}"


function findLinks(data) {
  var links_found_absolute = data.match(linkAbsReg);
  //var src_rel_found = srcRelReg.match(data);
  var src_rel_found = data.match(srcRelReg);
  var href_rel_found = data.match(hrefRelReg);

  // then ensure that all absolute links are from atom.io
  // using typeof object ensures an array is returned. Otherwise this may be processing image data.
  if (typeof links_found_absolute === "object") {
    links_found_absolute.forEach(function(ele) {
      if (ele.includes("atom.io")) {
        console.log(`Adding: ${ele}`);
        webObj.to_visit.push(ele);
        webObj.pages_found++;
      }
    });
  }
  if (typeof src_rel_found === "object") {
    src_rel_found.forEach(function(ele) {
      // since this is a known relative link we don't need to check if it has atom in it.
      console.log(`Adding: ${ele}`);
      webObj.to_visit.push(`${webObj.start_url}${ele}`); // creating an absolute URL from the relative.
      webObj.pages_found++;
    });
  }
  if (typeof href_rel_found === "object") {
    href_rel_found.forEach(function(ele) {
      console.log(`Adding: ${ele}`);
      webObj.to_visit.push(`${webObj.start_url}${ele}`); // creating an absolute URL from the relative.
      webObj.pages_found++;
    });
  }
}
