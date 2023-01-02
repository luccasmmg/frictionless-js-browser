const assert = require("assert");
const { open } = require("..");

const descriptor = {
  path: "https://people.sc.fsu.edu/~jburkardt/data/csv/addresses.csv",
  pathType: "remote",
  name: "addresses",
  format: "csv",
  mediatype: "text/csv",
  encoding: "utf-8",
};

async function test(blob) {
  var file = open(blob);
  assert.equal(
    JSON.stringify(file.descriptor),
    JSON.stringify(descriptor),
    "Not equal"
  );
}

//URL
test("https://people.sc.fsu.edu/~jburkardt/data/csv/addresses.csv");
