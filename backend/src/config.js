const dotenv = require("dotenv");
const path = require("path");

// Determine the environment
const env = process.env.NODE_ENV || "development";

// Load .env only in development
if (env === "development") {
    dotenv.config({
        path: path.resolve(__dirname, "..", ".env"),
    });
}

// Validates required environment variables
if (!process.env.DATABASE_URL) {
    console.error("Missing required environment variable: DATABASE_URL");
    process.exit(1);
}

// Read and export application configuration
const config = {
    env,
    port: Number(process.env.PORT) || 8000,
    databaseUrl: process.env.DATABASE_URL,
    corsOrigins: (
        process.env.CORS_ORIGIN || 
        "http://localhost:3000,http://localhost:5173"
    )
    .split(",")
    .map((origin) => origin.trim()),
    requestLogging: env !== "test",
};

module.exports = config;