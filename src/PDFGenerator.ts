import puppeteer, { PDFOptions, PaperFormat} from "puppeteer";
import path from "path";
import * as fs from "fs";
import hummus from "muhammara";
import memoryStreams from "memory-streams";

export interface IPageRenderData {
  content?: string;
  templatePath?: string;
  pdfOptions?: PDFOptions;
  props?: any;
}

export class PDFGenerator {
  private data: string;
  private pdfOptions: PDFOptions;
  

  constructor(format: PaperFormat = "A4") {
    this.data = "";
    this.pdfOptions = { format };
  }

  /**
   * Establece opciones personalizadas para el PDF.
   * @param pdfOptions - Opciones del PDF.
   * @returns Instancia de PDFGenerator.
   */
  public setPdfOptions(pdfOptions: PDFOptions): PDFGenerator {
    this.pdfOptions = pdfOptions;
    return this;
  }

  /**
   * Establece el contenido HTML desde una cadena.
   * @param data - Contenido HTML.
   * @returns Instancia de PDFGenerator.
   */
  public fromContent(data: string): PDFGenerator {
    this.data = data;
    return this;
  }

  /**
   * Recupera y establece el contenido HTML desde un archivo.
   * @param path - Ruta del archivo.
   * @returns Instancia de PDFGenerator.
   */
  public async fromFile(filePath: string): Promise<PDFGenerator> {
    try {
      const fileContent = await fs.promises.readFile(filePath, "utf-8");
      this.data = fileContent;
      return this;
    } catch (error: any) {
      console.error(error.message || error);
      throw new Error(`Error reading file at path: "${filePath}"\n${error}`);
    }
  }

  /**
   * Genera un PDF y devuelve un buffer.
   * Se recomienda para plantillas de bajo impacto.
   * @param props - Parámetros para el navegador antes de generar el PDF.
   * @returns Buffer generado.
   */
  public async generatePdf<T>(props: T = {pageNumber: 1} as T): Promise<Buffer> {
    try {
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();

      // Pasa props directamente a page.evaluate
      await page.evaluate((props) => {
        (window as any).PDFGeneratorData = props || {};
      }, props);

      // Carga el contenido HTML en la página
      await page.setContent(this.data);

      const pdfBuffer: Buffer = await page.pdf(this.pdfOptions);
      await browser.close();
      return pdfBuffer;
    } catch (error: any) {
      console.error(error.message || error);
      throw new Error(`Generate PDF Error: ${error.message || error}`);
    }
  }

  /**
   * Genera un PDF y devuelve un Stream.
   * Se recomienda para respuestas HTTP o archivos de alto impacto.
   * @param props - Parámetros para el navegador antes de generar el PDF.
   * @returns ReadStream generado.
   */
  public async generatePdfStream<T>(props: T = {pageNumber: 1} as T): Promise<fs.ReadStream> {
    try {
      // Verifica si la carpeta temp existe, si no, créala
      const tempFolderPath = path.join(__dirname, "temp");
      if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
      }

      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();

      // Pasa props directamente a page.evaluate
      await page.evaluate((props) => {
        (window as any).PDFGeneratorData = props || {};
      }, props);

      // Carga el contenido HTML en la página
      await page.setContent(this.data);

      // Genera un nombre de archivo único y aleatorio
      const randomFileName = `pdf_${Date.now()}_${Math.floor(
        Math.random() * 10000
      )}.pdf`;
      const tempPdfPath = path.join(tempFolderPath, randomFileName);

      // Usa path para generar el PDF en lugar de devolverlo directamente
      await page.pdf({ path: tempPdfPath, ...this.pdfOptions });

      // Devuelve un stream leyendo el archivo generado
      const readStream = fs.createReadStream(tempPdfPath);

      // Elimina el archivo temporal después de crear el stream
      readStream.on("close", () => fs.promises.unlink(tempPdfPath));

      return readStream;
    } catch (error: any) {
      console.error(error.message || error);
      throw new Error(`Generate PDF Error: ${error.message || error}`);
    }
  }

  /**
   * Genera múltiples páginas de un PDF.
   * @param pageData - Array con los datos de cada página.
   * @returns Buffer con el PDF generado.
   */
  public async generateMultiPagePdf(
    pageData: IPageRenderData[]
  ): Promise<Buffer> {
    try {
      const buffers: Buffer[] = [];
      let i: number = 0;
      for (const page of pageData) {
        i++;
        if (page.templatePath) {
          await this.fromFile(page.templatePath);
        } else if (page.content) {
          this.data = page.content;
        }
        this.setPdfOptions(page.pdfOptions || {});
        const file = await this.generatePdf({ pageNumber: i, ...page.props });
        buffers.push(file);
      }

      const totalBuffer = this.mergePDFs(buffers);
      return totalBuffer;
    } catch (error: any) {
      console.error(error.message || error);
      throw new Error(`Generate Multi Page PDF Error: ${error.message || error}`);
    }
  }

  /**
   * Combina varios archivos PDF en uno solo.
   * @param {Buffer[]} buffers - Array de buffers de archivos PDF a combinar.
   * @returns {Buffer} - Buffer del archivo PDF combinado.
   */
  public mergePDFs(buffers: Buffer[]): Buffer {
    const [first] = buffers;

    const outStream = new memoryStreams.WritableStream();
    const firstPdfStream = new hummus.PDFRStreamForBuffer(first);

    const pdfWriter = hummus.createWriterToModify(
      firstPdfStream,
      new hummus.PDFStreamForResponse(outStream)
    );

    buffers.shift();
    buffers.forEach((buffer) => {
      const newPdfStream = new hummus.PDFRStreamForBuffer(buffer);
      pdfWriter.appendPDFPagesFromPDF(newPdfStream);
    });

    pdfWriter.end();
    return outStream.toBuffer();
  }
}
