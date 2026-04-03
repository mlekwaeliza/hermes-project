const { exec } = require('child_process');

function killPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
      if (!stdout) return resolve();
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid) {
            console.log(`Killing PID ${pid} on port ${port}`);
            exec(`taskkill /PID ${pid} /F`, () => {
              console.log(`Successfully killed ${pid}`);
              resolve();
            });
            return;
          }
        }
      }
      resolve();
    });
  });
}

(async () => {
   console.log("Checking ports...");
   await killPort(3000);
   await killPort(3001);
   await killPort(5000); // just in case the backend was on 5000 in .env somehow
   console.log('Ports cleared!');
})();
