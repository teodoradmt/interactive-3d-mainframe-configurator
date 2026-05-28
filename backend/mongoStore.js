import { MongoClient, ObjectId } from 'mongodb';
import { modules as defaultModules } from './mainframeData.js';

const mongodbUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB ?? 'Mainframe-ConfiguratorDB';
const modulesCollectionName = process.env.MONGODB_MODULES_COLLECTION ?? 'modules';
const usersCollectionName = process.env.MONGODB_USERS_COLLECTION ?? 'users';
const sessionsCollectionName = process.env.MONGODB_SESSIONS_COLLECTION ?? 'sessions';
const configurationsCollectionName = process.env.MONGODB_CONFIGURATIONS_COLLECTION ?? 'configurations';

let client;
let connectionPromise;
let seedPromise;
let accountIndexesPromise;
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
  return getCollection(modulesCollectionName);
}

async function getDatabase() {
  const mongoClient = await getClient();
  return mongoClient.db(dbName);
}

async function getCollection(collectionName) {
  const database = await getDatabase();
  return database.collection(collectionName);
}

function toObjectId(value) {
  if (value instanceof ObjectId) {
    return value;
  }

  if (ObjectId.isValid(value)) {
    return new ObjectId(value);
  }

  return null;
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
    profileName: user.profileName,
    workplace: user.workplace ?? '',
    avatarColor: user.avatarColor ?? '#2ea698',
    avatarImage: user.avatarImage ?? '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function serializeConfiguration(configuration) {
  if (!configuration) {
    return null;
  }

  return {
    id: configuration._id.toString(),
    userId: configuration.userId.toString(),
    name: configuration.name,
    selection: configuration.selection,
    totals: configuration.totals,
    designId: configuration.designId ?? '',
    designName: configuration.designName ?? '',
    background: configuration.background ?? null,
    modulesSnapshot: configuration.modulesSnapshot ?? [],
    createdAt: configuration.createdAt,
    updatedAt: configuration.updatedAt,
  };
}

function normalizeConfigurationName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function findExistingConfigurationByName(collection, userId, normalizedName) {
  const configurations = await collection
    .find({ userId })
    .project({ name: 1, normalizedName: 1 })
    .toArray();

  const existingConfiguration = configurations.find((configuration) => (
    normalizeConfigurationName(configuration.normalizedName || configuration.name) === normalizedName
    || normalizeConfigurationName(configuration.name) === normalizedName
  ));

  if (!existingConfiguration) {
    return null;
  }

  return collection.findOne({
    _id: existingConfiguration._id,
    userId,
  });
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

  return {
    ...plainModule,
    options: plainModule.options.map(({ client: _client, ...option }) => option),
  };
}

async function createIndexes(collection) {
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ order: 1 });
}

async function ensureAccountIndexes() {
  accountIndexesPromise ??= (async () => {
    const database = await getDatabase();

    await Promise.all([
      database.collection(usersCollectionName).createIndex({ email: 1 }, { unique: true }),
      database.collection(sessionsCollectionName).createIndex({ tokenHash: 1 }, { unique: true }),
      database.collection(sessionsCollectionName).createIndex({ userId: 1 }),
      database.collection(sessionsCollectionName).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      database.collection(configurationsCollectionName).createIndex({ userId: 1, updatedAt: -1 }),
      database
        .collection(configurationsCollectionName)
        .createIndex({ userId: 1, normalizedName: 1 }, { unique: true }),
    ]);
  })();

  try {
    return await accountIndexesPromise;
  } catch (error) {
    accountIndexesPromise = undefined;
    connectionPromise = undefined;
    throw error;
  }
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

export async function createUser({
  avatarColor,
  avatarImage = '',
  email,
  passwordDigest,
  passwordHash,
  passwordIterations,
  passwordSalt,
  profileName,
  workplace = '',
}) {
  await ensureAccountIndexes();

  const now = new Date();
  const collection = await getCollection(usersCollectionName);
  const user = {
    avatarColor,
    avatarImage,
    createdAt: now,
    email,
    passwordDigest,
    passwordHash,
    passwordIterations,
    passwordSalt,
    profileName,
    updatedAt: now,
    workplace,
  };
  const result = await collection.insertOne(user);

  return serializeUser({ ...user, _id: result.insertedId });
}

export async function findUserByEmail(email) {
  await ensureAccountIndexes();

  const collection = await getCollection(usersCollectionName);
  return collection.findOne({ email });
}

export async function findUserById(userId) {
  await ensureAccountIndexes();

  const objectId = toObjectId(userId);

  if (!objectId) {
    return null;
  }

  const collection = await getCollection(usersCollectionName);
  return collection.findOne({ _id: objectId });
}

export async function getPublicUserById(userId) {
  return serializeUser(await findUserById(userId));
}

export async function updateUserProfile(userId, updates) {
  await ensureAccountIndexes();

  const objectId = toObjectId(userId);

  if (!objectId) {
    return null;
  }

  const collection = await getCollection(usersCollectionName);
  await collection.updateOne(
    { _id: objectId },
    {
      $set: {
        ...updates,
        updatedAt: new Date(),
      },
    },
  );

  return serializeUser(await collection.findOne({ _id: objectId }));
}

export async function createSession({ expiresAt, tokenHash, userId }) {
  await ensureAccountIndexes();

  const objectId = toObjectId(userId);

  if (!objectId) {
    return null;
  }

  const now = new Date();
  const collection = await getCollection(sessionsCollectionName);
  await collection.insertOne({
    createdAt: now,
    expiresAt,
    tokenHash,
    userId: objectId,
  });

  return {
    expiresAt,
  };
}

export async function findSessionByTokenHash(tokenHash) {
  await ensureAccountIndexes();

  const collection = await getCollection(sessionsCollectionName);
  return collection.findOne({ tokenHash });
}

export async function deleteSessionByTokenHash(tokenHash) {
  await ensureAccountIndexes();

  const collection = await getCollection(sessionsCollectionName);
  return collection.deleteOne({ tokenHash });
}

export async function saveUserConfiguration(userId, configuration) {
  await ensureAccountIndexes();

  const objectId = toObjectId(userId);

  if (!objectId) {
    return null;
  }

  const now = new Date();
  const collection = await getCollection(configurationsCollectionName);
  const normalizedName = normalizeConfigurationName(configuration.name);
  const existingConfiguration = await findExistingConfigurationByName(collection, objectId, normalizedName);
  const configurationFields = {
    background: configuration.background,
    designId: configuration.designId,
    designName: configuration.designName,
    modulesSnapshot: configuration.modulesSnapshot,
    name: configuration.name,
    normalizedName,
    selection: configuration.selection,
    totals: configuration.totals,
    updatedAt: now,
  };

  if (existingConfiguration) {
    return {
      configuration: serializeConfiguration(existingConfiguration),
      status: 'exists',
    };
  }

  try {
    const result = await collection.insertOne({
      ...configurationFields,
      createdAt: now,
      userId: objectId,
    });

    return {
      configuration: serializeConfiguration(await collection.findOne({ _id: result.insertedId })),
      status: 'created',
    };
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    const duplicateConfiguration = await findExistingConfigurationByName(collection, objectId, normalizedName);

    if (!duplicateConfiguration) {
      throw error;
    }

    return {
      configuration: serializeConfiguration(duplicateConfiguration),
      status: 'exists',
    };
  }
}

export async function getUserConfigurations(userId) {
  await ensureAccountIndexes();

  const objectId = toObjectId(userId);

  if (!objectId) {
    return [];
  }

  const collection = await getCollection(configurationsCollectionName);
  const configurations = await collection
    .find({ userId: objectId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray();

  return configurations.map(serializeConfiguration);
}

export async function getUserConfigurationById(userId, configurationId) {
  await ensureAccountIndexes();

  const userObjectId = toObjectId(userId);
  const configurationObjectId = toObjectId(configurationId);

  if (!userObjectId || !configurationObjectId) {
    return null;
  }

  const collection = await getCollection(configurationsCollectionName);
  return serializeConfiguration(await collection.findOne({
    _id: configurationObjectId,
    userId: userObjectId,
  }));
}

export async function deleteUserConfiguration(userId, configurationId) {
  await ensureAccountIndexes();

  const userObjectId = toObjectId(userId);
  const configurationObjectId = toObjectId(configurationId);

  if (!userObjectId || !configurationObjectId) {
    return { deletedCount: 0 };
  }

  const collection = await getCollection(configurationsCollectionName);
  return collection.deleteOne({
    _id: configurationObjectId,
    userId: userObjectId,
  });
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
  accountIndexesPromise = undefined;
}
