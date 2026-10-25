// Stops a stale preview server so e2e never tests an old build (DECISIONS "Found issues": :4173 left running
// on Windows makes reuseExistingServer pick it up). Usage: node scripts/free-port.mjs [port]
import { execFileSync } from 'node:child_process';

const port = Number(process.argv[2] ?? 4173);
if (process.platform === 'win32') {
	execFileSync(
		'powershell.exe',
		[
			'-NoProfile',
			'-Command',
			// Nothing listening is an error for Get-NetTCPConnection, so catch it and always exit 0.
			`try { Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force; "freed :${port} (pid $($_.OwningProcess))" } } catch {}; exit 0`
		],
		{ stdio: 'inherit' }
	);
} else {
	try {
		execFileSync('sh', ['-c', `lsof -ti tcp:${port} -sTCP:LISTEN | xargs -r kill`], {
			stdio: 'inherit'
		});
	} catch {
		// lsof missing or nothing listening: nothing to free.
	}
}
