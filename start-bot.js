#!/usr/bin/env node
const { spawn } = require("child_process");

let cleanedUp = false;

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  console.log("Terminal is closing. Killing PM2 processes...");
  // Executa "pm2 kill" para encerrar todos os processos PM2
  const killChild = spawn("pm2", ["kill"], { stdio: "inherit", shell: true });
  killChild.on("exit", (code) => {
    process.exit(code);
  });
}

// Registra os listeners para sinais comuns de encerramento
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("SIGHUP", cleanup);

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });
    child.on("error", (err) => {
      reject(err);
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Command "${command} ${args.join(" ")}" exited with code ${code}`
          )
        );
      }
    });
  });
}



async function main() {
  try {
    console.log("Force updating repository...");
    await runCommand("git", ["fetch", "--all"]);
    await runCommand("git", ["reset", "--hard", "origin/main"]);

    console.log("Running yarn...");
    await runCommand("yarn", []);

    console.log("Building the project (npm run build)...");
    await runCommand("npm", ["run", "build"]);

    console.log("Starting bot with PM2 in no-daemon mode...");
    const pm2Args = ["start", "ecosystem.config.js", "--no-daemon"];
    await runCommand("pm2", pm2Args);

    console.log("Bot started successfully.");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
