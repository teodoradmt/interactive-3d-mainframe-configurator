import './env.js';
import { closeMongoConnection, seedDefaultGlossaryTerms, seedDefaultModules } from './mongoStore.js';

try {
  const modulesResult = await seedDefaultModules();
  const glossaryResult = await seedDefaultGlossaryTerms();

  console.log(
    `MongoDB modules seed complete. Matched: ${modulesResult.matchedCount}, modified: ${modulesResult.modifiedCount}, upserted: ${modulesResult.upsertedCount}.`,
  );
  console.log(
    `MongoDB glossary seed complete. Matched: ${glossaryResult.matchedCount}, modified: ${glossaryResult.modifiedCount}, upserted: ${glossaryResult.upsertedCount}.`,
  );
} catch (error) {
  console.error(`MongoDB seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeMongoConnection();
}
