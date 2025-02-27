#!/usr/bin/env node
const { spawn } = require("child_process");
const os = require("os");

// Always use the --no-daemon flag to prevent PM2 from detaching
const args = ["start", "ecosystem.config.js", "--no-daemon"];

const child = spawn("pm2", args, { stdio: "inherit" });

child.on("exit", (code) => {
  console.log(`Process exited with code ${code}`);
});