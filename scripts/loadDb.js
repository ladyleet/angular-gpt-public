const { AstraDB } = require('@datastax/astra-db-ts');
const {
  PuppeteerWebBaseLoader,
} = require('langchain/document_loaders/web/puppeteer');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
require('dotenv/config');
const { CohereClient } = require('cohere-ai');

const { ASTRA_DB_COLLECTION, COHERE_API_KEY } = process.env;

const cohere = new CohereClient({
  token: COHERE_API_KEY,
});

const angularData = [
  'https://blog.angular.io/angular-v17-2-is-now-available-596cbe96242d',
  'https://blog.angular.io/introducing-angular-v17-4d7033312e4b',
  'https://angular.io/guide/update-to-version-17',
  'https://www.metizsoft.com/blog/angular-17-latest-features',
  'https://blog.ninja-squad.com/2023/10/11/angular-control-flow-syntax/',
  'https://blog.ninja-squad.com/2023/11/09/what-is-new-angular-17.0/',
  'https://blog.ninja-squad.com/2023/11/02/angular-defer/',
  'https://blog.ninja-squad.com/2023/04/26/angular-signals/',
  'https://angularexperts.io/blog/angular-control-flow',
  'https://blog.angular-university.io/angular-signals/',
  'https://www.freecodecamp.org/news/angular-signals/',
  'https://medium.com/@eugeniyoz/angular-signals-best-practices-9ac837ab1cec',
];
const { ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_ENDPOINT } = process.env;
const astraDb = new AstraDB(ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_ENDPOINT);

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (similarityMetric = 'dot_product') => {
  const res = await astraDb.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 384,
      metric: similarityMetric,
    },
  });
  console.log(res);
};

const loadSampleData = async (similarityMetric = 'dot_product') => {
  const collection = await astraDb.collection(ASTRA_DB_COLLECTION);
  for await (const url of angularData) {
    console.log(`Processing url ${url}`);
    const content = await scrapePage(url);
    const chunks = await splitter.splitText(content);
    for await (const chunk of chunks) {
      const embedded = await cohere.embed({
        texts: [chunk],
        model: 'embed-english-light-v3.0',
        inputType: 'search_document',
      });

      const embeddedText = embedded?.embeddings[0];

      const res = await collection.insertOne({
        $vector: embeddedText,
        text: chunk,
      });
      console.log(res);
    }
  }
};

const scrapePage = async (url) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: 'new',
    },
    gotoOptions: {
      waitUntil: 'domcontentloaded',
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });
  return (await loader.scrape())?.replace(/<[^>]*>?/gm, '');
};

createCollection().then(() => loadSampleData());
