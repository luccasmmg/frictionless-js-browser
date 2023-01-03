const assert = require("assert");
const { open, csvParser } = require("../dist/frictionless-js-browser.cjs");

const descriptor = {
  path: "https://people.sc.fsu.edu/~jburkardt/data/csv/addresses.csv",
  pathType: "remote",
  name: "addresses",
  format: "csv",
  mediatype: "text/csv",
  encoding: "utf-8",
};

const expectedRows = [
  ["John", "Doe", "120 jefferson st.", "Riverside", "NJ", "08075"],
  ["Jack", "McGinnis", "220 hobo Av.", "Phila", "PA", "09119"],
  ['John "Da Man"', "Repici", "120 Jefferson St.", "Riverside", "NJ", "08075"],
  [
    "Stephen",
    "Tyler",
    '7452 Terrace "At the Plaza" road',
    "SomeTown",
    "SD",
    "91234",
  ],
  ["", "Blankman", "", "SomeTown", "SD", "00298"],
  [
    'Joan "the bone", Anne',
    "Jet",
    "9th, at Terrace plc",
    "Desert City",
    "CO",
    "00123",
  ],
];

async function test(blob) {
  var file = open(blob);
  assert.equal(
    JSON.stringify(file.descriptor),
    JSON.stringify(descriptor),
    "Not equal"
  );
  console.log(file);
  const parsedFile = await csvParser(file);
  console.log(parsedFile);
  assert.equal(JSON.stringify(rows), JSON.stringify(expectedRows), "Not equal");
}

//URL
test("https://people.sc.fsu.edu/~jburkardt/data/csv/addresses.csv");
