// scripts/build.js
// 修復 WATCH_REPORT_DEPENDENCIES 環境變數導致 Next.js build worker crash 的問題
// Node.js 20.19+ 設定 WATCH_REPORT_DEPENDENCIES=1 時，會向所有子進程注入
// watch:require IPC 訊息，導致 jest-worker 的 ChildProcessWorker 無法解析
delete process.env.WATCH_REPORT_DEPENDENCIES;

const { execSync } = require('child_process');
try {
    execSync('npx next build', {
        stdio: 'inherit',
        cwd: __dirname.replace(/[\\/]scripts$/, ''),
        env: { ...process.env, WATCH_REPORT_DEPENDENCIES: undefined }
    });
} catch (e) {
    process.exit(e.status || 1);
}
