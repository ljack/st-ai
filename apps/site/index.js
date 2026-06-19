// Tab switching
const tabAgent = document.getElementById('tab-agent');
const tabCli = document.getElementById('tab-cli');
const leadEl = document.getElementById('quickstart-lead');
const codeEl = document.getElementById('quickstart-code');

if (tabAgent && tabCli && leadEl && codeEl) {
  tabAgent.addEventListener('click', () => {
    tabAgent.classList.add('active');
    tabAgent.setAttribute('aria-selected', 'true');
    tabCli.classList.remove('active');
    tabCli.setAttribute('aria-selected', 'false');
    leadEl.textContent = 'Use this if you want Sports Tracker as a skill for Claude Code, OpenClaw, or Gemini.';
    codeEl.textContent = `# 1) Install the CLI package globally\nnpm install -g @st-ai/cli\n\n# 2) Perform initial interactive authentication\nst login\n\n# 3) Register the Sports Tracker skill to your agent\nnpx skills add ljack/st-ai`;
  });

  tabCli.addEventListener('click', () => {
    tabCli.classList.add('active');
    tabCli.setAttribute('aria-selected', 'true');
    tabAgent.classList.remove('active');
    tabAgent.setAttribute('aria-selected', 'false');
    leadEl.textContent = 'Use this if you want to use the Sports Tracker tool solely via the command line.';
    codeEl.textContent = `# 1) Install the CLI package globally\nnpm install -g @st-ai/cli\n\n# 2) Log in with your email and password\nst login --email "your.email@example.com"\n\n# 3) View your diary list directly\nst workouts --limit 5`;
  });
}

// Terminal Animation
const terminalInput = document.getElementById('terminal-input');
const terminalOutput = document.getElementById('terminal-output');

const COMMANDS_DEMO = [
  {
    cmd: 'st workouts',
    out: `Date             Activity             Distance     Duration     Ascent    Workout Key
----------------------------------------------------------------------------------------------------
2026-06-19 19:34  Running              10.24 km     48m 12s      145 m     5f8382d6e32...
2026-06-17 18:15  Cycling              32.40 km     1h 14m 05s   310 m     5f8182b8c94...
2026-06-14 09:40  Hiking               12.80 km     3h 12m 45s   420 m     5f7f8287e12...

Total displayed: 3 workouts.`
  },
  {
    cmd: 'st stats',
    out: `--- Statistics for current user ---
Total Workouts: 142
Total Days:     94
Total Distance: 1,424.50 km
Total Time:     82h 14m 10s
Total Energy:   64,300 kcal

Per Activity Breakdown:
Activity             Count      Distance     Duration     Energy
---------------------------------------------------------------------------
Running              94         962.80 km    45h 12m 00s  43,200 kcal
Cycling              32         384.20 km    28h 14m 10s  16,300 kcal
Hiking               16         77.50 km     8h 48m 00s   4,800 kcal`
  },
  {
    cmd: 'st whoami',
    out: `--- Profile ---
Username:       st_athlete
Email:          athlete@example.com
Country:        FI
User Key:       5f6a8e3d81b37d04bc92015f
Email Verified: true`
  }
];

let cmdIndex = 0;

async function typeCommand(text) {
  if (!terminalInput) return;
  terminalInput.textContent = '';
  for (let i = 0; i < text.length; i++) {
    terminalInput.textContent += text[i];
    await new Promise(r => setTimeout(r, 60));
  }
}

async function startTerminalSimulation() {
  if (!terminalInput || !terminalOutput) return;
  
  while (true) {
    const demo = COMMANDS_DEMO[cmdIndex];
    await typeCommand(demo.cmd);
    await new Promise(r => setTimeout(r, 500)); // wait before output
    terminalOutput.textContent = demo.out;
    await new Promise(r => setTimeout(r, 4000)); // display output
    
    terminalOutput.textContent = '';
    terminalInput.textContent = '';
    await new Promise(r => setTimeout(r, 400)); // delay before next typing
    cmdIndex = (cmdIndex + 1) % COMMANDS_DEMO.length;
  }
}

// Start simulation
if (terminalInput && terminalOutput) {
  setTimeout(startTerminalSimulation, 1000);
}
