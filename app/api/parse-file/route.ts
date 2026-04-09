import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let text = "";

    if (file.name.endsWith(".pdf")) {
      const pdf = require("pdf-parse");
      const data = await pdf(buffer);
      text = data.text;
    } else if (file.name.endsWith(".md") || file.name.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    // Basic cleaning
    text = text.trim();

    return NextResponse.json({ 
      text,
      fileName: file.name,
      fileSize: file.size,
      preview: text.substring(0, 500) + (text.length > 500 ? "..." : "")
    });
  } catch (error: any) {
    console.error("File parsing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
