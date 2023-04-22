# Trading with GPT

Define OPENAI_API_KEY in .env file

# Usage
```bash
# get most active stocks
node . --top

# get news
SYMBOL=AMZN
node . --excel -c 40 -s $SYMBOL

# analyze news
node . --analyze -s $SYMBOL

# if possitive, then check against most expensive model
node . --analyze -s $SYMBOL -m gpt-4
```



# Example:

## Top news

```bash
D:\src\stocks-gpt>node . --top
Top 3 most active companies in Information Technology by latest news:
1. Alphabet Inc. (GOOGL) - Sat Apr 22 2023 13:51:40 GMT+0300 (Israel Daylight Time) 
2. Amazon.com Inc. (AMZN) - Sat Apr 22 2023 12:58:39 GMT+0300 (Israel Daylight Time)
3. Apple Inc. (AAPL) - Sat Apr 22 2023 09:32:00 GMT+0300 (Israel Daylight Time)     


Top 3 most active companies in Banking and Finance by latest news:
1. Bank of America Corporation (BAC) - Sat Apr 22 2023 13:56:48 GMT+0300 (Israel Daylight Time)
2. JPMorgan Chase & Co. (JPM) - Sat Apr 22 2023 10:56:19 GMT+0300 (Israel Daylight Time)       
3. PayPal Holdings Inc. (PYPL) - Sat Apr 22 2023 07:32:19 GMT+0300 (Israel Daylight Time)      


Top 3 most active companies in Automotive by latest news:
1. Tesla Inc. (TSLA) - Sat Apr 22 2023 09:53:33 GMT+0300 (Israel Daylight Time)
2. General Motors Company (GM) - Sat Apr 22 2023 05:01:49 GMT+0300 (Israel Daylight Time)
3. Ford Motor Company (F) - Fri Apr 21 2023 23:39:59 GMT+0300 (Israel Daylight Time)


Top 3 most active companies in Healthcare by latest news:
1. Johnson & Johnson (JNJ) - Sat Apr 22 2023 03:49:35 GMT+0300 (Israel Daylight Time)
2. Amgen Inc. (AMGN) - Fri Apr 21 2023 23:01:38 GMT+0300 (Israel Daylight Time)
3. UnitedHealth Group Incorporated (UNH) - Fri Apr 21 2023 19:15:36 GMT+0300 (Israel Daylight Time)


Top 3 most active companies in Consumer Goods by latest news:
1. Costco Wholesale Corporation (COST) - Sat Apr 22 2023 13:23:35 GMT+0300 (Israel Daylight Time)
2. Amazon.com Inc. (AMZN) - Sat Apr 22 2023 12:58:39 GMT+0300 (Israel Daylight Time)
3. The Walt Disney Company (DIS) - Sat Apr 22 2023 09:48:30 GMT+0300 (Israel Daylight Time)


Top 3 most active companies in Energy by latest news:
1. Tesla Inc. (TSLA) - Sat Apr 22 2023 09:53:33 GMT+0300 (Israel Daylight Time)
2. NextEra Energy Inc. (NEE) - Sat Apr 22 2023 06:27:00 GMT+0300 (Israel Daylight Time)
3. Exxon Mobil Corporation (XOM) - Sat Apr 22 2023 00:37:42 GMT+0300 (Israel Daylight Time)

```


## News for a specific stock

```bash
D:\src\stocks-gpt>node . --analyze -s AMZN
Analyzed News: 1) List of facts:
- J.P. Morgan analyst Doug Anmuth maintains his Overweight rating and $135 price target on shares of Amazon. (Neutral)
- Amazon has successfully defeated a private antitrust lawsuit. (Positive)
- Amazon's stock hit a two-month high, rising 4% to $108 on Friday. (Positive)
- Small online organic grocery delivery service Thrive Market has been "resilient" in keeping prices low. (Neutral)
- Amazon-owned Whole Foods says it is cutting several hundred jobs as part of a process to simplify the grocery chain's operations. (Negative)
- Amazon's North American net sales for March and April will exceed analysts' estimates, indicating a strong retail business. (Positive)
- Amazon's CEO Jeff Bezos says 2023 will be a year of efficiency. (Neutral)
- Yahoo Finance Live discusses a rise in Amazon stock after a bullish call from JPMorgan ahead of the e-commerce giant's Q1 earnings report. (Positive)
- Amazon's executives are quietly weighing Whole Foods' future. (Neutral)
- Amazon unveils Alexa Game Control feature for 'Dead Island 2'. (Positive)
- Microsoft, Meta, and Amazon will report earnings next week. (Neutral)
- Amazon is one of the top 15 cloud computing companies in the world. (Neutral)
- Amazon's stock has underperformed the S&P 500 over the past three years. (Negative)
- Three exceptional growth stocks include Amazon. (Positive)
- A bull market is coming, and Amazon is one of the two FAANG stocks to buy right now. (Positive)

2) Analysis:
Overall, the news surrounding Amazon is mostly positive. The successful defeat of the antitrust lawsuit and the prediction of strong retail sales for March and April are both positive indicators for the company. The rise in stock price and the bullish call from JPMorgan also suggest that investors are optimistic about Amazon's future. However, the news of job cuts at Whole Foods and the 
underperformance of Amazon's stock compared to the S&P 500 over the past three years may cause some concern. Additionally, the uncertainty surrounding the future of Whole Foods and Jeff Bezos' statement about 2023 being a year of efficiency may lead to some caution among investors.

3) Estimate:
Positive 2-4%. Based on the positive news surrounding Amazon's successful defeat of the antitrust lawsuit and the prediction of strong retail sales for March and April
```

## Verification on gpt-4

```bash
D:\src\stocks-gpt>node . --analyze -s AMZN -m gpt-4
Analyzed News: 1. Amazon introduces Bedrock, a new cloud service for AI-powered text and image generation (positive)
2. Fox Television Stations announce collaboration with Amazon for content distribution (positive)
3. Companies conducting layoffs in 2023, including Amazon (negative)
4. J.P. Morgan analyst maintains Overweight rating and $135 price target on Amazon shares (positive)
5. Amazon defeats consumer antitrust lawsuit over fulfillment centers (neutral)
6. Amazon's stock hits a two-month high, rising 4% to $108 (positive)
7. Amazon executives are quietly weighing Whole Foods' future (negative)

Analysis:
Amazon's introduction of Bedrock, a new cloud service for AI-powered text and image generation, and its collaboration with Fox Television Stations for content distribution are both positive developments that could boost the company's share price in the short term. Additionally, J.P. Morgan's maintained Overweight rating and $135 price target on Amazon shares, as well as the company's stock hitting a two-month high, further support a positive outlook for the stock.

However, the news of Amazon conducting layoffs in 2023 and the uncertainty surrounding Whole Foods' future could negatively impact the share price in the short term. The company's recent victory in a consumer antitrust lawsuit over fulfillment centers is a neutral factor that is unlikely to significantly affect the stock price.

Considering the overall positive developments and the current momentum of Amazon's stock, I estimate that the price of "AMZN" will change positively in the next 24 hours, with an estimated range of growth between 3-5%.
```
