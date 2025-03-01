## How to Install and Run

1. **Clone or Download the Repository**  
   Start by cloning the repository or downloading it as a ZIP file.

2. **Configure Your Settings**  
   Create a folder named `settings` in the project root and fill it with your bot configuration settings.

3. **Install the Required Tools**  
   - **Node.js:** Ensure Node.js is installed.
   - **Yarn:** Install Yarn as your package manager.
   - **Git:** Verify that Git is installed.

4. **Start the Bot**  
   Run the following command to start the bot:
    ```bash
    node start.js
    ```

#### *Optional commands*
- **To view logs**
  ```bash
  pm2 logs
  ```
- **To stop all bot instances**
    ```
    pm2 delete all
    ```
___
#### *Additional Recommendations*
- **Keep Your System Awake:**
    Configure your computer or server to stay active to ensure uninterrupted bot performance.
- **For macOS Users:**
    Run the bot with the following command to prevent your Mac from sleeping:
    ```
    caffeinate -i node start.js
    ```
    *This command keeps the process running and avoids any sleep interruptions.*


