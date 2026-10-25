/*
 * cp437.js: Unicode to code page 437 (ESC t 0, "PC437: USA, Standard Europe"),
 * the code page every ESC/POS printer has and the one with the shading and
 * block glyphs: ░ B0, ▒ B1, ▓ B2, █ DB, ▄ DC, ▌ DD, ▐ DE, ▀ DF, ■ FE, and the
 * box drawing set B3 to DA. Bytes 0x20-0x7E are ASCII.
 */
export const HIGH = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const TO = new Map();
for (let b = 0x20; b < 0x7f; b++) TO.set(String.fromCharCode(b), b);
[...HIGH].forEach((ch, i) => TO.set(ch, 0x80 + i));
// Near neighbours for glyphs pieces use that 437 lacks.
const NEAR = { "•": 0xf9, "●": 0xfe, "▪": 0xfe, "…": 0x2e, "━": 0xc4, "┃": 0xb3, "╭": 0xda, "╮": 0xbf, "╰": 0xc0, "╯": 0xd9, "“": 0x22, "”": 0x22, "‘": 0x27, "’": 0x27, "–": 0x2d, "—": 0x2d, "×": 0x78, "✓": 0xfb };

/** The CP437 byte for a character, or undefined. */
export const byteOf = (ch) => TO.get(ch);
/** True when every character of s has a CP437 byte (no near neighbours). */
export const encodable = (s) => [...s].every((ch) => TO.has(ch) || ch === "\n");
/** A string to CP437 bytes; characters 437 lacks become a near neighbour or "?". */
export function encode(s) {
  const out = [];
  for (const ch of s) {
    const b = TO.get(ch) ?? NEAR[ch];
    out.push(b === undefined || b < 0x20 ? 0x3f : b);
  }
  return out;
}
/** A CP437 byte (0x20 and up) back to its character. */
export const charOf = (b) => (b >= 0x80 ? HIGH[b - 0x80] : String.fromCharCode(b));
