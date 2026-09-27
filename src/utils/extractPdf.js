import fs from "fs";
import pdf from "pdf-parse";

const extractPdf = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdf(buffer);

  return data.text.trim();
};

export default extractPdf;