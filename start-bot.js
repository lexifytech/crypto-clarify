#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const readline = require("readline");

let pm2Process = null;

// Quando o processo principal sair, tentamos matar o processo do PM2
process.on("exit", () => {
  try {
    console.log("Process exiting. Killing PM2 processes...");
    if (pm2Process) {
      pm2Process.kill();
    } else {
      execSync("pm2 kill", { stdio: "inherit", shell: true });
    }
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
    console.error(`Command "${command} ${args.join(" ")}" failed:`, error.message);
  }
}

// Inicia o PM2 como processo filho (não detached)
function startPM2() {
  return new Promise((resolve) => {
    pm2Process = spawn("pm2", ["start", "./dist/index.js", "--no-daemon"], {
      // Não usamos detached para que o PM2 fique vinculado ao processo principal
      stdio: "ignore",
      shell: true,
    });
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

    console.log("Starting bot with PM2 in foreground mode...");
    await startPM2();
    
    console.clear();

    printBanner();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}


function printBanner() {
  const banner = `
        /$$$$$$        /$$$$$$$        /$$     /$$       /$$$$$$$        /$$$$$$$$        /$$$$$$         
       /$$__  $$      | $$__  $$      |  $$   /$$/      | $$__  $$      |__  $$__/       /$$__  $$        
      | $$  \__/      | $$  \ $$       \  $$ /$$/       | $$  \ $$         | $$         | $$  \ $$        
      | $$            | $$$$$$$/        \  $$$$/        | $$$$$$$/         | $$         | $$  | $$        
      | $$            | $$__  $$         \  $$/         | $$____/          | $$         | $$  | $$        
      | $$    $$      | $$  \ $$          | $$          | $$               | $$         | $$  | $$        
      |  $$$$$$/      | $$  | $$          | $$          | $$               | $$         |  $$$$$$/        
       \______/       |__/  |__/          |__/          |__/               |__/          \______/         
                                                                                                          
                                                                                                          
                                                                                                          
  /$$$$$$        /$$              /$$$$$$        /$$$$$$$        /$$$$$$       /$$$$$$$$       /$$     /$$
 /$$__  $$      | $$             /$$__  $$      | $$__  $$      |_  $$_/      | $$_____/      |  $$   /$$/
| $$  \__/      | $$            | $$  \ $$      | $$  \ $$        | $$        | $$             \  $$ /$$/ 
| $$            | $$            | $$$$$$$$      | $$$$$$$/        | $$        | $$$$$           \  $$$$/  
| $$            | $$            | $$__  $$      | $$__  $$        | $$        | $$__/            \  $$/   
| $$    $$      | $$            | $$  | $$      | $$  \ $$        | $$        | $$                | $$    
|  $$$$$$/      | $$$$$$$$      | $$  | $$      | $$  | $$       /$$$$$$      | $$                | $$    
 \______/       |________/      |__/  |__/      |__/  |__/      |______/      |__/                |__/    
                                                                                                          
                                                                                                          
                                                                                                          
`;
  console.log(banner);
}


main();