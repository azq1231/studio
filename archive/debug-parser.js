const rawText = `交易日期	入帳日期	交易項目/交易國家或地區/折算新臺幣日期	幣別/交易金額	(折算)新臺幣金額上期應繳金額：　　　　　　　　　　　　　　　　　	TWD 48,345	01/12		　感謝您辦理本行自動轉帳繳款！　　　　　　　　　　	TWD -48,345	本期消費明細：　　　　　　　　　　　　　　　　　　		卡號：5242-XXXX-XXXX-7612（Ｐｉ信用卡－正卡）		12/23	12/29	　樂購蝦皮－江玲玉　　　　　　　　　　　　		37812/28	12/29	　爭鮮迴轉壽司－南京復興店　　　　　　　　		1,06012/29	12/30	　寶雅生活館忠孝明曜店　　　　　　　　　　		9912/29	12/30	　全支付﹘全聯線上購　　　　　　　　　　　		90612/29	12/29	am.Nord*VPNcom GBR London 12/29	TWD 334.95	33512/29	12/29	　國外交易服務費		512/29	12/30	ALP*Programming CHN Shanghai 12/30	CNY 12.75	5712/29	12/30	am.Nord*VPNcom GBR London 12/30	TWD -334.95	-33512/29	12/30	　國外交易服務費		-512/29	01/05	　星巴克－自動加值　　　　　　　　　　　　		50012/31	01/06	　樂購蝦皮－ｌｏｖｅｐｉｐｐｙｓ　　　　　		15801/01	01/02	VULTR BY CONSTANT USA MATAWAN 01/02	USD 10.83	34101/01	01/02	　國外交易服務費		501/01	01/02	GOOGLE*CLOUD XR8F6G SGP CC GOOGLE.COM 01/02	TWD 4	401/02	01/05	　全支付﹘全聯　　　　　　　　　　　　　　		9601/02	01/06	　大安文山有線電視股份有限公司　　　　　　		1,61701/02	01/07	　統一時代百貨台北店　　　　　　　　　　　		85201/03	01/05	　全支付﹘全聯　　　　　　　　　　　　　　		1,12301/04	01/05	　全支付﹘全聯　　　　　　　　　　　　　　		21001/04	01/07	　誠品生活股份有限公司松山分公　　　　　　		7201/05	01/08	　呂桑食堂　　　　　　　　　　　　　　　　		1,28701/05	01/08	　一沐日－－－網路　　　　　　　　　　　　		13501/05	01/12	　悠遊卡自動加值金額─台北捷運國父紀念館　　　　　		50001/05	01/09	　高鐵智慧型手機ＩＰｈｏｎｅ　　　　　　　		5,40001/05	01/09	　高鐵智慧型手機ＩＰｈｏｎｅ　　　　　　　		5,40001/06	01/08	　麗冠有線電視股份有限公司　　　　　　　　		19901/07	01/09	　０９２０２＊＊＊０１　　　　　　　　　　		99801/08	01/13	　樂購蝦皮－江玲玉　　　　　　　　　　　　		-37801/09	01/12	　全支付﹘全聯線上購　　　　　　　　　　　		54301/09	01/13	　樂購蝦皮－賴永裕　　　　　　　　　　　　		97101/11	01/14	　屈臣氏Ｓ０６７４忠孝東店　　　　　　　　		11901/11	01/14	　康是美巨富藥局　　　　　　　　　　　　　		1,69301/12	01/13	　街口電支－越南河內傳統料理　　　　　　　		30001/12	01/13	　全支付﹘全聯　　　　　　　　　　　　　　		1,44301/13	01/15	　Ｐｃｈｏｍｅ　　　　　　　　　　　　　　		1,23401/13	01/16	　饗賓餐旅事業股份有限公司　　　　　　　　		3,00001/13	01/16	　台灣麥當勞ＳＯＫ－０４３　　　　　　　　		8001/14	01/15	　全支付﹘全聯　　　　　　　　　　　　　　		5601/15	01/21	　連加＊台灣Ｇ湯　台北延　　　　　　　　　		35701/16	01/27	　信用卡扣繳台灣電力公司00962445961		1,70401/16	01/19	　Ｐｃｈｏｍｅ　　　　　　　　　　　　　　		45901/16	01/20	　屈臣氏Ｓ０６７４忠孝東店　　　　　　　　		17001/16	01/20	　元心燃麻辣堂　　　　　　　　　　　　　　		58601/16	01/19	ALP*Programming CHN Shanghai 01/17	CNY 65.45	29701/16	01/19	　國外交易服務費		401/18	01/20	　全家便利商店－新南京店　　　　　　　　　		7001/18	01/21	　誠品生活股份有限公司松山分公　　　　　　		12601/18	01/21	　誠品生活股份有限公司松山分公　　　　　　		18001/18	01/21	　誠品生活股份有限公司松山分公　　　　　　		3001/18	01/22	　鳥貴成股份有限公司大巨蛋門市部　　　　　		2,20001/18	01/22	　高鐵智慧型手機ＩＰｈｏｎｅ　　　　　　　		1,35001/18	01/22	　高鐵智慧型手機ＩＰｈｏｎｅ　　　　　　　		4,72501/18	01/22	　高鐵智慧型手機ＩＰｈｏｎｅ　　　　　　　		1,35001/18	01/22	　高鐵智慧型手機ＩＰｈｏｎｅ　　　　　　　		67501/18	01/22	　高鐵智慧型手機ＩＰｈｏｎｅ　　　　　　　		4,05001/19	01/22	　南美股份有限公司　　　　　　　　　　　　		10001/21	01/22	　全支付﹘全聯　　　　　　　　　　　　　　		7201/21	01/22	　Ｐｃｈｏｍｅ　　　　　　　　　　　　　　		-34901/21	01/21	GOOGLE*CLOUD CR3HDZ SGP CC GOOGLE.COM 01/21	USD 10	31701/21	01/21	　國外交易服務費		401/22	01/27	　微風台北車站美食街　　　　　　　　　　　		89001/23	01/27	　信用卡扣繳台北市自來水費1060072942		62701/23	01/27	　Ｃａｅｓａｒ　Ｃａｋｅｓ　　　　　　　　		9501/23	01/27	　大戶屋凱撒店　　　　　　　　　　　　　　		1,33101/23	01/26	　統一超商－高鐵南站　　　　　　　　　　　		11401/25	01/26	　爭鮮迴轉壽司－西門店　　　　　　　　　　		970`;

// Mock SHA-1 since we are in simple node script
const crypto = require('crypto');
async function sha1(str) {
    return crypto.createHash('sha1').update(str).digest('hex');
}

// ---------------------------------------------------------
// PASTE THE FUNCTION TO TEST HERE (OR IMPORT IF YOU CONVERT TO MODULE)
// We will mimic the key logic from src/lib/parser.ts here for quick iteration
// ---------------------------------------------------------
async function parseCreditCard(text) {
    // PRE-PROCESSING: THIS IS THE FIX WE WANT TO IMPLEMENT
    // Look for patterns where a date follows a number immediately or with spaces
    // Regex: (any digit) + (possible spaces/tabs) + (digit/digit)
    // We want to insert a newline before the date.

    // Attempt 1: naive regex for date at start of line
    // The issue: "37812/28" -> "378\n12/28"
    let processedText = text.replace(/(\d)(\d{2}\/\d{2})/g, '$1\n$2');
    processedText = processedText.replace(/）\s*(\d{2}\/\d{2})/g, '）\n$1');

    // Also handle cases where there might be spaces but no newline: "1,000 12/29" -> "1,000\n12/29"
    // processedText = processedText.replace(/(\d)\s+(\d{2}\/\d{2})/g, '$1\n$2');

    const lines = processedText.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];

    const dateRegex = /^\d{1,2}\/\d{1,2}$/;
    const amountRegex = /^-?[\d,]+(\.\d+)?$/;

    for (const line of lines) {
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length < 3) continue;

        let transactionDate = '';
        let postingDate = '';
        let description = '';
        let amount = 0;
        let bankCode = undefined;

        if (dateRegex.test(parts[0])) {
            transactionDate = parts[0];
            let descStartIndex = 1;
            if (dateRegex.test(parts[1])) {
                postingDate = parts[1];
                descStartIndex = 2;
            } else {
                postingDate = transactionDate;
            }

            const lastPart = parts[parts.length - 1];
            if (amountRegex.test(lastPart)) {
                amount = parseFloat(lastPart.replace(/,/g, ''));
                let descEndIndex = parts.length - 1;

                // Heuristic for bank code/remark
                const secondLastPart = parts[parts.length - 2];
                const potentialRemarkRegex = /^[a-zA-Z0-9/.-]+$/;
                // Simply check if second last is not numeric (likely description) or is short code
                if (potentialRemarkRegex.test(secondLastPart) && isNaN(parseFloat(secondLastPart))) {
                    // Check third last
                    const thirdLastPart = parts.length > 3 ? parts[parts.length - 3] : '';
                    const thirdLastIsNumeric = !isNaN(parseFloat(thirdLastPart));
                    if (!thirdLastIsNumeric) {
                        bankCode = secondLastPart;
                        descEndIndex = parts.length - 2;
                    }
                }

                description = parts.slice(descStartIndex, descEndIndex).join(' ');
            } else {
                continue;
            }
        } else {
            continue;
        }

        if (!description || !amount && amount !== 0) continue;

        const idString = `${transactionDate}-${description}-${bankCode || ''}-${amount}`;
        const id = await sha1(idString);

        results.push({
            id,
            transactionDate,
            description,
            amount
        });
    }
    return results;
}

// ---------------------------------------------------------

(async () => {
    console.log("--- Testing Parser ---");
    const results = await parseCreditCard(rawText);
    console.log(`Parsed ${results.length} transactions.`);
    if (results.length > 0) {
        console.log("All results:");
        // Print compact line for easier diffing "Date Amount Description"
        results.forEach((r, i) => {
            console.log(`${i + 1}. [${r.transactionDate}] $${r.amount} ${r.description}`);
        });
    }

    // User data has about 50+ lines. If we get < 10, it's failed.
    if (results.length < 10) {
        console.error("FAIL: Too few results found. Logic is likely broken.");
    } else {
        console.log("SUCCESS: Looks reasonable.");
    }
})();
