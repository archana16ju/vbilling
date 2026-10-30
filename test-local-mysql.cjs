
require("dotenv").config({ path: ".env.local" });

const mysql = require("mysql2/promise");

async function main() {
  if (process.env.MYSQL_DATABASE !== "local_billing_db") {
    throw new Error("Refusing to test a non-local database.");
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: "local_billing_db",
  });

  try {
    const [rows] = await connection.query(
      "SELECT DATABASE() AS db, VERSION() AS version"
    );

    console.log("Local MySQL connection successful:", rows);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Local MySQL connection failed:", error.message);
  process.exitCode = 1;
});
