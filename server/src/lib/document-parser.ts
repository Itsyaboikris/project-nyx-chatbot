import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const looksLikeText = (mimeType: string, filename: string): boolean => {
    if (mimeType.startsWith("text/")) return true;
    return /\.(txt|md|csv|json)$/i.test(filename);
};

const looksLikePdf = (mimeType: string, filename: string): boolean => {
    return mimeType === "application/pdf" || /\.pdf$/i.test(filename);
};

const looksLikeDocx = (mimeType: string, filename: string): boolean => {
    return mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(filename);
};

export const extractDocumentText = async (file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<string> => {
    const { buffer, mimetype, originalname } = file;
    if (looksLikePdf(mimetype, originalname)) {
        const parser = new PDFParse({ data: buffer });
        try {
            const out = await parser.getText();
            return out.text?.trim() ?? "";
        } finally {
            await parser.destroy();
        }
    }
    if (looksLikeDocx(mimetype, originalname)) {
        const out = await mammoth.extractRawText({ buffer });
        return out.value?.trim() ?? "";
    }
    if (looksLikeText(mimetype, originalname)) {
        return buffer.toString("utf-8").trim();
    }
    throw new Error(`Unsupported document type: ${mimetype || "unknown"} (${originalname})`);
};
