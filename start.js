const { spawn } = require("child_process");
const robot = require("robotjs");
const generalParams = require("./settings/general.json");

const processName = generalParams.TELEGRAM_BOT_FATHER_TOKEN;

async function main() {
  await shutdown();

  await tryRun("git", ["fetch", "--all"]);
  await tryRun("git", ["reset", "--hard", "origin/main"]);

  await tryRun("yarn", []);

  await tryRun("npm", ["run", "build"]);

  await tryRun("npx", ["pm2", "start", "dist/index.js", "--name", processName]);

  console.clear();
  printBanner();
}

main();

// Mantém o processo ativo para que o terminal não feche
process.stdin.resume();

// Captura sinais de encerramento e executa o shutdown
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

function moveMousePeriodically() {
  const pos = robot.getMousePos();
  robot.moveMouse(pos.x + 1, pos.y + 1);
  setTimeout(() => {
    robot.moveMouse(pos.x, pos.y);
  }, 1000);
}

setInterval(moveMousePeriodically, 300000);

function printBanner() {
  const banner = `
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@%#####%@@%#######%@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@%###%###%%%@%%##%%%%%%%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@%####%%%###%%%@%####%%%%%%%@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@%###%%%######%%@@%%##%%%@@%%%@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@%%#%%%%#%#%%@@@%%%#%%%%@@@%%@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@%%@%%%%%@@%%#**###%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@%%%%%%@@@@%%%%%%%%%@@@@@@%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@%#%@@@@@@%%%%%%%%%%@@@@@%%@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@%%##%%%%%#***#%%%%%%#%%%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@%%##%%%%%#*+*#%%%%##**#%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@%#**##**+++==++****+++*%@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@#+++++==++==+======++*@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@#*+++++++++++++==++++*@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@%*+++++*%%%%%#++++++*#@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@%******#%%%%#**++**#%@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@%%%##%@%%#%%%#*+*#%%@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@%#*%@@@@@@%#%%#**+***%%%##@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@%********%@@@@@@#*+**+**#%@@@%%******#@@@@@@@@@@@@@@@@@
@@@@@@@%***********%@@@@@%%#+++*#%@@@@@@%**********%@@@@@@@@@@@@@
@@%****************#@@@%##*+++#%@@@@@%@%#*************%@@@@@@@@@@
#*******************%%%#**+**%@@@@%%%@%##****************%@@@@@@@
********************##***###%%%%%%%@@@%#*******************#@@@@@
*******###*******###****%%@@@%%@@@@@@%#**********************%@@@
**********+++**#*****##%@@@@@@@@@@@%##********#***##*#********%@@
*********+++*##*****##*#%%@@@@@@%%%###*******###*###***********%@
**+***+**+*##***++=-=+#################*##*##########***********%
*+++*****##****+==--=+#####***##################%####************
*+++*******#*+======++*#%%%#############%%%%###%%%###*******+++++
++++**++**#*=======+===**#@@@@@@@%########*%%##%%%%##***+======++
++*******+========+====+=+*%@@@@@%%%#%%#%#%#@##%%@%%#*++========+
*+******==----=====-==+===+*#@@@@@%##%@%%##%#%#%%@@%#++++=======+
***##*+==-----===----=+====++#@@@%%%%%%%@%%%#%%%%@@@#*++++=======
*#*++===-----===----===-=====*%@%%%%%%%%%%%#%#@%%@@@%**++++======
*++============----===--==+==+%@%%%%%%%%%%@%@%%%%@@@@#**+++++====
++=============-======--==+==*%@%###%%%%%%%%%%%@%%@@@%#*+++++++++
++++=+++++=========+=====++=+#%%##**###########%%%@@@@%#*++++++++
++++++++========+++====++==*%@@@%###########%%%%%%@@@@@%#*+++++++
                                             
                      Bot is running...
                    Type ctrl + c to stop
        Run 'npx pm2 logs' in another console to see logs                                                                                                                                           
  `;
  console.log(banner);
}