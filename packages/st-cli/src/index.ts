#!/usr/bin/env node

import { Command } from 'commander';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { SportsTrackerClient } from '@st-ai/client';
import { loadConfig, saveConfig, clearConfig } from './config.js';
import { getActivityName } from './activity.js';

const program = new Command();

program
  .name('st')
  .description('st.ai — CLI tool and agentic helper for Sports Tracker')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format')
  .option('--api-url <url>', 'Override Sports Tracker API base URL');

function getClient(cmdOptions: Record<string, any>): SportsTrackerClient {
  const config = loadConfig();
  const apiURL = cmdOptions.apiUrl || program.opts().apiUrl;
  return new SportsTrackerClient(config.sessionKey, config.email, apiURL);
}

function checkAuth(client: SportsTrackerClient) {
  if (!client.getSessionKey()) {
    console.error('Error: Not authenticated. Please run: st login');
    process.exit(4);
  }
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`;
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (ans: string) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function askPassword(query: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin
      });
      rl.on('line', (line: string) => {
        rl.close();
        resolve(line.trim());
      });
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const oldWrite = (rl as any)._writeToOutput;
    (rl as any)._writeToOutput = function (stringToWrite: string) {
      if (stringToWrite === '\r\n' || stringToWrite === '\n' || stringToWrite === '\r') {
        oldWrite.call(rl, stringToWrite);
      } else {
        oldWrite.call(rl, '*');
      }
    };

    rl.question(query, (answer: string) => {
      (rl as any)._writeToOutput = oldWrite;
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 1. LOGIN
program
  .command('login')
  .description('Authenticate against Sports Tracker and save session locally')
  .option('-e, --email <email>', 'Email address')
  .action(async (options: { email?: string }) => {
    try {
      let email = options.email || process.env.ST_EMAIL;
      if (!email) {
        email = await askQuestion('Email: ');
      }
      if (!email) {
        console.error('Error: Email is required.');
        process.exit(2);
      }

      const password = process.env.ST_PASSWORD || await askPassword('Password: ');
      if (!password) {
        console.error('Error: Password is required.');
        process.exit(2);
      }

      console.log('Logging in...');
      const client = await SportsTrackerClient.login(email, password);
      
      const sessionKey = client.getSessionKey();
      if (sessionKey) {
        saveConfig(sessionKey, email);
        if (program.opts().json) {
          console.log(JSON.stringify({ status: 'success', email }));
        } else {
          console.log(`Login successful! Session key saved for ${email}`);
        }
      }
    } catch (err: any) {
      if (program.opts().json) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`Login failed: ${err.message}`);
      }
      process.exit(1);
    }
  });

// 2. LOGOUT
program
  .command('logout')
  .description('Clear local Sports Tracker session')
  .action(async () => {
    try {
      const client = getClient({});
      if (client.getSessionKey()) {
        try {
          await client.logout();
        } catch {
          // Ignore API error on logout, clear config anyway
        }
      }
      clearConfig();
      if (program.opts().json) {
        console.log(JSON.stringify({ status: 'logged_out' }));
      } else {
        console.log('Logged out. Session config cleared.');
      }
    } catch (err: any) {
      console.error(`Logout error: ${err.message}`);
      process.exit(1);
    }
  });

// 3. WHOAMI
program
  .command('whoami')
  .description('Display currently logged-in user profile')
  .action(async () => {
    const client = getClient({});
    checkAuth(client);
    try {
      const profile = await client.whoami();
      if (program.opts().json) {
        console.log(JSON.stringify(profile, null, 2));
      } else {
        console.log('--- Profile ---');
        console.log(`Username:       ${profile.username}`);
        console.log(`Real Name:      ${profile.realName || 'N/A'}`);
        console.log(`Country:        ${profile.country || 'N/A'}`);
        console.log(`User Key:       ${profile.key}`);
        console.log(`Gender:         ${profile.gender || 'N/A'}`);
        console.log(`UUID:           ${profile.uuid || 'N/A'}`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// 4. WORKOUTS (LIST)
program
  .command('workouts')
  .description('List workouts/diary entries')
  .option('--since <timestamp>', 'Fetch workouts since unix timestamp ms', parseInt)
  .option('--limit <limit>', 'Limit workout count', parseInt)
  .option('--offset <offset>', 'Offset count', parseInt)
  .action(async (options: { since?: number; limit?: number; offset?: number }) => {
    const client = getClient({});
    checkAuth(client);
    try {
      const list = await client.listWorkouts({
        since: options.since,
        limit: options.limit,
        offset: options.offset
      });

      if (program.opts().json) {
        console.log(JSON.stringify(list, null, 2));
      } else {
        if (list.items.length === 0) {
          console.log('No workouts found.');
          return;
        }

        console.log('Date             Activity             Distance     Duration     Ascent    Workout Key');
        console.log('----------------------------------------------------------------------------------------------------');
        for (const w of list.items) {
          const dateStr = new Date(w.startTime).toLocaleString('en-US', { hour12: false }).substring(0, 16);
          const actName = getActivityName(w.activityId).padEnd(20);
          const distStr = `${(w.totalDistance / 1000).toFixed(2)} km`.padEnd(12);
          const durStr = formatDuration(w.totalTime).padEnd(12);
          const ascStr = w.totalAscent !== undefined ? `${w.totalAscent.toFixed(0)} m` : '-';
          console.log(`${dateStr}  ${actName} ${distStr} ${durStr} ${ascStr.padEnd(9)} ${w.key}`);
        }
        console.log(`\nTotal displayed: ${list.items.length} workouts. Cursor: until=${list.until}`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// 5. STATS
program
  .command('stats')
  .description('Display summary statistics for a user')
  .argument('[username]', 'Username of user (defaults to current user)')
  .action(async (username: string | undefined) => {
    const client = getClient({});
    checkAuth(client);
    try {
      let targetUser = username;
      if (!targetUser) {
        const profile = await client.whoami();
        targetUser = profile.username;
      }

      const stats = await client.getStats(targetUser);
      if (program.opts().json) {
        console.log(JSON.stringify(stats, null, 2));
      } else {
        console.log(`--- Statistics for ${targetUser} ---`);
        console.log(`Total Workouts: ${stats.totalNumberOfWorkoutsSum}`);
        console.log(`Total Days:     ${stats.totalDays}`);
        console.log(`Total Distance: ${(stats.totalDistanceSum / 1000).toFixed(2)} km`);
        console.log(`Total Time:     ${formatDuration(stats.totalTimeSum)}`);
        console.log(`Total Energy:   ${stats.totalEnergyConsumptionSum.toFixed(0)} kcal`);
        
        if (stats.allStats && stats.allStats.length > 0) {
          console.log('\nPer Activity Breakdown:');
          console.log('Activity             Count      Distance     Duration     Energy');
          console.log('---------------------------------------------------------------------------');
          for (const a of stats.allStats) {
            const actName = getActivityName(a.activityId).padEnd(20);
            const countStr = String(a.count).padEnd(10);
            const distStr = `${(a.distance / 1000).toFixed(2)} km`.padEnd(12);
            const durStr = formatDuration(a.duration).padEnd(12);
            const nrgStr = `${a.energy.toFixed(0)} kcal`;
            console.log(`${actName} ${countStr} ${distStr} ${durStr} ${nrgStr}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// 6. EXPORT
program
  .command('export')
  .description('Download workout file as GPX or FIT')
  .argument('<key>', 'Workout Key ID')
  .argument('<outPath>', 'Output path (file name or directory)')
  .option('-f, --format <format>', 'Export format (gpx or fit)', 'gpx')
  .action(async (key: string, outPath: string, options: { format: string }) => {
    const client = getClient({});
    checkAuth(client);
    try {
      const format = options.format.toLowerCase();
      if (format !== 'gpx' && format !== 'fit') {
        console.error('Error: Format must be either "gpx" or "fit".');
        process.exit(2);
      }

      console.log(`Downloading workout ${key} in ${format.toUpperCase()} format...`);
      const buffer = format === 'gpx' ? await client.exportGpx(key) : await client.exportFit(key);

      let finalPath = outPath;
      if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
        finalPath = path.join(outPath, `workout-${key}.${format}`);
      }

      fs.writeFileSync(finalPath, buffer);
      if (program.opts().json) {
        console.log(JSON.stringify({ status: 'exported', file: finalPath }));
      } else {
        console.log(`Saved exported file to ${finalPath}`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// 7. DELETE
program
  .command('delete')
  .description('Permanently delete a workout')
  .argument('<key>', 'Workout Key ID')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (key: string, options: { yes?: boolean }) => {
    const client = getClient({});
    checkAuth(client);
    try {
      let confirm = options.yes;
      if (!confirm) {
        if (!process.stdin.isTTY) {
          console.error('Error: Non-interactive shell detected. Must pass --yes flag to confirm deletion.');
          process.exit(2);
        }
        const answer = await askQuestion(`Are you sure you want to delete workout ${key}? (y/N): `);
        confirm = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      }

      if (!confirm) {
        console.log('Deletion cancelled.');
        return;
      }

      console.log(`Deleting workout ${key}...`);
      await client.deleteWorkout(key);
      if (program.opts().json) {
        console.log(JSON.stringify({ status: 'deleted', key }));
      } else {
        console.log('Workout deleted successfully.');
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// 8. UPLOAD
program
  .command('upload')
  .description('Upload a workout SML file')
  .argument('<smlPath>', 'Path to SML file')
  .option('-e, --extensions <extPath>', 'Path to optional extensions JSON file')
  .action(async (smlPath: string, options: { extensions?: string }) => {
    const client = getClient({});
    checkAuth(client);
    try {
      console.log(`Uploading workout file: ${smlPath}...`);
      const workout = await client.uploadWorkout(smlPath, options.extensions);
      if (program.opts().json) {
        console.log(JSON.stringify(workout, null, 2));
      } else {
        console.log('Upload successful!');
        console.log(`New Workout Key: ${workout.key}`);
        console.log(`Activity:        ${getActivityName(workout.activityId)}`);
        console.log(`Distance:        ${(workout.totalDistance / 1000).toFixed(2)} km`);
        console.log(`Duration:        ${formatDuration(workout.totalTime)}`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
