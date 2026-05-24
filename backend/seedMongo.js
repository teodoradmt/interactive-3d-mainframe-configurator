import './env.js';
import { closeMongoConnection, seedDefaultModules } from './mongoStore.js';

try {
  const result = await seedDefaultModules();

  console.log(
    `MongoDB seed complete. Matched: ${result.matchedCount}, modified: ${result.modifiedCount}, upserted: ${result.upsertedCount}.`,
  );
} catch (error) {
  console.error(`MongoDB seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeMongoConnection();
}
