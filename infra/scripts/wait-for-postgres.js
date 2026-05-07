const path = require("node:path");
const dotenv = require("dotenv");
const retry = require("async-retry");
const { Client } = require("pg");

dotenv.config({
  path: path.join(process.cwd(), ".env.development"),
});

async function waitForPostgres() {
  process.stdout.write("\n🔴 Aguardando postgres aceitar conexão");

  await retry(
    async () => {
      process.stdout.write(".");
      const client = new Client({
        connectionString: process.env.DATABASE_URL?.trim(),
      });

      try {
        await client.connect();
        await client.query("SELECT 1;");
      } finally {
        await client.end().catch(() => {});
      }
    },
    {
      retries: 60,
      minTimeout: 500,
      maxTimeout: 2000,
    },
  );

  process.stdout.write("\n🟢 Postgres está pronto e aceitando conexões.\n");
}

module.exports = {
  waitForPostgres,
};

if (require.main === module) {
  waitForPostgres().catch((error) => {
    console.error("\nFalha ao aguardar o Postgres.");
    console.error(error);
    process.exit(1);
  });
}
