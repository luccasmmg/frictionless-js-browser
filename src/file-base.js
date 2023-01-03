import { DEFAULT_ENCODING, PARSE_DATABASE, KNOWN_TABULAR_FORMAT } from "./data";
import { infer } from "tableschema";
import toArray from "stream-to-array";
import { isPlainObject } from "lodash";
import { guessParseOptions } from "./parser/csv";
import { webToNodeStream } from "./browser-utils/index";
/**
 * Abstract Base instance of File
 */
export class File {
  constructor(descriptor, { basePath } = {}) {
    this._descriptor = descriptor;
    this._basePath = basePath;
    this._descriptor.encoding = this.encoding || DEFAULT_ENCODING;
    this._computedHashes = {};
  }

  get descriptor() {
    return this._descriptor;
  }

  get path() {
    throw new Error(
      "This is an abstract base class which you should not instantiate. Use open() instead"
    );
  }

  get buffer() {
    return (async () => {
      const stream = await this.stream();
      const buffers = await toArray(stream);

      return Buffer.concat(buffers);
    })();
  }

  /**
   * Return specified number of rows as stream of data
   * @param {boolean} keyed whether the file is keyed or not
   * @param {number} sheet The number of the sheet to load for excel files
   * @param {number} size The number of rows to return
   *
   * @returns {Stream} File stream
   */
  rows({ keyed, sheet, size } = {}) {
    return this._rows({ keyed, sheet, size });
  }

  _rows({ keyed, sheet, size } = {}) {
    if (this.descriptor.format in PARSE_DATABASE) {
      const parser = PARSE_DATABASE[this.descriptor.format];
      return parser(this, { keyed, sheet, size });
    }
    throw new Error(
      `We do not have a parser for that format: ${this.descriptor.format}`
    );
  }

  /**
   * Returns a small portion of a file stream as Objects
   */
  getSample() {
    return new Promise(async (resolve, reject) => {
      let smallStream = await this.rows({ size: 100 });
      resolve(await toArray(smallStream));
    });
  }

  async addSchema() {
    if (this.displayName === "FileInline") {
      this.descriptor.schema = await infer(this.descriptor.data);
      return;
    }
    let sample = await this.getSample();

    // Try to infer schema from sample data if given file is xlsx
    if (this.descriptor.format === "xlsx" && sample) {
      let headers = 1;
      if (isPlainObject(sample[0])) {
        headers = Object.keys(sample[0]);
      }
      this.descriptor.schema = await infer(sample, { headers });
      return;
    }

    // Ensure file is tabular
    if (KNOWN_TABULAR_FORMAT.indexOf(this.descriptor.format) === -1) {
      throw new Error("File is not in known tabular format.");
    }

    // Get parserOptions so we can use it when "infering" schema:
    const parserOptions = await guessParseOptions(this);
    // We also need to include parserOptions in "dialect" property of descriptor:
    this.descriptor.dialect = {
      delimiter: parserOptions.delimiter,
      quoteChar: parserOptions.quote,
    };
    // Now let's get a stream from file and infer schema:
    let thisFileStream = await this.stream({ size: 100 });
    this.descriptor.schema = await infer(thisFileStream, parserOptions);
  }
}
