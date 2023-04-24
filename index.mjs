import axios from "axios";
import xml2js from "xml2js";
import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
import OpenAI from "openai";

import pLimit from "p-limit";
import readline from "readline";
import { promisify } from "util";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = promisify(rl.question).bind(rl);

const argv = yargs(hideBin(process.argv))
  .options({
    e: {
      alias: "excel",
      describe: "Prepare excel for company",
      type: "boolean",
    },
    t: {
      alias: "top",
      describe: "Get top 3 company per category by news",
      type: "boolean",
    },
    a: {
      alias: "analyze",
      describe: "Analyze company news",
      type: "boolean",
    },
    p: {
      alias: "prompt",
      describe: "Prompt number to use for analysis",
      type: "number",
      choices: [1, 2, 3],
      default: 3,
    },
    s: {
      alias: "stock",
      describe: "Stock symbol",
      type: "string",
    },
    c: {
      alias: "count",
      describe: "Maximum number of news items to retrieve",
      type: "number",
      default: 100,
    },
    d: {
      alias: "delay",
      describe: "Delay between requests in ms",
      type: "number",
      default: 500,
    },
    m: {
      alias: "model",
      describe: "Model to use for analysis",
      type: "string",
      choices: ["gpt-3.5-turbo", "gpt-4"],
      default: "gpt-3.5-turbo",
    },
  })
  .check((argv) => {
    if (argv.excel && argv.top) {
      throw new Error(
        "Error: Please choose only one operation, either excel or top."
      );
    }
    if (argv.excel && !argv.stock) {
      throw new Error(
        "Error: Please provide a stock symbol with the -s option when using the --excel operation."
      );
    }
    return true;
  }).argv;

dotenv.config();

const limit = pLimit(3);

const fetchCompanyNews = async (symbol, companyName) => {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US&count=3`;

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36",
    },
  });

  await delay(argv.delay);

  return {
    symbol,
    companyName,
    xmlString: response.data,
  };
};

const fetchAllCompanyNews = async (companies) => {
  const tasks = [];

  for (const symbol in companies) {
    const companyName = companies[symbol];

    tasks.push(limit(() => fetchCompanyNews(symbol, companyName)));
  }

  return Promise.all(tasks);
};

const { Configuration, OpenAIApi } = OpenAI;

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function shortenText(text) {
  console.log("Shortening text from %s chars", text.length);
  const completion = await openai.createChatCompletion(
    {
      model: argv.model,
      messages: [
        {
          role: "system",
          content:
            "Make text shorter, but do not remove important and financial data",
        },
        { role: "user", content: text },
      ],
    },
    {
      timeout: 60000,
    }
  );
  console.log(
    "Shortened text from %s to %s chars",
    text.length,
    completion.data.choices[0].message.content.length
  );
  await delay(argv.delay);
  if (completion.data.choices[0].message.content.length > text.length) {
    console.log("Shortening failed, returning original text");
    return text;
  }
  return completion.data.choices[0].message.content;
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getForecast(text, stockSymbol) {
  const forecastPrompt = `analyze the data provided and give a score from -5 to 5 on how positive the news is in terms of growth in the share price of company called ${stockSymbol} output the score only, if NA then 0`;
  const completion = await openai.createChatCompletion(
    {
      model: argv.model,
      messages: [
        { role: "system", content: forecastPrompt },
        { role: "user", content: text },
      ],
      max_tokens: 25,
      temperature: 0,
    },
    {
      timeout: 60000,
    }
  );
  await delay(argv.delay);

  try {
    const regex = /(-?\d+)/;
    const n = parseInt(
      completion.data.choices[0].message.content.match(regex)[0]
    );
    if (n >= -5 && n <= 5) {
      return n;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

async function extractFacts(text, stockSymbol) {
  const prompt = `Act as an experienced trader, analyze the providen last news about "${stockSymbol}".
Make a numbered list of facts about "${stockSymbol}" with their date time.
Ignore all facts that are not related to the company.

Example:
--------
1) 2022-01-10T18:31:38.000Z: The company announced a new product, which will be released in 2021
2) 2022-03-10T20:15:38.000Z: The company announced bad cash flow
3) 2023-04-24T14:47:55.000Z: Large outflows were detected at the company`;
  const completion = await openai.createChatCompletion(
    {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
      max_tokens: 450,
      temperature: 0,
    },
    {
      timeout: 60000,
    }
  );
  await delay(argv.delay);
  return completion.data.choices[0].message.content;
}

async function analyzeCompany(text, stockSymbol) {
  let facts = (await extractFacts(text, stockSymbol)).split("\n");
  console.log("================================");
  console.log("Extracted facts:", facts);

  const toDrop = (
    await question("Enter the numbers of the facts to drop (comma separated): ")
  ).split(",");
  if (toDrop.length > 1) {
    const dropIndices = toDrop.map(Number).sort((a, b) => b - a);

    for (const index of dropIndices) {
      facts.splice(index - 1, 1);
    }
  }
  // 2) 2022-03-10T20:15:38.000Z: The company announced bad cash flow
  // regex to cut out "2) 2022-03-10T20:15:38.000Z: "
  facts = facts.map((fact) => {
    const regex = /(\d+\)\s\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z:\s)/;
    return fact.replace(regex, "");
  });

  console.log("================================");
  console.log("Updated facts:", facts);
  rl.close();

  const prompts = [
    `Act as an experienced trader, analyze the providen facts about "${stockSymbol}".
1) Create the detailed analysis of facts above in terms of price change of "${stockSymbol}" in short term.
2) Give your estimate of how much the price of "${stockSymbol}" will change in the next 8 hours, specify the estimated growth or drop, e.g: Positive 5%.
`,

    `As an expert trader, analyze the latest facts concerning "${stockSymbol}":

* Provide a comprehensive analysis of the identified events, focusing on their potential effects on the short-term price movement of "${stockSymbol}".
* Offer a prediction for the price change of "${stockSymbol}" within the next 8 hours, specifying the estimated percentage of increase or decrease (e.g., Positive 5%).
`,

    `As a proficient trader, thoroughly examine the most recent facts regarding "${stockSymbol}". Conduct an in-depth evaluation of these influences, emphasizing their potential impact on near-term price fluctuations of "${stockSymbol}". Finally, present a well-informed forecast for the price variation of "${stockSymbol}" over the next 8 hours, specifying the anticipated percentage of growth or decline (e.g., Positive 5%).`,
  ];
  console.log("================================");
  const prompt = prompts[argv.prompt - 1];
  const completion = await openai.createChatCompletion(
    {
      model: argv.model,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: facts.join("\n"),
        },
      ],
      max_tokens: argv.model === "gpt-3.5-turbo" ? 600 : 1500,
      temperature: 0,
    },
    {
      timeout: 60000,
    }
  );
  await delay(argv.delay);
  return completion.data.choices[0].message.content;
}

// Helper function to get text content safely
function getTextContentSafely(element, tagName) {
  const childElement = element[tagName];
  if (!childElement) {
    return "";
  }

  let textContent =
    typeof childElement[0] === "object" && "_" in childElement[0]
      ? childElement[0]._
      : childElement[0];

  if (textContent && typeof textContent.replace !== "function") {
    return "";
  }
  textContent = textContent?.replace(/\n/g, " ")?.trim();
  return textContent || "";
}

async function getNewsItem(stockSymbol, link) {
  try {
    const str = fs.readFileSync(`out/${stockSymbol}.json`, "utf8");
    const obj = JSON.parse(str);
    return obj.find((item) => item.link === link);
  } catch (error) {
    return null;
  }
}

async function parseXmlToObjects(urls, stockSymbol) {
  let newsObjects = [];

  let i = 0;
  for (const url of urls) {
    console.log("Processing url %s", url);
    const response = await axios.get(url);
    const xmlString = response.data;

    const parser = new xml2js.Parser();
    const parsedXml = await parser.parseStringPromise(xmlString);

    const items = parsedXml.rss.channel[0].item;
    let delayTime = 100;

    for (const item of items) {
      console.log("Processing item %s", ++i);

      while (true) {
        try {
          await processItem();
          break;
        } catch (error) {
          console.log(
            "Error: %s, delay request for %sms",
            error.message,
            delayTime,
            error?.response?.data
          );
          await delay(delayTime);
          delayTime *= 2;
        }
      }

      async function processItem() {
        const link = getTextContentSafely(item, "link");
        const cachedItem = await getNewsItem(stockSymbol, link);
        if (cachedItem) {
          console.log("Item already cached, skipping");
          cachedItem.pubDate = new Date(cachedItem.pubDate);
          newsObjects.push(cachedItem);
          return;
        }

        const title = getTextContentSafely(item, "title");
        let description = getTextContentSafely(item, "description");
        const pubDate = new Date(getTextContentSafely(item, "pubDate"));

        const forecast = await getForecast(
          title + " " + description,
          stockSymbol
        );
        console.log("Forecast: %s", forecast);
        if (description.length > 500) {
          await delay(argv.delay);
          description = await shortenText(description);
        }

        newsObjects.push({
          title,
          description,
          pubDate,
          forecast,
          link,
        });
        // dump to HD
        await dumpNews(stockSymbol, newsObjects);
      }
    }
  }

  return newsObjects;
}

function convertObjectsToTabSeparated(newsObjects) {
  let result = "Title\tDescription\tPublication Date\tForecast\tLink\n";

  for (const newsObject of newsObjects) {
    result += `${newsObject.title}\t${
      newsObject.description
    }\t${newsObject.pubDate.toISOString()}\t${newsObject.forecast}\t${
      newsObject.link
    }\n`;
  }

  return result;
}

async function dumpNews(stockSymbol, news) {
  fs.writeFileSync(`out/${stockSymbol}.json`, JSON.stringify(news, null, 2));
}

async function getNewsForCompanyInExcelFormat(stockSymbol, max = 50) {
  if (!stockSymbol) {
    console.error(
      "Error: Please provide a stock symbol as a command-line argument."
    );
    process.exit(1);
  }

  const yahooUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${stockSymbol}&region=US&lang=en-US&count=${max}`;
  const nasdaqUrl = `https://www.nasdaq.com/feed/rssoutbound?symbol=${stockSymbol}`;

  try {
    const newsObjects = await parseXmlToObjects(
      [yahooUrl, nasdaqUrl],
      stockSymbol
    );
    newsObjects.sort((a, b) => a.pubDate - b.pubDate);

    const tabSeparatedText = convertObjectsToTabSeparated(newsObjects);
    fs.writeFileSync(`out/${stockSymbol}.txt`, tabSeparatedText);
    await dumpNews(stockSymbol, newsObjects);
    console.log(`The parsed data has been saved to out/${stockSymbol}.txt`);
    rl.close();
  } catch (error) {
    console.error("Error: Failed to parse the RSS feed.", error.message);
  }
}

async function getTopCompaniesByNews() {
  const stocks = JSON.parse(fs.readFileSync("stocks.json"));
  const categories = Object.keys(stocks);

  for (const category of categories) {
    const companies = stocks[category];
    const companyNewsList = await fetchAllCompanyNews(companies);

    const parser = new xml2js.Parser();
    const companyNewsWithDates = [];

    for (const { symbol, companyName, xmlString } of companyNewsList) {
      const parsedXml = await parser.parseStringPromise(xmlString);
      if (
        !parsedXml.rss ||
        !parsedXml.rss.channel ||
        !parsedXml.rss.channel[0].item
      ) {
        continue;
      }

      const items = parsedXml.rss.channel[0].item;

      if (items.length > 0) {
        const totalPubDate = items.reduce((total, item) => {
          const pubDate = new Date(getTextContentSafely(item, "pubDate"));
          return total + pubDate.getTime();
        }, 0);

        const avgPubDate = new Date(totalPubDate / items.length);

        companyNewsWithDates.push({ symbol, companyName, avgPubDate });
      }
    }

    companyNewsWithDates.sort((a, b) => b.avgPubDate - a.avgPubDate);

    console.log(`Top 3 most active companies in ${category} by latest news:`);
    companyNewsWithDates.slice(0, 3).forEach((company, index) => {
      console.log(
        `${index + 1}. ${company.companyName} (${company.symbol}) - ${
          company.avgPubDate
        }`
      );
    });
    console.log("\n");
  }
}

async function analyze() {
  if (!argv.stock) {
    console.error(
      "Error: Please provide a stock symbol with the -s option when using the --analyze operation."
    );
    process.exit(1);
  }
  try {
    const newsData = fs.readFileSync(`out/${argv.stock}.txt`, "utf-8");
    const newsLines = newsData.split("\n");
    let newsItems = newsLines.slice(1).filter((line) => line.trim() !== "");
    if (argv.model === "gpt-3.5-turbo") {
      newsItems = newsItems.slice(-28);
    }
    const analyzedNews = await analyzeCompany(newsItems.join("\n"), argv.stock);
    console.log(analyzedNews);
  } catch (error) {
    console.error(
      "Error: Failed to read the news data file.",
      error.message,
      error?.response?.data
    );
  }
}

// Main function to handle command-line arguments and output the result to a file
async function main() {
  if (argv.excel) {
    await getNewsForCompanyInExcelFormat(argv.stock, argv.count);
  } else if (argv.top) {
    await getTopCompaniesByNews();
  } else if (argv.analyze) {
    await analyze();
  } else {
    console.error(
      "Error: Please choose an operation: either --excel, --top, --analyze."
    );
    process.exit(1);
  }
}

// Run the main function
main();
