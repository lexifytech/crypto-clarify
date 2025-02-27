#!/usr/bin/env node
const { spawn } = require("child_process");
const readline = require("readline");

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });
    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Command "${command} ${args.join(" ")}" exited with code ${code}`
          )
        );
    });
  });
}

async function tryRun(command, args) {
  try {
    await runCommand(command, args);
  } catch (error) {
    console.error(`Command "${command} ${args.join(" ")}" failed:`, error.message);
  }
}

// Função para iniciar o PM2 de forma não bloqueante (detached)
function startPM2() {
  return new Promise((resolve) => {
    const child = spawn("pm2", ["start", "ecosystem.config.js", "--no-daemon"], {
      detached: true,
      stdio: "ignore",
      shell: true,
    });
    child.unref();
    // Aguarda 1 segundo para dar tempo de iniciar o PM2
    setTimeout(resolve, 1000);
  });
}

async function main() {
  try {
    console.log("Force updating repository...");
    await tryRun("git", ["fetch", "--all"]);
    await tryRun("git", ["reset", "--hard", "origin/main"]);

    console.log("Running yarn...");
    await tryRun("yarn", []);

    console.log("Building the project (npm run build)...");
    await tryRun("npm", ["run", "build"]);

    console.log("Starting bot with PM2 in detached mode...");
    await startPM2();

    // Limpa o terminal e exibe somente o banner
    console.clear();
    printBanner();

    // Aguarda que o usuário pressione uma tecla para encerrar
    waitForKeyPress();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

function printBanner() {
  const banner = `
   _________           .___      __       __________       __          
  /   _____/ ____   ____|__|____/  |_  ___\\______   \\____ _/  |_  ____  
  \\_____  \\ /  _ \\ /    \\  \\__  \\   __\\/  _ \\|    |  _/ __ \\_/ __ \\
  /        (  <_> )   |  \\  |/ __ \\|  | (  <_> )    |   \\  ___/\\  ___/
 /_______  /\\____/|___|  /__(____  /__|  \\____/|______  /\\___  >\\___  >
         \\/            \\/        \\/                  \\/     \\/     \\/ 

       crypto clarify is running...
  `;
  console.log(banner);
}

function waitForKeyPress() {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  console.log("\nPress any key to exit...");
  process.stdin.on("keypress", () => {
    process.exit(0);
  });
}

main();