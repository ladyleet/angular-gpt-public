import { AstraDB } from '@datastax/astra-db-ts';
import { PuppeteerWebBaseLoader } from 'langchain/document_loaders/web/puppeteer';

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import 'dotenv/config';
import { CohereClient } from 'cohere-ai';

type SimilarityMetric = 'dot_product' | 'cosine' | 'euclidean';

const { ASTRA_DB_COLLECTION, COHERE_API_KEY } = process.env;

const cohere = new CohereClient({
  token: COHERE_API_KEY,
});

const angularData = ['https://angular.dev/overview'];

const { ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_ENDPOINT } = process.env;
const astraDb = new AstraDB(ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_ENDPOINT);

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (git a
  similarityMetric: SimilarityMetric = 'dot_product'
) => {
  const res = await astraDb.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 384,
      metric: similarityMetric,
    },
  });
  console.log(res);
};

const loadSampleData = async (
  similarityMetric: SimilarityMetric = 'dot_product'
) => {
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

const scrapePage = async (url: string) => {
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
