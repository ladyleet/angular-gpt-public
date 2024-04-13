import express, { response } from 'express';
import { CohereClient } from 'cohere-ai';
import { AstraDB } from '@datastax/astra-db-ts';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletion } from 'openai/resources';
import path from 'node:path';
import dotenv from 'dotenv';

// Load configuration from a .env file
dotenv.config();

const {
  ASTRA_DB_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_COLLECTION,
  COHERE_API_KEY,
  OPENAI_API_KEY,
} = process.env;

if (!OPENAI_API_KEY) {
  throw new Error(
    'OPENAI_API_KEY is not set up in your environment variables.'
  );
}

const cohere = new CohereClient({
  token: COHERE_API_KEY,
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const astraDb = new AstraDB(ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_ENDPOINT);

const host = process.env['SERVER_HOST'] ?? 'localhost';
const port = Number(process.env['SERVER_PORT'] ?? 3000);

const app = express();

// Make sure to serve the static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle CORS
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

app.get('/api/chat', async (req, res) => {
  // get the question from the "q" param
  const question = req.query.q;

  // if the question is not a string, return a 400 status code
  if (typeof question !== 'string') {
    return res.status(400).send({ message: 'Invalid question' });
  }

  let docContext = '';

  const embedded = await cohere.embed({
    texts: [question],
    model: 'embed-english-light-v3.0',
    inputType: 'search_query',
  });

  try {
    const collection = await astraDb.collection(ASTRA_DB_COLLECTION);
    const cursor = collection.find(null, {
      sort: {
        $vector: embedded?.embeddings[0],
      },
      limit: 10,
    });

    const documents = await cursor.toArray();

    const docsMap = documents?.map((doc) => doc.text);

    docContext = JSON.stringify(docsMap);
  } catch (e) {
    console.log('Error querying db...');
    docContext = '';
  }

  const template: ChatCompletionMessageParam = {
    role: 'system',
    content: `You are an AI assistant who is a Angular super fan. 
    Use the context below to augment what you know about Angular 
    the framework and the community built around it.  
    Format responses using markdown where applicable and don't return images. 
    talk like a valley girl
  
        ----------------
        START CONTEXT
        ${docContext}
        END CONTEXT
        ----------------
        `,
  };

  const questionMessage: ChatCompletionMessageParam = {
    role: 'user',
    content: question,
  };

  let aiResponse: Response;
  try {
    aiResponse = await openai.chat.completions
      .create({
        model: 'gpt-3.5-turbo',
        stream: false,
        messages: [template, questionMessage],
      })
      .asResponse();
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: `Server Open AI call failed. ${error.message}` });
    return;
  }

  // Response needs to be streamed to the client

  // Write the Web Platform Response to the Express Response
  console.log(aiResponse.headers);
  console.log(aiResponse.status);
  res.status(200);
  // res.set(aiResponse.headers);
  const data: ChatCompletion = await aiResponse.json();
  const chatResponse = { message: data.choices[0].message.content };
  //res.write(JSON.stringify(chatResponse));
  res.json(chatResponse);
  console.log(data);
  // Close the Express Response
  res.end();
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
