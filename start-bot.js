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

async function main() {
  try {
    console.log("Force updating repository...");
    await runCommand("git", ["fetch", "--all"]);
    await runCommand("git", ["reset", "--hard", "origin/main"]);

    console.log("Running yarn...");
    await runCommand("yarn", []);

    console.log("Building the project (npm run build)...");
    await runCommand("npm", ["run", "build"]);

    console.log("Starting bot with PM2 in detached mode...");
    // Inicia o PM2 em modo detached para que os logs não sejam exibidos no terminal
    await runCommand("pm2", ["start", "ecosystem.config.js", "--no-daemon"], {
      detached: true,
      stdio: "ignore",
    });

    // Se tudo ocorrer bem, limpa o terminal e exibe somente o banner
    console.clear();
    printBanner();

    // Aguarda o usuário pressionar uma tecla para encerrar
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
