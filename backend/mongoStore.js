import { MongoClient } from 'mongodb';
import { modules as defaultModules } from './mainframeData.js';

const mongodbUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB ?? 'mainframe_configurator';
const modulesCollectionName = process.env.MONGODB_MODULES_COLLECTION ?? 'modules';

let client;
let connectionPromise;
let seedPromise;
let fallbackWarningShown = false;

function getClient() {
  if (!client) {
    client = new MongoClient(mongodbUri, {
      serverSelectionTimeoutMS: 1500,
    });
  }

  connectionPromise ??= client.connect();
  return connectionPromise;
}

async function getModulesCollection() {
  const mongoClient = await getClient();
  return mongoClient.db(dbName).collection(modulesCollectionName);
}

function cloneModuleForMongo(module, order) {
  return {
    id: module.id,
    title: module.title,
    short: module.short,
    options: module.options.map((option) => ({ ...option })),
    order,
  };
}

function stripMongoFields(module) {
  const { _id, order, ...plainModule } = module;
  return plainModule;
}

async function createIndexes(collection) {
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ order: 1 });
}

async function writeDefaultModules(collection) {
  await createIndexes(collection);

  return collection.bulkWrite(
    defaultModules.map((module, index) => ({
      replaceOne: {
        filter: { id: module.id },
        replacement: cloneModuleForMongo(module, index),
        upsert: true,
      },
    })),
  );
}

async function ensureModulesSeeded(collection) {
  seedPromise ??= (async () => {
    const count = await collection.estimatedDocumentCount();

    if (count === 0) {
      await writeDefaultModules(collection);
    }
  })();

  return seedPromise;
}

function warnAboutFallback(error) {
  if (!fallbackWarningShown) {
    console.warn(`[mongodb] ${error.message}. Using demo data from backend/mainframeData.js.`);
    fallbackWarningShown = true;
  }
}

function redactMongoUri(uri) {
  try {
    const parsed = new URL(uri);

    if (parsed.username) {
      parsed.username = '***';
    }

    if (parsed.password) {
      parsed.password = '***';
    }

    return parsed.toString();
  } catch {
    return uri.replace(/\/\/.*@/, '//***@');
  }
}

export async function getModules() {
  try {
    const collection = await getModulesCollection();
    await ensureModulesSeeded(collection);

    const storedModules = await collection
      .find({})
      .sort({ order: 1, id: 1 })
      .toArray();

    fallbackWarningShown = false;
    return storedModules.map(stripMongoFields);
  } catch (error) {
    connectionPromise = undefined;
    seedPromise = undefined;
    warnAboutFallback(error);
    return defaultModules;
  }
}

export async function seedDefaultModules() {
  const collection = await getModulesCollection();
  return writeDefaultModules(collection);
}

export async function getDatabaseStatus() {
  try {
    const mongoClient = await getClient();
    const database = mongoClient.db(dbName);

    await database.command({ ping: 1 });
    await database.collection(modulesCollectionName).estimatedDocumentCount();

    return {
      ok: true,
      type: 'mongodb',
      uri: redactMongoUri(mongodbUri),
      database: dbName,
      collection: modulesCollectionName,
    };
  } catch (error) {
    connectionPromise = undefined;

    return {
      ok: false,
      type: 'fallback',
      error: error.message,
    };
  }
}

export async function closeMongoConnection() {
  if (client) {
    await client.close();
  }

  client = undefined;
  connectionPromise = undefined;
  seedPromise = undefined;
}
