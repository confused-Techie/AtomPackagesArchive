# AtomPackagesArchive

This is a CLI application that can allow you to backup all exisitng packages from
Atom.io

There are `9,241` packages or `416` pages paginated at `30` items of content.

Obviously I am using this to keep an archive myself. But HIGHLY recommend anyone else that has
some disk space to spare to also archive this data. We don't want one possible failure causing this data to be lost.

## Stats

Paginated data when complete creates a folder about 30MB large. With 832 files, comprising of the Paginated Content and Header Content of each page.

The Packages data creates a single file about 27MB large with all 9,241 packages in an array.

## Usage

Install:

```(bash)
npm install -g @confused-techie/atompackagesarchive
```

Use:

```(bash)
atompackagesarchive
```

Additionally now AtomPackagesArchive supports the choice of what to backup.

This can be specified with the backup option.

```(bash)
atompackagesarchive --backup=OPTION
```

The following options are valid:

* ALL

Backs up everything its able to.

* PAGINATED

Backs up ONLY paginated files of all available packages.

* PACKAGES

Backs up ONLY the complete package file.

* PACKAGEFILE

Keep in mind this option can only be called after creating the main package file. By using ALL.

This will go ahead and rely on the already created file, to then download the details for every single item. Due to this request failing WAY to frequently otherwise, there are large delays for downloading every item.
So this will take quite some time. At least 200ms between every single request, and if they fail that increases exponentially. This means to download over 9,000 items, with a 200ms delay, with no failures its 30 minutes.

Honestly it will still fail relatively frequently, just because the atom.io server is likely being bombarded with requests at this time. The only consistent way I could do a backup is to set this delay to 2 seconds. But that would mean over 5 hours of download. Which is just unrealistic.

* WEB

Attempts to back up all web pages, and all web page resources.

Now a usable option. But still under development.

! UNDER DEVELOPMENT !

## Details

### Paginated & Package Data

After making an initial request to determine the last page to grab it will request each page incremented by one until it has requested each page.

Once a page has been requested it will attempt to start saving data its received, and afterwards ask the new concocted packages data be written again. If this process fails it will wait 2 seconds multiplied by the number of failures until it has failed 50 times at which point the program exits. While saving data the output to the screen will show each page being saved very likely not in numerical order. It will show it in the order data is received.

### Web Crawler

The web crawler is still in its early stages but does allow some data to still be retrieved. And may take a considerable time to run.

#### Known Issues

* The webcrawler fails to save images.
* Will mistakenly enter some invalid URLS into the to_visit array.

#### URL

When saving the content to the disk, it is saved by a modified version of the URL.

The URL is modified to make it safe to save to disk successfully with some values replaced.

#### Replaced URL Values on Disk

* https:// => ''
* http:// => ''
* / => --
* # => --POUND--
* % => --PERCENT--
* & => --AMPERSAND--
* { => --LBRACKET--
* } => --RBRACKET--
* < => --LANGLE--
* \> => --RANGLE--
* \* => --ASTERISK--
* ? => --QUESTION--
* \\ => --BACKSLASH--
* $ => --DOLLAR--
* ! => --EXLAM--
* ' => --QUOTE--
* " => --DQUOTE--
* : => --COLON--
* @ => --AT--
* + => --PLUS--
* \` => --BACKTICK--
* | => --PIPE--
* = => --EQUAL--
