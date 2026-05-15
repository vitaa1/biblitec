const { spawn } = require("node:child_process");
const path = require("node:path");
const retry = require("async-retry");
const { Client } = require("pg");
const { loadTestEnv } = require("./lib/test-env");

const { baseDbUrl, testDbName } = loadTestEnv();

const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
const jestBin = path.join(process.cwd(), "node_modules", ".bin", "jest");
let nextProcess;

async function run() {
  try {
    if (!process.env.CI) {
      console.log("\nSubindo serviços de teste...");
      await runCommand("npm", ["run", "services:up"]);
    }

    console.log(
      `\nAguardando Postgres e preparando banco de teste (${testDbName})...`,
    );
    await ensureTestDatabase();

    console.log("\nAplicando migrations no banco de teste...");
    await runCommand("npm", ["run", "db:migrate"]);

    console.log("\nSubindo a aplicação Next...");
    nextProcess = spawn(nextBin, ["dev", "-p", "3000"], {
      stdio: "inherit",
      env: buildEnv(),
    });

    console.log("\nAguardando a API responder...");
    await waitForWebServer();

    console.log("\nExecutando testes...");
    await runCommand(jestBin, ["--runInBand"], { env: buildEnv() });
  } finally {
    await shutdown();
  }
}

async function ensureTestDatabase() {
  // Conecta no banco de manutenção "postgres" (sempre existe) para criar o
  // banco de teste se necessário. Também faz papel de wait-for-postgres,
  // já que o banco de teste ainda não existe e wait-for-postgres usaria a
  // DATABASE_URL de teste.
  const maintenanceUrl = baseDbUrl.replace(
    /\/([^/?#]+)(\?[^#]*)?$/,
    (_match, _name, qs) => `/postgres${qs ?? ""}`,
  );

  await retry(
    async () => {
      const client = new Client({ connectionString: maintenanceUrl });
      try {
        await client.connect();
        const { rows } = await client.query(
          "SELECT 1 FROM pg_database WHERE datname = $1",
          [testDbName],
        );
        if (rows.length === 0) {
          // testDbName vem de POSTGRES_DB de .env.development (que nós
          // controlamos), mas escapamos aspas duplas por segurança já que
          // CREATE DATABASE não aceita parâmetro.
          const safe = testDbName.replace(/"/g, '""');
          await client.query(`CREATE DATABASE "${safe}"`);
          console.log(`✓ Banco de teste criado: ${testDbName}`);
        }
      } finally {
        await client.end().catch(() => {});
      }
    },
    { retries: 60, minTimeout: 500, maxTimeout: 2000 },
  );
}

async function waitForWebServer() {
  await retry(
    async () => {
      const response = await fetch("http://localhost:3000/api/v1/status");

      if (!response.ok) {
        throw new Error(`Status inesperado: ${response.status}`);
      }
    },
    {
      retries: 60,
      minTimeout: 500,
      maxTimeout: 2000,
    },
  );
}

function runCommand(command, args, options = {}) {
  const { env: envOverrides, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: buildEnv(envOverrides),
      ...spawnOptions,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} terminou com código ${code ?? "null"}${
            signal ? ` (signal ${signal})` : ""
          }.`,
        ),
      );
    });
  });
}

function buildEnv(overrides = {}) {
  return {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL?.trim(),
    ...overrides,
  };
}

async function shutdown() {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill("SIGTERM");

    await new Promise((resolve) => {
      nextProcess.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
  }

  if (!process.env.CI) {
    console.log("\nEncerrando serviços...");
    try {
      await runCommand("npm", ["run", "services:down"]);
    } catch (error) {
      console.error(error.message);
    }
  }
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, async () => {
    await shutdown();
    process.exit(1);
  });
});

run().catch((error) => {
  console.error("\nFalha ao executar a suíte de testes.");
  console.error(error);
  process.exit(1);
});
