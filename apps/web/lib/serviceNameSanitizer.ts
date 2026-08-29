/**
 * Service Name Sanitizer Utility
 * Converts noisy, weird provider service titles into clean, professional display titles
 * e.g., "1540 - Instagram Followers [30 Days Refill - 50K/D] [R30] [SUPER CHEAP] #5302"
 *    => { groupName: "Instagram Followers", variantName: "30 Days Guarantee" }
 */

export interface CleanedNameResult {
  groupName: string;
  variantName: string;
}

export function cleanServiceName(rawName: string): CleanedNameResult {
  if (!rawName) {
    return { groupName: "Service", variantName: "Standard" };
  }

  let name = rawName.trim();

  // 1. Remove leading/trailing IDs
  name = name.replace(/^(\d+|\bID[:\s]*\d+)\s*[-:.|]\s*/i, "");
  name = name.replace(/^#\d+\s*/, "");
  name = name.replace(/#\d+$/g, "");
  name = name.replace(/\[\s*id[:\s]*\d+\s*\]/gi, "");
  name = name.replace(/id[:\s]*\d+$/gi, "");

  // 2. Normalize mathematical bold fonts
  const mathCharsArray = [..."𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"];
  const asciiCharsArray = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"];
  name = name.replace(
    /[\u{1D5D4}-\u{1D607}\u{1D7EC}-\u{1D7F5}]/gu,
    (char) => {
      const idx = mathCharsArray.indexOf(char);
      return idx !== -1 ? asciiCharsArray[idx] : char;
    }
  );

  // 3. Strip Emojis
  name = name.replace(/[\p{Emoji_Presentation}]/gu, "");

  // 4. Check for explicit variant separators or bracketed guarantees
  let overrideVariant = "";
  const refillMatch = rawName.match(/\[.*?(30|60|90|365|Lifetime|Auto|Refill).*?\]/i) || rawName.match(/\((.*?(30|60|90|365|Lifetime|Refill).*?)\)/i);
  if (refillMatch) {
    const rawRefill = refillMatch[1] || refillMatch[0];
    if (/lifetime/i.test(rawRefill)) overrideVariant = "Lifetime Guarantee";
    else if (/365/i.test(rawRefill)) overrideVariant = "365 Days Guarantee";
    else if (/90/i.test(rawRefill)) overrideVariant = "90 Days Guarantee";
    else if (/60/i.test(rawRefill)) overrideVariant = "60 Days Guarantee";
    else if (/30/i.test(rawRefill)) overrideVariant = "30 Days Guarantee";
    else if (/refill/i.test(rawRefill)) overrideVariant = "Auto Refill";
  }

  let groupName = name.trim();
  let variantString = "";

  // Check if there is an explicit separator like ' - ', ' : ', ' | ', ' -- '
  const sepMatch = name.match(/^(.*?)\s+(?:[-:|—]|--)\s+(.*)$/);
  if (sepMatch && sepMatch[1] && sepMatch[2]) {
    groupName = sepMatch[1].trim();
    variantString = sepMatch[2].trim();
  } else {
    // Strip brackets to see if a variant was inside brackets
    groupName = groupName.replace(/\[[^\]]*\]/g, "").replace(/\([^\)]*\)/g, "").trim();
  }

  // 5. Clean Variant String
  let v = variantString;
  v = v.replace(/\[[^\]]*\]/g, "");
  v = v.replace(/\([^\)]*(speed|d|day|refill|instant|cheap|fast|min|hrs|max|r30|r60|r90|hq|real|non-drop|working)[^\)]*\)/gi, "");
  v = v.replace(/\b(MAX|SPEED|STARTS)\s*[\d.KkMm]+[\s-]*\b/gi, "");
  v = v.replace(/\b[\d.KkMm+]+(\/Day| Day)\b/gi, "");
  v = v.replace(/\b\d+\s*(?:K|M|B)\b(?!\s*(?:Likes|Followers|Views|Comments|Shares))/gi, "");
  v = v.replace(/\b(INSTANT|WORKING|PREMIUM|CHEAP)\b/gi, "");
  v = v.replace(/[-|:🔢♻️⚡🚀💧👤]+/g, " ");
  v = v.replace(/\s+/g, " ").trim();
  v = v.replace(/^\W+/, "").replace(/\W+$/, "");

  // Capitalize neatly
  groupName = groupName.replace(/\s+/g, " ").trim();
  v = v.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

  let finalVariant = overrideVariant || v;
  if (!finalVariant || finalVariant.length < 2) {
    if (/real/i.test(rawName)) finalVariant = "Real Accounts";
    else if (/hq|high quality/i.test(rawName)) finalVariant = "High Quality";
    else finalVariant = "Standard";
  }

  return { 
    groupName: groupName || "Service", 
    variantName: finalVariant 
  };
}
