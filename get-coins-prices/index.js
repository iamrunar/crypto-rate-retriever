#! /usr/bin/env node

console.log('Get coins prices. v.1\n');

import parseArgs from "minimist";
import { main } from './lib.js';

const args = parseArgs(process.argv.slice(2));
const inputSymbolsFile = args.input;
let outputFilePath = args.output;

if (!inputSymbolsFile) {
  console.error(
    `Invalid arguments
Commandline: node index.js --input='/input/path.txt' [--output='output/path.csv']`
  );
  process.exit(1)
}

outputFilePath = outputFilePath || "output.csv";
await main(outputFilePath, inputSymbolsFile);
