import { NextResponse } from "next/server";

// pdf-parse and mammoth are loaded dynamically, and marked as external in next.config.ts —
// their bundled dependencies (pdfjs-dist) assume a plain Node require/exports environment that
// Next.js's webpack bundling for API routes doesn't provide.

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 40000;

/** pdf-parse appends a "-- N of M --" page marker after every page; strip it so the extracted text reads cleanly. */
function cleanPdfText(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^--\s*\d+\s*of\s*\d+\s*--$/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extracts real text only, from PDF/DOCX/TXT — no OCR, no fabrication. Analysis happens separately via /api/ai. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Please upload a valid file." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: "No file provided." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ success: false, error: "File is too large (max 15MB)." }, { status: 400 });

  const name = file.name || "document";
  const ext = name.toLowerCase().split(".").pop() || "";
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    let text = "";
    if (ext === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = cleanPdfText(result.text);
      } finally {
        await parser.destroy();
      }
    } else if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value.trim();
    } else if (ext === "txt" || ext === "md") {
      text = buffer.toString("utf-8").trim();
    } else {
      return NextResponse.json({ success: false, error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file." }, { status: 400 });
    }

    if (!text) return NextResponse.json({ success: false, error: "Could not extract any text from this file." }, { status: 400 });

    return NextResponse.json({ success: true, data: { fileName: name, text: text.slice(0, MAX_TEXT_CHARS) } });
  } catch (err) {
    console.error("Document extraction failed", err);
    return NextResponse.json({ success: false, error: "Could not read this file. Please try a different document." }, { status: 500 });
  }
}
