/**
 * A reporter that produces both a JSON and a TSV files in which all tests are reported as passed or failed, ordered by iterations, then assertions.
 * Designed to request multiple APIs implementing the same spec and determining what works and what does not (typical use case: correcting student works).
 * In the TSV file, each row corresponds to an iteration; it starts with the iteration ID, then each column value (0 or 1) corresponds to one test.
 * 
 * IMPORTANT: an iteration name (from the input CSV file) is required.
 * As newman does not provide iteration data to its reporters, the only way to get this ID is to log it on the console during newman execution,
 * and subscribe to console events in the reporter. This is why this reporter requires a specific instruction in one of the collection scripts
 * (the earlier, the better, so let's say the pre-request script of the first request), such as:
 * 
 *   console.log("iterationId", pm.iterationData.get("ID"));
 *
 * Make sure there is only one such log per iteration. The value "iterationId" can be changed in the ITERATION_ID_MESSAGE constant.
 * 
 * As processing long collections and numerous iterations can take time,
 * one can see the process progressing by looking inside the JSON report file, which is updated after each iteration.
 * The TSV file is only created at the end of the process.
 * 
 * Doc about custom reporters: https://learning.postman.com/docs/collections/using-newman-cli/newman-custom-reporters/
 * Doc about newman events: https://github.com/postmanlabs/newman#newmanrunevents
 * 
 * Commands:
 * 
 * - If cloned from the repo (if config must be changed):
 *   - in the reporter dir
 *     npm pack
 *     npm i -g ./<generated tgz file>
 *   - in the newman dir
 *     npm i ../<path to local reporter dir>/newman-reporter-iteration-tests/ --save
 * 
 * - If installed from npm (TBD):
 *   - in the newman dir
 *     npm i newman-reporter-iteration-tests --save
 * 
 * Then:
 *    npm start Test-Collection.postman_collection.json reporters=iteration-tests iterationData=myData.csv
 *   
 * @author Lionel Medini
 */

const fs = require('fs');
const path = require('path');

/***********************
 * Global configuration
 ***********************/
const PATH_TO_BASE_DIR = ".",
      REPORT_DIR = "newman",
      JSON_REPORT_FILENAME_SUFFIX = ".iterations-report.json",
      TSV_REPORT_FILENAME_SUFFIX = ".iterations-report.tsv",
      ITERATION_ID_MESSAGE = "iterationId",
      SEPARATOR = "\t";

/***********************
 * Main reporter process
 ***********************/
const assertions = [];
let fullJsonReportFilePath;

/**
 * Does the job?...
 * @param {*} emitter an event emitter that triggers the following events: https://github.com/postmanlabs/newman#newmanrunevents
 * @param {*} reporterOptions an object of the reporter specific options. The usage examples below have more details.
 * @param {*} collectionRunOptions is an object of all the collection run options: https://github.com/postmanlabs/newman#newmanrunoptions-object--callback-function--run-eventemitter
 */
function testByIterationNewmanReporter (newman, reporterOptions, collectionRunOptions) {
  newman.on("start", (err, data) => {
    // Initialize report file
    fullJsonReportFilePath = path.join(PATH_TO_BASE_DIR, REPORT_DIR, newman.summary.collection.name + JSON_REPORT_FILENAME_SUFFIX);
    fs.writeFileSync(fullJsonReportFilePath, "{\n\"collection\": " + JSON.stringify(newman.summary.collection.name) + ",\n\"iterations\": [");
  });

  newman.on("beforeIteration", (err, data) => {
    // Empty array
    assertions.splice(0, assertions.length);
  });

  newman.on("console", (err, data) => {
    // Only way to access iteration data in reporter is to console.log it...
    // https://community.postman.com/t/newman-library-in-node-js-script-access-iterationdata-value-for-each-iteration-cycle/17564/7
    // ...and write it synchroneously to file right after!
    if(data.messages[0] === ITERATION_ID_MESSAGE) {
      fs.appendFileSync(fullJsonReportFilePath, "\n{\n\t\"id\": " + JSON.stringify(data.messages[data.messages.length - 1]) + ",\n\t\"assertions\": ");
    }
  });

  newman.on("assertion", (err, data) => {
    // Process assertion data
    const assertionResult = {
      result: (!err && !data.error) ? 1 : 0,
      request: data.item.name,
      assertion: data.assertion
    };
    assertions.push(assertionResult);
  });

  newman.on("iteration", (err, data) => {
    // Bug there: extra comma after last element written in the file
    // -> Must be corrected by editing the file by hand (or fixed by next processing step).
    fs.appendFileSync(fullJsonReportFilePath, JSON.stringify(assertions) + "\n},");
  });

  newman.on('done', (err, data) => {
    fs.appendFileSync(fullJsonReportFilePath, "\n]\n}");
    fixExtraComma();
    generateTsvFile();
  });
}

/**
 * Just fixes the extra comma bug. Easier to reopen and rewrite the file after processing...
 */
function fixExtraComma() {
  let reportFileContents = fs.readFileSync(fullJsonReportFilePath, { encoding: 'utf8', flag: 'r' });

  // Reporter BUGFIX: correct the extra comma if needed.
  if(reportFileContents[reportFileContents.length - 5] == ",") {
      reportFileContents = reportFileContents.substring(0, reportFileContents.length - 5) + "\n]\n}";
      fs.writeFileSync(fullJsonReportFilePath, reportFileContents, { encoding: 'utf8'});
  }
}

/***********************
 * Generate TSV file
************************/

// header lines
let requestLine = "Requests" + SEPARATOR, 
    assertionLine = "Groups / assertions" + SEPARATOR;
let previousRequest;
let headerLinesInitiated = false;

// to verify lines are of same length
let assertionCount = 0;

/**
 * Processes the JSON report file, and generates the CSV from that.
 */
function generateTsvFile() {
    let reportFileContents = fs.readFileSync(fullJsonReportFilePath, { encoding: 'utf8', flag: 'r' });

    // Reporter BUGFIX: correct the extra comma if needed.
    if(reportFileContents[reportFileContents.length - 5] == ",") {
        reportFileContents = reportFileContents.substring(0, reportFileContents.length - 5) + "\n]\n}";
        fs.writeFileSync(fullJsonReportFilePath, reportFileContents, { encoding: 'utf8'});
    }

    const jsonReport = JSON.parse(reportFileContents);
    const tsvFileName = jsonReport.collection + TSV_REPORT_FILENAME_SUFFIX;
    const fullTsvReportFilePath = path.join(PATH_TO_BASE_DIR, REPORT_DIR, tsvFileName);

    // Init output file
    fs.writeFileSync(fullTsvReportFilePath, "Report for collection\t" + jsonReport.collection + "\n");
    jsonReport.iterations.forEach(iteration => {
        let line = iteration.id + SEPARATOR;
        iteration.assertions.forEach(assertion => {
            if(!headerLinesInitiated) {
                requestLine += (assertion.request === previousRequest ? "" : assertion.request) + SEPARATOR;
                assertionLine += assertion.assertion + SEPARATOR;
                previousRequest = assertion.request;
            }
            line += assertion.result + SEPARATOR;
        });
        if(!headerLinesInitiated) { // First iteration
            fs.appendFileSync(fullTsvReportFilePath, requestLine + "\n" + assertionLine + "\n");
            assertionCount = iteration.assertions.length;
            headerLinesInitiated = true;
        } else { // Check that all lines have the same length
            if(assertionCount != iteration.assertions.length) {
                throw new Error("Iteration " + iteration.id + " does not have the same number of assertions (" + iteration.assertions.length + ") as the previous ones (" + assertionCount + ").");
            }
        }
        fs.appendFileSync(fullTsvReportFilePath, line + "\n");
        console.log("Iteration " + iteration.id + ": " + iteration.assertions.length + " assertions.");
    });
    console.log("Wrote to file", tsvFileName);
}

module.exports = testByIterationNewmanReporter;