"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
const cp = require("child_process");
const os = require("os");
const fs = require("fs");
const url = require("url");
const path = require("path");
const glob = require("glob");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const http = require("http");
const https = require("https");
function getPlatform() {
    const platform = os.platform();
    return platform === 'darwin' ? 1 /* OSX */ :
        platform === 'win32' ? 0 /* Windows */ :
            2 /* Linux */;
}
exports.getPlatform = getPlatform;
/**
 * Node's fs.existsSync is deprecated, implement it in terms of statSync
 */
function existsSync(path) {
    try {
        fs.statSync(path);
        return true;
    }
    catch (e) {
        // doesn't exist
        return false;
    }
}
exports.existsSync = existsSync;
/**
 * Checks asynchronously if a path exists on the disk.
 */
function existsAsync(path) {
    return new Promise((resolve, reject) => {
        try {
            fs.access(path, (err) => {
                resolve(err ? false : true);
            });
        }
        catch (e) {
            resolve(false);
        }
    });
}
exports.existsAsync = existsAsync;
/**
 * Returns a reversed version of arr. Doesn't modify the input.
 */
function reversedArr(arr) {
    return arr.reduce((reversed, x) => {
        reversed.unshift(x);
        return reversed;
    }, []);
}
exports.reversedArr = reversedArr;
function promiseTimeout(p, timeoutMs = 1000, timeoutMsg) {
    if (timeoutMsg === undefined) {
        timeoutMsg = `Promise timed out after ${timeoutMs}ms`;
    }
    return new Promise((resolve, reject) => {
        if (p) {
            p.then(resolve, reject);
        }
        setTimeout(() => {
            if (p) {
                reject(new Error(timeoutMsg));
            }
            else {
                resolve();
            }
        }, timeoutMs);
    });
}
exports.promiseTimeout = promiseTimeout;
function retryAsync(fn, timeoutMs, intervalDelay = 0) {
    const startTime = Date.now();
    function tryUntilTimeout() {
        return fn().catch(e => {
            if (Date.now() - startTime < (timeoutMs - intervalDelay)) {
                return promiseTimeout(null, intervalDelay).then(tryUntilTimeout);
            }
            else {
                return errP(e);
            }
        });
    }
    return tryUntilTimeout();
}
exports.retryAsync = retryAsync;
function random(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}
exports.random = random;
function stripBOM(s) {
    if (s && s[0] === '\uFEFF') {
        s = s.substr(1);
    }
    return s;
}
exports.stripBOM = stripBOM;
const semverRegex = /v?(\d+)\.(\d+)\.(\d+)/;
function compareSemver(a, b) {
    const aNum = versionStringToNumber(a);
    const bNum = versionStringToNumber(b);
    return aNum - bNum;
}
exports.compareSemver = compareSemver;
function versionStringToNumber(str) {
    const match = str.match(semverRegex);
    if (!match) {
        throw new Error('Invalid node version string: ' + str);
    }
    return parseInt(match[1], 10) * 10000 + parseInt(match[2], 10) * 100 + parseInt(match[3], 10);
}
const NODE_SHEBANG_MATCHER = new RegExp('#! */usr/bin/env +node');
function isJavaScript(aPath) {
    const name = path.basename(aPath).toLowerCase();
    if (name.endsWith('.js') || name.endsWith('.mjs')) {
        return true;
    }
    try {
        const buffer = new Buffer(30);
        const fd = fs.openSync(aPath, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, 0);
        fs.closeSync(fd);
        const line = buffer.toString();
        if (NODE_SHEBANG_MATCHER.test(line)) {
            return true;
        }
    }
    catch (e) {
        // silently ignore problems
    }
    return false;
}
exports.isJavaScript = isJavaScript;
function killTree(processId) {
    if (process.platform === 'win32') {
        const windir = process.env['WINDIR'] || 'C:\\Windows';
        const TASK_KILL = path.join(windir, 'System32', 'taskkill.exe');
        // when killing a process in Windows its child processes are *not* killed but become root processes.
        // Therefore we use TASKKILL.EXE
        try {
            cp.execSync(`${TASK_KILL} /F /T /PID ${processId}`);
        }
        catch (err) {
        }
    }
    else {
        // on linux and OS X we kill all direct and indirect child processes as well
        try {
            const cmd = path.join(__dirname, './terminateProcess.sh');
            cp.spawnSync(cmd, [processId.toString()]);
        }
        catch (err) {
        }
    }
}
exports.killTree = killTree;
/**
 * Modify a url/path either from the client or the target to a common format for comparing.
 * The client can handle urls in this format too.
 * file:///D:\\scripts\\code.js => d:/scripts/code.js
 * file:///Users/me/project/code.js => /Users/me/project/code.js
 * c:/scripts/code.js => c:\\scripts\\code.js
 * http://site.com/scripts/code.js => (no change)
 * http://site.com/ => http://site.com
 */
function canonicalizeUrl(urlOrPath) {
    urlOrPath = fileUrlToPath(urlOrPath);
    // Remove query params
    if (urlOrPath.indexOf('?') >= 0) {
        urlOrPath = urlOrPath.split('?')[0];
    }
    urlOrPath = stripTrailingSlash(urlOrPath);
    urlOrPath = fixDriveLetterAndSlashes(urlOrPath);
    return urlOrPath;
}
exports.canonicalizeUrl = canonicalizeUrl;
function isFileUrl(candidate) {
    return candidate.startsWith('file:///');
}
exports.isFileUrl = isFileUrl;
/**
 * If urlOrPath is a file URL, removes the 'file:///', adjusting for platform differences
 */
function fileUrlToPath(urlOrPath) {
    if (isFileUrl(urlOrPath)) {
        urlOrPath = urlOrPath.replace('file:///', '');
        urlOrPath = decodeURIComponent(urlOrPath);
        if (urlOrPath[0] !== '/' && !urlOrPath.match(/^[A-Za-z]:/)) {
            // If it has a : before the first /, assume it's a windows path or url.
            // Ensure unix-style path starts with /, it can be removed when file:/// was stripped.
            // Don't add if the url still has a protocol
            urlOrPath = '/' + urlOrPath;
        }
        urlOrPath = fixDriveLetterAndSlashes(urlOrPath);
    }
    return urlOrPath;
}
exports.fileUrlToPath = fileUrlToPath;
/**
 * Replace any backslashes with forward slashes
 * blah\something => blah/something
 */
function forceForwardSlashes(aUrl) {
    return aUrl
        .replace(/\\\//g, '/') // Replace \/ (unnecessarily escaped forward slash)
        .replace(/\\/g, '/');
}
exports.forceForwardSlashes = forceForwardSlashes;
/**
 * Ensure lower case drive letter and \ on Windows
 */
function fixDriveLetterAndSlashes(aPath, uppercaseDriveLetter = false) {
    if (!aPath)
        return aPath;
    aPath = fixDriveLetter(aPath, uppercaseDriveLetter);
    if (aPath.match(/file:\/\/\/[A-Za-z]:/)) {
        const prefixLen = 'file:///'.length;
        aPath =
            aPath.substr(0, prefixLen + 1) +
                aPath.substr(prefixLen + 1).replace(/\//g, '\\');
    }
    else if (aPath.match(/^[A-Za-z]:/)) {
        aPath = aPath.replace(/\//g, '\\');
    }
    return aPath;
}
exports.fixDriveLetterAndSlashes = fixDriveLetterAndSlashes;
function fixDriveLetter(aPath, uppercaseDriveLetter = false) {
    if (!aPath)
        return aPath;
    if (aPath.match(/file:\/\/\/[A-Za-z]:/)) {
        const prefixLen = 'file:///'.length;
        aPath =
            'file:///' +
                aPath[prefixLen].toLowerCase() +
                aPath.substr(prefixLen + 1);
    }
    else if (aPath.match(/^[A-Za-z]:/)) {
        // If the path starts with a drive letter, ensure lowercase. VS Code uses a lowercase drive letter
        const driveLetter = uppercaseDriveLetter ? aPath[0].toUpperCase() : aPath[0].toLowerCase();
        aPath = driveLetter + aPath.substr(1);
    }
    return aPath;
}
exports.fixDriveLetter = fixDriveLetter;
/**
 * Remove a slash of any flavor from the end of the path
 */
function stripTrailingSlash(aPath) {
    return aPath
        .replace(/\/$/, '')
        .replace(/\\$/, '');
}
exports.stripTrailingSlash = stripTrailingSlash;
/**
 * A helper for returning a rejected promise with an Error object. Avoids double-wrapping an Error, which could happen
 * when passing on a failure from a Promise error handler.
 * @param msg - Should be either a string or an Error
 */
function errP(msg) {
    const isErrorLike = (thing) => !!thing.message;
    let e;
    if (!msg) {
        e = new Error('Unknown error');
    }
    else if (isErrorLike(msg)) {
        // msg is already an Error object
        e = msg;
    }
    else {
        e = new Error(msg);
    }
    return Promise.reject(e);
}
exports.errP = errP;
/**
 * Helper function to GET the contents of a url
 */
function getURL(aUrl, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(aUrl);
        const get = parsedUrl.protocol === 'https:' ? https.get : http.get;
        options = Object.assign({ rejectUnauthorized: false }, parsedUrl, options);
        get(options, response => {
            let responseData = '';
            response.on('data', chunk => responseData += chunk);
            response.on('end', () => {
                // Sometimes the 'error' event is not fired. Double check here.
                if (response.statusCode === 200) {
                    resolve(responseData);
                }
                else {
                    vscode_debugadapter_1.logger.log('HTTP GET failed with: ' + response.statusCode.toString() + ' ' + response.statusMessage.toString());
                    reject(new Error(responseData.trim()));
                }
            });
        }).on('error', e => {
            vscode_debugadapter_1.logger.log('HTTP GET failed: ' + e.toString());
            reject(e);
        });
    });
}
exports.getURL = getURL;
/**
 * Returns true if urlOrPath is like "http://localhost" and not like "c:/code/file.js" or "/code/file.js"
 */
function isURL(urlOrPath) {
    return urlOrPath && !path.isAbsolute(urlOrPath) && !!url.parse(urlOrPath).protocol;
}
exports.isURL = isURL;
/**
 * Strip a string from the left side of a string
 */
function lstrip(s, lStr) {
    return s.startsWith(lStr) ?
        s.substr(lStr.length) :
        s;
}
exports.lstrip = lstrip;
/**
 * Convert a local path to a file URL, like
 * C:/code/app.js => file:///C:/code/app.js
 * /code/app.js => file:///code/app.js
 */
function pathToFileURL(absPath, normalize) {
    absPath = forceForwardSlashes(absPath);
    if (normalize) {
        absPath = path.normalize(absPath);
        absPath = forceForwardSlashes(absPath);
    }
    absPath = (absPath.startsWith('/') ? 'file://' : 'file:///') +
        absPath;
    return encodeURI(absPath);
}
exports.pathToFileURL = pathToFileURL;
function fsReadDirP(path) {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(files);
            }
        });
    });
}
exports.fsReadDirP = fsReadDirP;
function readFileP(path, encoding = 'utf8') {
    return new Promise((resolve, reject) => {
        fs.readFile(path, encoding, (err, fileContents) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(fileContents);
            }
        });
    });
}
exports.readFileP = readFileP;
function writeFileP(filePath, data) {
    return new Promise((resolve, reject) => {
        mkdirs(path.dirname(filePath));
        fs.writeFile(filePath, data, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.writeFileP = writeFileP;
/**
 * Make sure that all directories of the given path exist (like mkdir -p).
 */
function mkdirs(dirsPath) {
    if (!fs.existsSync(dirsPath)) {
        mkdirs(path.dirname(dirsPath));
        fs.mkdirSync(dirsPath);
    }
}
exports.mkdirs = mkdirs;
// ---- globbing support -------------------------------------------------
function extendObject(objectCopy, object) {
    for (let key in object) {
        if (object.hasOwnProperty(key)) {
            objectCopy[key] = object[key];
        }
    }
    return objectCopy;
}
exports.extendObject = extendObject;
function isExclude(pattern) {
    return pattern[0] === '!';
}
function multiGlob(patterns, opts) {
    const globTasks = [];
    opts = extendObject({
        cache: Object.create(null),
        statCache: Object.create(null),
        realpathCache: Object.create(null),
        symlinks: Object.create(null),
        ignore: []
    }, opts);
    try {
        patterns.forEach((pattern, i) => {
            if (isExclude(pattern)) {
                return;
            }
            const ignore = patterns.slice(i).filter(isExclude).map(excludePattern => {
                return excludePattern.slice(1);
            });
            globTasks.push({
                pattern,
                opts: extendObject(extendObject({}, opts), {
                    ignore: opts.ignore.concat(ignore)
                })
            });
        });
    }
    catch (err) {
        return Promise.reject(err);
    }
    return Promise.all(globTasks.map(task => {
        return new Promise((c, e) => {
            glob(task.pattern, task.opts, (err, files) => {
                if (err) {
                    e(err);
                }
                else {
                    c(files);
                }
            });
        });
    })).then(results => {
        const set = new Set();
        for (let paths of results) {
            for (let p of paths) {
                set.add(p);
            }
        }
        let array = [];
        set.forEach(v => array.push(fixDriveLetterAndSlashes(v)));
        return array;
    });
}
exports.multiGlob = multiGlob;
/**
 * A reversable subclass of the Handles helper
 */
class ReverseHandles extends vscode_debugadapter_1.Handles {
    constructor() {
        super(...arguments);
        this._reverseMap = new Map();
    }
    create(value) {
        const handle = super.create(value);
        this._reverseMap.set(value, handle);
        return handle;
    }
    lookup(value) {
        return this._reverseMap.get(value);
    }
    lookupF(idFn) {
        for (let key of this._reverseMap.keys()) {
            if (idFn(key))
                return this._reverseMap.get(key);
        }
        return undefined;
    }
    set(handle, value) {
        this._handleMap.set(handle, value);
        this._reverseMap.set(value, handle);
    }
}
exports.ReverseHandles = ReverseHandles;
/**
 * Return a regex for the given path to set a breakpoint on
 */
function pathToRegex(aPath, caseSensitive) {
    const fileUrlPrefix = 'file:///';
    let isFileUrl = aPath.startsWith(fileUrlPrefix);
    if (isFileUrl) {
        // Purposely avoiding fileUrlToPath/pathToFileUrl for this, because it does decodeURI/encodeURI
        // for special URL chars and I don't want to think about that interacting with special regex chars
        aPath = aPath.substr(fileUrlPrefix.length);
    }
    aPath = escapeRegexSpecialChars(aPath);
    // If we should resolve paths in a case-sensitive way, we still need to set the BP for either an
    // upper or lowercased drive letter
    if (caseSensitive) {
        if (aPath.match(/^[a-zA-Z]:/)) {
            const driveLetter = aPath.charAt(0);
            const u = driveLetter.toUpperCase();
            const l = driveLetter.toLowerCase();
            aPath = `[${u}${l}]${aPath.substr(1)}`;
        }
    }
    else {
        aPath = aPath.replace(/[a-zA-Z]/g, letter => `[${letter.toLowerCase()}${letter.toUpperCase()}]`);
    }
    if (isFileUrl) {
        aPath = escapeRegexSpecialChars(fileUrlPrefix) + aPath;
    }
    return aPath;
}
exports.pathToRegex = pathToRegex;
function pathGlobToBlackboxedRegex(glob) {
    return escapeRegexSpecialChars(glob, '*')
        .replace(/([^*]|^)\*([^*]|$)/g, '$1.*$2') // * -> .*
        .replace(/\*\*(\\\/|\\\\)?/g, '(.*\\\/)?') // **/ -> (.*\/)?
        // Just to simplify
        .replace(/\.\*\\\/\.\*/g, '.*') // .*\/.* -> .*
        .replace(/\.\*\.\*/g, '.*') // .*.* -> .*
        // Match either slash direction
        .replace(/\\\/|\\\\/g, '[\/\\\\]'); // / -> [/|\], \ -> [/|\]
}
exports.pathGlobToBlackboxedRegex = pathGlobToBlackboxedRegex;
const regexChars = '/\\.?*()^${}|[]+';
function escapeRegexSpecialChars(str, except) {
    const useRegexChars = regexChars
        .split('')
        .filter(c => !except || except.indexOf(c) < 0)
        .join('')
        .replace(/[\\\]]/g, '\\$&');
    const r = new RegExp(`[${useRegexChars}]`, 'g');
    return str.replace(r, '\\$&');
}
exports.escapeRegexSpecialChars = escapeRegexSpecialChars;
function trimLastNewline(str) {
    return str.replace(/(\n|\r\n)$/, '');
}
exports.trimLastNewline = trimLastNewline;
function prettifyNewlines(str) {
    return str.replace(/(\n|\r\n)/, '\\n');
}
exports.prettifyNewlines = prettifyNewlines;
function blackboxNegativeLookaheadPattern(aPath) {
    return `(?!${escapeRegexSpecialChars(aPath)})`;
}
function makeRegexNotMatchPath(regex, aPath) {
    if (regex.test(aPath)) {
        const regSourceWithoutCaret = regex.source.replace(/^\^/, '');
        const source = `^${blackboxNegativeLookaheadPattern(aPath)}.*${regSourceWithoutCaret}`;
        return new RegExp(source, 'i');
    }
    else {
        return regex;
    }
}
exports.makeRegexNotMatchPath = makeRegexNotMatchPath;
function makeRegexMatchPath(regex, aPath) {
    const negativePattern = blackboxNegativeLookaheadPattern(aPath);
    if (regex.source.indexOf(negativePattern) >= 0) {
        const newSource = regex.source.replace(negativePattern, '');
        return new RegExp(newSource, 'i');
    }
    else {
        return regex;
    }
}
exports.makeRegexMatchPath = makeRegexMatchPath;
function uppercaseFirstLetter(str) {
    return str.substr(0, 1).toUpperCase() + str.substr(1);
}
exports.uppercaseFirstLetter = uppercaseFirstLetter;
function getLine(msg, n = 0) {
    return msg.split('\n')[n];
}
exports.getLine = getLine;
function firstLine(msg) {
    return getLine(msg || '');
}
exports.firstLine = firstLine;
function isNumber(num) {
    return typeof num === 'number';
}
exports.isNumber = isNumber;
function toVoidP(p) {
    return p.then(() => { });
}
exports.toVoidP = toVoidP;
function promiseDefer() {
    let resolveCallback;
    let rejectCallback;
    const promise = new Promise((resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;
    });
    return { promise, resolve: resolveCallback, reject: rejectCallback };
}
exports.promiseDefer = promiseDefer;
function calculateElapsedTime(startProcessingTime) {
    const NanoSecondsPerMillisecond = 1000000;
    const NanoSecondsPerSecond = 1e9;
    const ellapsedTime = process.hrtime(startProcessingTime);
    const ellapsedMilliseconds = (ellapsedTime[0] * NanoSecondsPerSecond + ellapsedTime[1]) / NanoSecondsPerMillisecond;
    return ellapsedMilliseconds;
}
exports.calculateElapsedTime = calculateElapsedTime;
// Pattern: The pattern recognizes file paths and captures the file name and the colon at the end.
// Next line is a sample path aligned with the regexp parts that recognize it/match it. () is for the capture group
//                                C  :     \  foo      \  (in.js:)
//                                C  :     \  foo\ble  \  (fi.ts:)
const extractFileNamePattern = /[A-z]:(?:[\\/][^:]*)+[\\/]([^:]*:)/g;
function fillErrorDetails(properties, e) {
    properties.exceptionMessage = e.message || e.toString();
    if (e.name) {
        properties.exceptionName = e.name;
    }
    if (typeof e.stack === 'string') {
        let unsanitizedStack = e.stack;
        try {
            // We remove the file path, we just leave the file names
            unsanitizedStack = unsanitizedStack.replace(extractFileNamePattern, '$1');
        }
        catch (exception) {
            // Ignore error while sanitizing the call stack
        }
        properties.exceptionStack = unsanitizedStack;
    }
    if (e.id) {
        properties.exceptionId = e.id.toString();
    }
}
exports.fillErrorDetails = fillErrorDetails;
//# sourceMappingURL=utils.js.map