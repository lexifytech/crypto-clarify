const { spawn } = require("child_process");
const generalParams = require("./settings/general.json")

const processName = generalParams.TELEGRAM_BOT_FATHER_TOKEN;

async function main() {
  // TRY TO STOP OLD SESSION
  await shutdown();

  // FORCE CODE UPDATE
  await tryRun("git", ["fetch", "--all"]);
  await tryRun("git", ["reset", "--hard", "origin/main"]);

  // INSTALL DEPENDENCIES
  await tryRun("yarn", []);

  // BUILD APP
  await tryRun("npm", ["run", "build"]);

  // START PM2 INSTANCE
  await tryRun("npx", ["pm2", "start", "dist/index.js", "--name", processName]);

  // CLEAN TERMINAL AND PLOT BANNER
  console.clear();
  printBanner();
}

main();

process.stdin.resume();

process.on("SIGINT", () => {
  shutdown()
    .catch((err) => console.error("Erro no SIGINT shutdown:", err))
    .finally(() => process.exit());
});
process.on("SIGTERM", () => {
  shutdown()
    .catch((err) => console.error("Erro no SIGTERM shutdown:", err))
    .finally(() => process.exit());
});

async function shutdown() {
  await tryRun("npx", ["pm2", "delete", processName]);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      ...options,
    });
    child.on("error", (err) => reject(err));
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
                                             
   
                                       Bot is running...
                                     Type ctrl + c to stop                                                                       
                                                                                                            
  `;
  console.log(banner);
}
