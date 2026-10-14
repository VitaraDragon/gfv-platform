const pdfParse = require("pdf-parse/lib/pdf-parse.js");

async function testoDaPdf(buffer) {
  if (!buffer || !buffer.length) return "";
  try {
    const data = await pdfParse(buffer);
    return String(data.text || "").replace(/\s+/g, " ").trim();
  } catch (err) {
    return "";
  }
}

module.exports = { testoDaPdf };
