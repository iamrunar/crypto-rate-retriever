const _main = main;
export { _main as main };

import { RestClientV5 } from "bybit-api";

import { R_OK, W_OK, createReadStream, createWriteStream } from "fs";
import { access } from "fs/promises";
import { createInterface } from "readline";

async function main(outputFilePath, inputSymbolsFile) {
    try {
      await access(inputSymbolsFile, R_OK);
      await access(outputFilePath, W_OK);
  
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
    const inputStream = createReadStream(file);
    try {
      const rl = createInterface({
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
    for await (const ticker of getTickers(client, symbols)) {
      prices.push(ticker);
    }
    return prices;
  }
  
  async function writeMarketPrices(prices, outputFilePath) {
    const outputStream = createWriteStream(outputFilePath, { flags: "w" });
    try {
      let lineNumber = 0;
      await outputStream.write("Num\tSymbol\tDate\tPrice\n");
      for await (const coin of prices) {
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
    for (const symbol of symbols) {
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
  