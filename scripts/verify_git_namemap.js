// 驗證 Git HEAD 中 finance-flow-client.tsx 的 nameMap 是否正確
const { execSync } = require('child_process');
const content = execSync('git show HEAD:src/components/finance-flow-client.tsx', {
    cwd: 'd:\\MyProjects\\FinanceFlow\\studio',
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
});

// 找 nameMap 部分
const match = content.match(/const nameMap.*?=\s*\{([\s\S]*?)\};/);
if (!match) {
    console.log("ERROR: nameMap not found in Git HEAD");
    process.exit(1);
}

const mapContent = match[1];
// 測試幾個關鍵代號
const tests = ['2330.TW', '3231.TW', '2603.TW', '5871.TW', '2881.TW', '2002.TW'];
for (const sym of tests) {
    const re = new RegExp(`'${sym.replace('.', '\\.')}': '([^']*)'`);
    const m = mapContent.match(re);
    if (m) {
        console.log(`  ${sym} => '${m[1]}' (length=${m[1].length})`);
    } else {
        console.log(`  ${sym} => NOT FOUND IN MAP!`);
    }
}

// 確認 nameMap 有幾個 key
const keyCount = (mapContent.match(/'\d{4}\.TW'/g) || []).length;
console.log(`\nTotal keys in nameMap: ${keyCount}`);

// 確認 stock.n 的使用
const usesN = content.includes('stock.n || nameMap[stock.s]');
console.log(`Uses stock.n fallback logic: ${usesN}`);

// 確認是用直接中文還是 unicode escape
if (mapContent.includes('\\u')) {
    console.log("\nWARNING: nameMap contains \\u unicode escapes instead of direct Chinese!");
    console.log("This will show as literal '\\u53f0\\u7a4d\\u96fb' instead of '台積電'");
} else {
    console.log("\nnameMap uses direct Chinese characters (correct).");
}
