import { PDFGenerator } from "../PDFGenerator";
import path from "path";

describe("PDFGenerator", () => {
  test("should generate PDF from content", async () => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.fromContent("<h1>Hello, World!</h1>");
    const pdfBuffer = await pdfGenerator.generatePdf();
    expect(pdfBuffer).toBeDefined();
  });

  test("should generate PDF from file", async () => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.fromFile(path.join(__dirname, "index.html"));
    const pdfBuffer = await pdfGenerator.generatePdf();
    expect(pdfBuffer).toBeDefined();
  });

  test("should merge multiple PDFs", async () => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.fromContent("<h1>Hello, World!</h1>");
    const pdf1 = await pdfGenerator.generatePdf();

    pdfGenerator.fromContent("<h1>Hello, World 2!</h1>");
    const pdf2 = await pdfGenerator.generatePdf();

    const mergedPdfBuffer = pdfGenerator.mergePDFs([pdf1, pdf2]);
    expect(mergedPdfBuffer).toBeDefined();
  });

  test("should generate PDF with stream from content", async () => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.fromContent("<h1>Test HTML Content</h1>"); 

    const stream = await pdfGenerator.generatePdfStream();

    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      const pdfContent = Buffer.concat(chunks).toString();
      expect(pdfContent).toBeDefined();
    });

    stream.on("error", (error) => {
      console.error(error);
    });
  });

  test("should generate PDF with stream from file", async () => {
    const pdfGenerator = new PDFGenerator();
    pdfGenerator.fromFile(path.join(__dirname, "index.html"));

    const stream = await pdfGenerator.generatePdfStream();

    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      const pdfContent = Buffer.concat(chunks).toString();
      expect(pdfContent).toBeDefined();
    });

    stream.on("error", (error) => {
      console.error(error);
    });
  });
});
