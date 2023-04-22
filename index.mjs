import axios from "axios";
import xml2js from "xml2js";
import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
import OpenAI from "openai";

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
const { Configuration, OpenAIApi } = OpenAI;

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function shortenText(text) {
  const completion = await openai.createChatCompletion({
    model: argv.model,
    messages: [
      {
        role: "system",
        content:
          "Make text shorter, but do not remove important and financial data",
      },
      { role: "user", content: text },
    ],
  });
  console.log(
    "Shortened text from %s to %s chars",
    text.length,
    completion.data.choices[0].message.content.length
  );
  if (completion.data.choices[0].message.content.length > text.length) {
    console.log("Shortening failed, returning original text");
    return text;
  }
  return completion.data.choices[0].message.content;
}

async function getForecast(text, stockSymbol) {
  const forecastPrompt = `analyze the data provided and give a score from -5 to 5 on how positive the news is in terms of growth in the share price of company called ${stockSymbol} output the score only, if NA then 0`;
  const completion = await openai.createChatCompletion({
    model: argv.model,
    messages: [
      { role: "system", content: forecastPrompt },
      { role: "user", content: text },
    ],
    max_tokens: 25,
    temperature: 0,
  });

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

async function analyzeCompany(text, stockSymbol) {
  // variant 1
//   const prompt = `Act as an experienced trader, analyze the providen last news about "${stockSymbol}".
// 1) List facts with share price impact (short term): negative, neutral, positive.
// 2) Create the detailed analysis of facts above in terms of price change of "${stockSymbol}" in short term.
// 3) Give your estimate of how much the price of "${stockSymbol}" will change in the next 24 hours, specify the estimated growth or drop, e.g: Positive 5%.
// `;

  // variant 2
//   const prompt = `As an expert trader, analyze the latest news concerning "${stockSymbol}":

// * Identify and categorize short-term share price impacts based on recent events: negative, neutral, and positive.
// * Provide a comprehensive analysis of the identified events, focusing on their potential effects on the short-term price movement of "${stockSymbol}".
// * Offer a prediction for the price change of "${stockSymbol}" within the next 24 hours, specifying the estimated percentage of increase or decrease (e.g., Positive 5%).`
  
  // variant 3
  const prompt = `As a proficient trader, thoroughly examine the most recent updates regarding "${stockSymbol}". Begin by assessing and classifying the short-term influences on share price resulting from recent developments as negative, neutral, or positive. Next, conduct an in-depth evaluation of these influences, emphasizing their potential impact on near-term price fluctuations of "${stockSymbol}". Finally, present a well-informed forecast for the price variation of "${stockSymbol}" over the next 24 hours, specifying the anticipated percentage of growth or decline (e.g., Positive 5%).`;
  const completion = await openai.createChatCompletion({
    model: argv.model,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: text },
    ],
    max_tokens: argv.model === "gpt-3.5-turbo" ? 650 : 1000,
    temperature: 0,
  });
  return completion.data.choices[0].message.content;
}

// Helper function to get text content safely
function getTextContentSafely(element, tagName) {
  const childElement = element[tagName];
  if (!childElement) {
    return "";
  }

  // Check if the child element has attributes, and if so, get the text content from the '_' property
  return typeof childElement[0] === "object" && "_" in childElement[0]
    ? childElement[0]._
    : childElement[0];
}

// Function to parse the XML and convert it into tab-separated text
async function parseXmlToTabSeparated(url, stockSymbol) {
  // Download the XML content
  const response = await axios.get(url);
  const xmlString = response.data;

  // Parse the XML string
  const parser = new xml2js.Parser();
  const parsedXml = await parser.parseStringPromise(xmlString);

  // Extract data from the parsed XML
  const items = parsedXml.rss.channel[0].item;
  let result = "Title\tDescription\tPublication Date\tForecast\tGUID\tLink\n"; // Add headers

  // Sort items by date in ascending order (newest at the bottom)
  items.sort(
    (a, b) =>
      new Date(getTextContentSafely(a, "pubDate")) -
      new Date(getTextContentSafely(b, "pubDate"))
  );

  for (let i = 0; i < items.length; i++) {
    console.log("Processing item %s of %s", i + 1, items.length);
    const title = getTextContentSafely(items[i], "title");
    let description = getTextContentSafely(items[i], "description");
    const pubDate = getTextContentSafely(items[i], "pubDate");
    const forecast = await getForecast(title + "\n" + description, stockSymbol);
    console.log("Forecast: %s", forecast);
    if (description.length > 500) {
      description = await shortenText(description);
    }
    const guid = getTextContentSafely(items[i], "guid");
    const link = getTextContentSafely(items[i], "link");

    // Add the extracted data to the result string as a tab-separated row
    result += `${title}\t${description}\t${pubDate}\t${forecast}\t${guid}\t${link}\n`;
  }

  return result;
}

async function getNewsForCompanyInExcelFormat(stockSymbol, max = 100) {
  if (!stockSymbol) {
    console.error(
      "Error: Please provide a stock symbol as a command-line argument."
    );
    process.exit(1);
  }

  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${stockSymbol}&region=US&lang=en-US&count=${max}`;

  try {
    const tabSeparatedText = await parseXmlToTabSeparated(url, stockSymbol);
    fs.writeFileSync("out/"+stockSymbol + ".txt", tabSeparatedText);
    console.log(`The parsed data has been saved to out/${stockSymbol}.txt`);
  } catch (error) {
    console.error("Error: Failed to parse the RSS feed.", error.message);
  }
}

async function getTopCompaniesByNews() {
  const stocks = JSON.parse(fs.readFileSync("stocks.json"));
  const categories = Object.keys(stocks);

  for (const category of categories) {
    const companies = stocks[category];
    const companyNewsPromises = [];

    for (const symbol in companies) {
      const companyName = companies[symbol];
      const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=US&lang=en-US&count=3`;
      companyNewsPromises.push(
        axios
          .get(url)
          .then((response) => ({
            symbol,
            companyName,
            xmlString: response.data,
          }))
      );
    }

    const companyNewsList = await Promise.all(companyNewsPromises);

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
    let newsItems = newsLines.slice(1).filter(line => line.trim() !== '');
    if(argv.model === "gpt-3.5-turbo") {
      newsItems = newsItems.slice(-20);
    }
    const analyzedNews = await analyzeCompany(newsItems.join("\n"), argv.stock);
    console.log("Analyzed News:", analyzedNews);
  } catch (error) {
    console.error("Error: Failed to read the news data file.", error.message, error?.response?.data);
  }
}

// Main function to handle command-line arguments and output the result to a file
async function main() {
  if (argv.excel) {
    await getNewsForCompanyInExcelFormat(argv.stock, argv.count);
  } else if (argv.top) {
    await getTopCompaniesByNews();
  } else if(argv.analyze) {
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
