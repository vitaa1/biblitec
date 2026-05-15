const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

// Lê .env.development como única fonte de verdade da config base e deriva os
// nomes do banco de teste a partir dela. Evita um .env.test duplicado que
// poderia divergir do .env.development.
//
// Idempotente: lê sempre do arquivo (nunca de process.env), então pode ser
// chamado várias vezes sem virar "local_db_test_test".
function loadTestEnv() {
  const envPath = path.join(process.cwd(), ".env.development");
  if (!fs.existsSync(envPath)) {
    throw new Error(
      ".env.development não encontrado. Copie .env.example e renomeie para .env.development.",
    );
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath));

  // Replica o comportamento padrão de dotenv.config: só seta se não existir.
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  const baseDbName = parsed.POSTGRES_DB;
  const baseDbUrl = parsed.DATABASE_URL;

  if (!baseDbName || !baseDbUrl) {
    throw new Error(
      "POSTGRES_DB e DATABASE_URL precisam estar em .env.development.",
    );
  }

  const testDbName = `${baseDbName}_test`;
  const testDbUrl = baseDbUrl.replace(
    /\/([^/?#]+)(\?[^#]*)?$/,
    (_match, _name, qs) => `/${testDbName}${qs ?? ""}`,
  );

  if (testDbUrl === baseDbUrl) {
    throw new Error(
      `Não consegui derivar a URL de teste a partir de DATABASE_URL=${baseDbUrl}.`,
    );
  }

  process.env.POSTGRES_DB = testDbName;
  process.env.DATABASE_URL = testDbUrl;
  // Não setamos NODE_ENV aqui: o Jest seta NODE_ENV=test para seus workers
  // sozinho, e o next dev precisa rodar com NODE_ENV=development.

  return { baseDbName, baseDbUrl, testDbName, testDbUrl };
}

module.exports = { loadTestEnv };
