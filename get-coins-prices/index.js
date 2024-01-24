"strict";
const { RestClientV5 } = require("bybit-api");

const fs = require("fs");
const fsp = require("fs/promises");
const readline = require("readline");
var parseArgs = require("minimist");

const args = parseArgs(process.argv.slice(2));
const inputSymbolsFile = args.input;
let outputFilePath = args.output;

if (!inputSymbolsFile) {
  console.error(
    `Commandline: node index.js --input='/input/path.txt' --output='output/path.csv'`
  );
  return;
}

outputFilePath = outputFilePath || "output.csv";
main(outputFilePath, inputSymbolsFile);

async function main(outputFilePath, inputSymbolsFile) {
  try {
    await fsp.access(inputSymbolsFile, fs.R_OK);
    await fsp.access(outputFilePath, fs.W_OK);

    console.log(`Input file`, inputSymbolsFile);
    console.log(`Output file`, outputFilePath);
    const symbols = await readLines(inputSymbolsFile);
    console.log(
      "Read next symbols:",
      symbols.map((x, index) => `${index + 1}.${x || "n/a"}`).join(", ")
    );

    const client = new RestClientV5();

    const prices = await getMarketPrices(client, symbols);
    await writeMarketPrices(prices, outputFilePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("Check file access error", error.message);
      return;
    }
    console.error("Error", error);
    return;
  }
}

async function readLines(file) {
  const lines = [];
  const inputStream = fs.createReadStream(file);
  try {
    const rl = readline.createInterface({
      input: inputStream,
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      lines.push(line);
    }
  } finally {
    inputStream.close();
  }

  return lines;
}

async function getMarketPrices(client, symbols) {
  const prices = [];
  for await (ticker of getTickers(client, symbols)) {
    prices.push(ticker);
  }
  return prices;
}

async function writeMarketPrices(prices, outputFilePath) {
  const outputStream = fs.createWriteStream(outputFilePath, { flags: "w" });
  try {
    let lineNumber = 0;
    await outputStream.write("Num\tSymbol\tDate\tPrice\n");
    for await (coin of prices) {
      ++lineNumber;
      let line;
      if (coin.retCode === 0) {
        line = `${lineNumber}\t${coin.symbol}\t${coin.date.toISOString()}\t${coin.price}\n`;
      } else {
        line = `${lineNumber}\t${coin.symbol}\t${coin.date.toISOString()}\tError (${coin.retCode}): ${coin.retMsg}\n`;
      }
      await outputStream.write(line);
    }
  } finally {
    outputStream.close();
  }
}

async function* getTickers(client, symbols) {
  for (symbol of symbols) {
    let ticker;
    try {
      if (!symbol) {
        console.log("Skip empty symbol");
        yield new CoinPrice("n/a", 0, new Date(), 0);
        continue;
      }

      console.log("Request symbol", symbol, "...");

      ticker = await client.getTickers({
        category: "spot",
        symbol: symbol,
      });
      console.log(
        `${ticker.retMsg} (${ticker.retCode}) price = ${ticker.result.list[0]?.lastPrice} date = ${new Date().toISOString()}`
      );
      if (ticker.retCode != 0) {
        throw Error(ticker.retMsg);
      }
      yield new CoinPrice(
        symbol,
        ticker.result.list[0].lastPrice,
        new Date(),
        0
      );
    } catch (error) {
      const retCode = ticker?.retCode || -1;
      const retMsg = error.message;
      console.error(
        `Can't get price for symbol ${symbol}. Error code ${retCode}. Error message ${retMsg}`
      );
      yield new CoinPrice(
        symbol,
        ticker.result.list[0].lastPrice,
        new Date(),
        retCode,
        retMsg,
        error
      );
    }
  }
}

class CoinPrice {
  constructor(symbol, price, date, retCode, retMsg, error) {
    this.symbol = symbol;
    this.price = price;
    this.date = date;
    this.retCode = retCode;
    this.retMsg = retMsg;
    this.error = error;
  }
}
