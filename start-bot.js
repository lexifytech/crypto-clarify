#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const readline = require("readline");

// Handler para que, quando o processo principal sair, seja executado "pm2 kill"
process.on("exit", () => {
  try {
    console.log("Process exiting. Killing PM2 processes...");
    execSync("pm2 kill", { stdio: "inherit", shell: true });
  } catch (e) {
    console.error("Failed to kill PM2 processes:", e.message);
  }
});

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
    console.error(
      `Command "${command} ${args.join(" ")}" failed:`,
      error.message
    );
  }
}

// Inicia o PM2 de forma detached (não bloqueante)
function startPM2() {
  return new Promise((resolve) => {
    const child = spawn(
      "pm2",
      ["start", "ecosystem.config.js", "--no-daemon"],
      {
        detached: true,
        stdio: "ignore",
        shell: true,
      }
    );
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

    // Aguarda um instante para garantir que o PM2 iniciou
    await delay(1000);

    // Limpa o terminal e exibe somente o banner
    console.clear();
    printBanner();

    console.log("\nBot is running. Press Ctrl+C to exit.");
    // Mantém o processo vivo indefinidamente
    keepAlive();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// Função que mantém o processo vivo
function keepAlive() {
  setInterval(() => {
    // Apenas para manter o processo ativo
  }, 1000);
}

main();
