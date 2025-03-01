const { spawn } = require("child_process");
const robot = require("robotjs");
const generalParams = require("./settings/general.json");

const processName = generalParams.TELEGRAM_BOT_FATHER_TOKEN;
let lastPos = robot.getMousePos();

checkMousePermission();

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

function checkMousePermission() {
  try {
    let currentPos = robot.getMousePos();
    robot.moveMouse(currentPos.x + 10, currentPos.y);
  } catch (error) {
    console.error("Permissão para controlar o mouse não concedida.");
    console.error("Por favor, conceda a permissão de Acessibilidade:");
  }
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
  let currentPos = robot.getMousePos();
  if (currentPos.x === lastPos.x && currentPos.y === lastPos.y) {
    robot.moveMouse(currentPos.x + 1, currentPos.y);
    setTimeout(() => {
      let posAfterDelay = robot.getMousePos();
      if (
        posAfterDelay.x === currentPos.x + 1 &&
        posAfterDelay.y === currentPos.y
      ) {
        robot.moveMouse(currentPos.x, currentPos.y);
      }
      lastPos = robot.getMousePos();
    }, 1000);
  } else {
    lastPos = currentPos;
  }
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
