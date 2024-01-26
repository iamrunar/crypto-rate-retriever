#! /usr/bin/env node

console.log('Get coins prices. v.1\n');

import parseArgs from "minimist";
import path from 'node:path';

import { main } from './lib.js';
import { R_OK, W_OK,F_OK } from "fs";
import { access,stat } from "fs/promises";

const args = parseArgs(process.argv.slice(2));
const inputSymbolsFile = args.input;
let outputFilePath = args.output;

if (!inputSymbolsFile) {
  console.error(
    `Invalid arguments\nCommandline: node index.js --input='/input/path.txt' [--output='output/path.csv']`
  );
  process.exit(1)
}

if (!outputFilePath){
  const dirname = path.dirname(inputSymbolsFile);
  const ext = path.extname(inputSymbolsFile)
  const filename = path.basename(inputSymbolsFile,ext);
  outputFilePath = path.join(dirname, filename+"-prices-output.csv");
}

console.log(`Args\nInput file`, inputSymbolsFile);
console.log(`Output file`, outputFilePath);

await checkFileArgumentsOrDie(inputSymbolsFile, outputFilePath);

await main(inputSymbolsFile,outputFilePath);
console.log('\nDone.')

async function checkFileArgumentsOrDie(inputSymbolsFile, outputFilePath){
  try {
    const inputSymbolsFileInfo = await stat(inputSymbolsFile);
    if (!inputSymbolsFileInfo.isFile()){
      throw Error('The input arg should be a file: '+inputSymbolsFile)
    }
    await access(inputSymbolsFile, R_OK);
  
    //check output file
    const outputFileExists = await access(outputFilePath, F_OK)
                    .then(x=> true)
                    .catch(x=>false);
    
    if (outputFileExists){
      const outputFileInfo = await stat(outputFilePath);
      if (!outputFileInfo.isFile()){
        throw Error('The output arg should be a file: '+outputFilePath)
      }
      await access(outputFilePath, W_OK);
      console.log('check write ok',outputFilePath)
    }
    else{
      const dirname = path.dirname(outputFilePath);
      await access(dirname, W_OK);
    }
  
    
  } catch (error) {
    console.error("Check file access error", error.message);
  
    process.exit(1);
  }
}