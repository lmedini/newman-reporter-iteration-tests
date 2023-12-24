# newman-reporter-iteration-tests

A simple reporter for [newman](https://github.com/postmanlabs/newman) designed to request multiple APIs implementing the same spec and determining what works and what does not for each API (typical use case: correcting student works).

This reporter produces both a JSON and a TSV files in which all tests are only reported as passed or failed (0 or 1), ordered by iterations, then assertions. In the TSV file, each row corresponds to an iteration; it starts with the iteration ID, then each column value corresponds to one test.

**Note: an iteration ID (from the input CSV file) is therefore required.**

As newman does not provide iteration data to its reporters, the only way to retrieve this ID is to log it on the console during newman execution, and subscribe to console events in the reporter. This is what is done in this reporter, and why it requires a specific instruction in one of the collection scripts (the earlier, the better, so let's say the pre-request script of the first request), such as:

`console.log("iterationId", pm.iterationData.get("ID"));`
 
Make sure there is only one such log per iteration. The value "iterationId" can be changed in the `ITERATION_ID_MESSAGE` constant.

## Configuration

As transmitting configuration values to a reporter can be tricky when newman is not executed in CLI, configuration values are at the beginning of the `index.js` file. Defaults should work out-of-the-box however and produce report files named after the collection in the current folder's `newman` subdirectory.

## Usage

- If cloned from the repo (if config must be changed):
  - in the reporter dir
    ```
    npm pack
    npm i -g ./<generated tgz file>
    ```
  - in the newman dir
    ```
    npm i ../<path to local reporter dir>/newman-reporter-iteration-tests/ --save
    ```

- If installed from npm (TBD):
  - in the newman dir
    ```
    npm i newman-reporter-iteration-tests --save
    ```

Then:

```
newman Test-Collection.postman_collection.json  -r iteration-tests -d myData.csv
```

As processing numerous iterations over long collections can take time, **one can see the process progressing by looking inside the JSON report file**, which is updated after each iteration. The TSV file is only created at the end of the process.

## References

- Doc about custom reporters: https://learning.postman.com/docs/collections/using-newman-cli/newman-custom-reporters/
- Doc about newman events: https://github.com/postmanlabs/newman#newmanrunevents

## License

Note: "Postman" and "newman" are trademarks of Postman, Inc.

The components of this work that are not subject to any other license are licensed under a [Cecill-C](https://cecill.info/licences/Licence_CeCILL-C_V1-en.txt) license.
