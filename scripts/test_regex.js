// Pure simulation test for regex logic


async function test() {
    const replacementRules = [
        { find: "代繳健保費 (\\d+)", replace: "代繳健保費", deleteRow: false }
    ];

    const testItem = "代繳健保費 11409";
    console.log("Original Text:", testItem);

    // Test logic similar to applyReplacementRules (since it's a private function in the real file, I'll simulate it or test the public export if available)
    // Actually, I'll just run a quick node script that imports it.

    // Note: processor.ts uses ESM imports, so we need to run it with a tool that supports it or just simulate.
}

// Simulated test
function simulateApplyReplacementRules(text, rules) {
    let processedText = text;
    let capturedText = undefined;

    for (const rule of rules) {
        const regex = new RegExp(rule.find, 'g');
        const match = regex.exec(processedText);
        if (match) {
            if (match.length > 1 && match[1]) {
                capturedText = match[1];
            }
            processedText = processedText.replace(regex, rule.replace);
        }
    }
    return { processedText, capturedText };
}

const result = simulateApplyReplacementRules("代繳健保費 11409", [
    { find: "代繳健保費 (\\d+)", replace: "代繳健保費" }
]);

console.log("Result:", JSON.stringify(result, null, 2));

if (result.processedText === "代繳健保費" && result.capturedText === "11409") {
    console.log("✅ Regex Capture Test Passed!");
} else {
    console.log("❌ Regex Capture Test Failed!");
}
