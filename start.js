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
    const pos = robot.getMousePos();
    console.log(`Acesso ao mouse concedido. Posição atual: (${pos.x}, ${pos.y})`);
  } catch (error) {
    console.error("Permissão para controlar o mouse não concedida.");
    console.error("Por favor, conceda a permissão de Acessibilidade:");
    console.error("Em macOS: Vá para Preferências do Sistema > Segurança e Privacidade > Privacidade > Acessibilidade e adicione este terminal.");
    process.exit(1);
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

  // Se o usuário não moveu o mouse desde a última verificação,
  // realiza um movimento sutil de 1 pixel para a direita e volta
  if (currentPos.x === lastPos.x && currentPos.y === lastPos.y) {
    // Move o mouse 1 pixel para a direita
    robot.moveMouse(currentPos.x + 1, currentPos.y);
    setTimeout(() => {
      // Verifica se o mouse ainda está na posição modificada
      let posAfterDelay = robot.getMousePos();
      if (posAfterDelay.x === currentPos.x + 1 && posAfterDelay.y === currentPos.y) {
        robot.moveMouse(currentPos.x, currentPos.y);
      }
      // Atualiza a última posição conhecida
      lastPos = robot.getMousePos();
    }, 1000);
  } else {
    // Se o usuário moveu o mouse, atualiza a última posição sem interferir
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