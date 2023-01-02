import path from "path";
import url from "url";
import fetch from "node-fetch";
import { cloneDeep, isPlainObject, isString } from "lodash";
import mime from "mime-types";
import { csvParser } from "./parser/csv";
import { xlsxParser } from "./parser/xlsx";

// for browser related functions
import { isFileFromBrowser } from "./browser-utils/index";

import { FileInterface } from "./file-interface";
import { FileRemote } from "./file-remote";
import { FileInline } from "./file-inline";

export const DEFAULT_ENCODING = "utf-8";

// Available parsers per file format
export const PARSE_DATABASE = {
  csv: csvParser,
  tsv: csvParser,
  xlsx: xlsxParser,
  xls: xlsxParser,
};

// List of formats that are known as tabular
export const KNOWN_TABULAR_FORMAT = ["csv", "tsv", "dsv"];

/**
 * Load a file from a path or descriptor. Files source supported are
 * local, remote or inline data.
 *
 * @param {array} pathOrDescriptor - A source to load data from. Can be a local or remote file path, can be a
 * raw data object with the format:
 * {
 *  name: 'mydata',
 *  data: { // can be any javascript object, array or string
 *          a: 1,
 *          b: 2
 *      }
 * }
 *
 * Files can also be loaded with a descriptor object. This allows more fine-grained configuration. The
 * descriptor should follow the Frictionless Data Resource model
 * http://specs.frictionlessdata.io/data-resource/
 *
 * {
 *   file or url path
 *     path: 'https://example.com/data.csv',
 *     // a Table Schema - https://specs.frictionlessdata.io/table-schema/
 *     schema: {
 *      fields: [
 *            ...
 *           ]
 *      }
 *     // CSV dialect - https://specs.frictionlessdata.io/csv-dialect/
 *     dialect: {
 *     // this is tab separated CSV/DSV
 *     delimiter: '\t'
 *    }
 * }
 *
 * @param {object} options - { basePath, format } Use basepath in cases where you want to create
 *  a File with a path that is relative to a base directory / path e.g:
 *  const file = data.open('data.csv', {basePath: '/my/base/path'})
 */
export function open(pathOrDescriptor, { basePath, format } = {}) {
  let descriptor = null;

  if (isFileFromBrowser(pathOrDescriptor)) {
    return new FileInterface(pathOrDescriptor);
  }

  if (isPlainObject(pathOrDescriptor)) {
    descriptor = cloneDeep(pathOrDescriptor);
    // NB: data must come first - we could have data and path in which path
    // is not used (data comes from data)
    if (descriptor.data) {
      return new FileInline(descriptor, { basePath });
    } else if (descriptor.path) {
      // We want properties already in our descriptor to take priority over
      // those inferred from path so we assign in this order
      descriptor = Object.assign(
        parsePath(descriptor.path, basePath),
        descriptor
      );
    }
  } else if (isString(pathOrDescriptor)) {
    descriptor = parsePath(pathOrDescriptor, basePath, format);
  } else {
    throw new TypeError(`Cannot create File from ${pathOrDescriptor}`);
  }

  return new FileRemote(descriptor, { basePath });
}

/**
 * Parse a data source path into a descriptor object. The descriptor should follow the Frictionless Data Resource model
 * http://specs.frictionlessdata.io/data-resource/
 * @param {string} path_ - Data source. Can be a url or local file path
 * @param {string} basePath - Base path to data source
 * @param {string} format - format of the data.
 */
export const parsePath = (path_, basePath = null, format = null) => {
  let fileName;
  const isItUrl = isUrl(path_) || isUrl(basePath);
  if (isItUrl) {
    const urlParts = url.parse(path_);
    // eslint-disable-next-line no-useless-escape
    fileName = urlParts.pathname.replace(/^.*[\\\/]/, "");
    // Check if format=csv is provided in the query
    // But if format is provided explicitely by user then it'll be used
    if (!format && urlParts.query && urlParts.query.includes("format=csv")) {
      format = "csv";
    }
  } else {
    // eslint-disable-next-line no-useless-escape
    fileName = path_.replace(/^.*[\\\/]/, "");
  }

  const extension = extname(fileName);
  fileName = fileName
    .replace(extension, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9-._]+/g, "-");

  const descriptor = {
    path: path_,
    pathType: isItUrl ? "remote" : "local",
    name: fileName,
    format: format ? format : extension.slice(1).toLowerCase(),
  };

  const mediatype = mime.lookup(path_);

  if (mediatype) {
    descriptor.mediatype = mediatype;
  }

  return descriptor;
};

/**
 *
 * @param {string} path_ - Data source. Can be a url or local file path
 */
export const parseDatasetIdentifier = async (path_) => {
  const out = {
    name: "",
    owner: null,
    path: "",
    type: "",
    original: path_,
    version: "",
  };
  if (path_ === null || path_ === "") return out;

  out.type = isUrl(path_) ? "url" : "local";
  let normalizedPath = path_.replace(/\/?datapackage\.json/, "");
  normalizedPath = normalizedPath.replace(/\/$/, "");
  if (out.type === "local") {
    // eslint-disable-next-line no-undef
    if (process.platform === "win32") {
      out.path = path.resolve(normalizedPath);
    } else {
      out.path = path.posix.resolve(normalizedPath);
    }
    out.name = path.basename(out.path);
  } else if (out.type === "url") {
    const urlparts = url.parse(normalizedPath);
    const parts = urlparts.pathname.split("/");
    let name = parts[parts.length - 1];
    let owner = null;
    // is this a github repository?
    if (urlparts.host === "github.com") {
      out.type = "github";
      // yes, modify url for raw file server
      urlparts.host = "raw.githubusercontent.com";
      owner = parts[1];
      let repoName = parts[2];
      let branch = "master";

      // is the path a repository root?
      if (parts.length < 6) {
        // yes, use the repository name for the package name
        name = repoName;
      }

      // does the path contain subfolders (after the repository name)?
      if (parts.length == 3) {
        // no, add 'master' branch
        parts.push(branch);
      } else {
        // yes, extract the branch and remove the 'tree' part
        branch = parts[4];
        parts.splice(3, 1);
      }

      urlparts.pathname = parts.join("/");
      out.version = branch;
    } else if (urlparts.host === "datahub.io") {
      out.type = "datahub";
      urlparts.host = "pkgstore.datahub.io";
      owner = parts[1];
      name = parts[2];
      if (owner !== "core") {
        let resolvedPath = await fetch(
          `https://api.datahub.io/resolver/resolve?path=${owner}/${name}`
        );
        resolvedPath = await resolvedPath.json();
        parts[1] = resolvedPath.userid;
      }
      let res = await fetch(
        `https://api.datahub.io/source/${parts[1]}/${name}/successful`
      );
      if (res.status >= 400) {
        throw new Error(
          "Provided URL is invalid. Expected URL to a dataset or descriptor."
        );
      }
      res = await res.json();
      const revisionId = parseInt(res.id.split("/").pop(), 10);
      parts.push(revisionId);
      urlparts.pathname = parts.join("/");
      out.version = revisionId;
    }
    out.name = name;
    out.owner = owner;
    out.path = url.format(urlparts) + "/";
  }

  return out;
};

/**
 * Checks if path os a URL
 * @param {string} path_ - Data source. Can be a url or local file path
 */
export const isUrl = (path_) => {
  const r = new RegExp("^(?:[a-z]+:)?//", "i");
  return r.test(path_);
};

//Extname version for browsers, allow us to remove the path dependency
function extname(path) {
  if (typeof path !== "string") {
    throw new TypeError(
      `The "path" argument must be of type string. Received type ${typeof path}`
    );
  }

  let startDot = -1;
  let startPart = 0;
  let end = -1;
  let matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  let preDotState = 0;
  for (let i = path.length - 1; i >= 0; --i) {
    let code = path.charCodeAt(i);
    if (code === CHAR_FORWARD_SLASH) {
      // If we reached a path separator that was not part of a set of path
      // separators at the end of the string, stop now
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === CHAR_DOT) {
      // If this is our first dot, mark it as the start of our extension
      if (startDot === -1) {
        startDot = i;
      } else if (preDotState !== 1) {
        preDotState = 1;
      }
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (
    startDot === -1 ||
    end === -1 ||
    // We saw a non-dot character immediately before the dot
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly '..'
    (preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
  ) {
    return "";
  }
  return path.slice(startDot, end);
}
