"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const os = require("os");
const url = require("url");
const sourceMapUtils = require("./sourceMapUtils");
const utils = require("../utils");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const sourceMap_1 = require("./sourceMap");
class SourceMapFactory {
    constructor(_pathMapping, _sourceMapPathOverrides, _enableSourceMapCaching) {
        this._pathMapping = _pathMapping;
        this._sourceMapPathOverrides = _sourceMapPathOverrides;
        this._enableSourceMapCaching = _enableSourceMapCaching;
    }
    /**
     * pathToGenerated - an absolute local path or a URL.
     * mapPath - a path relative to pathToGenerated.
     */
    getMapForGeneratedPath(pathToGenerated, mapPath) {
        let msg = `SourceMaps.getMapForGeneratedPath: Finding SourceMap for ${pathToGenerated} by URI: ${mapPath}`;
        if (this._pathMapping) {
            msg += ` and webRoot/pathMapping: ${JSON.stringify(this._pathMapping)}`;
        }
        vscode_debugadapter_1.logger.log(msg);
        // For an inlined sourcemap, mapPath is a data URI containing a blob of base64 encoded data, starting
        // with a tag like "data:application/json;charset:utf-8;base64,". The data should start after the last comma.
        let sourceMapContentsP;
        if (mapPath.indexOf('data:application/json') >= 0) {
            // Sourcemap is inlined
            vscode_debugadapter_1.logger.log(`SourceMaps.getMapForGeneratedPath: Using inlined sourcemap in ${pathToGenerated}`);
            sourceMapContentsP = Promise.resolve(this.getInlineSourceMapContents(mapPath));
        }
        else {
            sourceMapContentsP = this.getSourceMapContent(pathToGenerated, mapPath);
        }
        return sourceMapContentsP.then(contents => {
            if (contents) {
                try {
                    // Throws for invalid JSON
                    return new sourceMap_1.SourceMap(pathToGenerated, contents, this._pathMapping, this._sourceMapPathOverrides);
                }
                catch (e) {
                    vscode_debugadapter_1.logger.error(`SourceMaps.getMapForGeneratedPath: exception while processing path: ${pathToGenerated}, sourcemap: ${mapPath}\n${e.stack}`);
                    return null;
                }
            }
            else {
                return null;
            }
        });
    }
    /**
     * Parses sourcemap contents from inlined base64-encoded data
     */
    getInlineSourceMapContents(sourceMapData) {
        const lastCommaPos = sourceMapData.lastIndexOf(',');
        if (lastCommaPos < 0) {
            vscode_debugadapter_1.logger.log(`SourceMaps.getInlineSourceMapContents: Inline sourcemap is malformed. Starts with: ${sourceMapData.substr(0, 200)}`);
            return null;
        }
        const data = sourceMapData.substr(lastCommaPos + 1);
        try {
            const buffer = new Buffer(data, 'base64');
            return buffer.toString();
        }
        catch (e) {
            vscode_debugadapter_1.logger.error(`SourceMaps.getInlineSourceMapContents: exception while processing data uri (${e.stack})`);
        }
        return null;
    }
    /**
     * Resolves a sourcemap's path and loads the data
     */
    getSourceMapContent(pathToGenerated, mapPath) {
        mapPath = sourceMapUtils.resolveMapPath(pathToGenerated, mapPath, this._pathMapping);
        if (!mapPath) {
            return Promise.resolve(null);
        }
        return this.loadSourceMapContents(mapPath).then(contents => {
            if (!contents) {
                // Last ditch effort - just look for a .js.map next to the script
                const mapPathNextToSource = pathToGenerated + '.map';
                if (mapPathNextToSource !== mapPath) {
                    return this.loadSourceMapContents(mapPathNextToSource);
                }
            }
            return contents;
        });
    }
    loadSourceMapContents(mapPathOrURL) {
        let contentsP;
        if (utils.isURL(mapPathOrURL) && !utils.isFileUrl(mapPathOrURL)) {
            contentsP = this.downloadSourceMapContents(mapPathOrURL).catch(e => {
                vscode_debugadapter_1.logger.log(`SourceMaps.loadSourceMapContents: Could not download sourcemap`);
                return null;
            });
        }
        else {
            mapPathOrURL = utils.canonicalizeUrl(mapPathOrURL);
            contentsP = new Promise((resolve, reject) => {
                vscode_debugadapter_1.logger.log(`SourceMaps.loadSourceMapContents: Reading local sourcemap file from ${mapPathOrURL}`);
                fs.readFile(mapPathOrURL, (err, data) => {
                    if (err) {
                        vscode_debugadapter_1.logger.log(`SourceMaps.loadSourceMapContents: Could not read sourcemap file - ` + err.message);
                        resolve(null);
                    }
                    else {
                        resolve(data && data.toString());
                    }
                });
            });
        }
        return contentsP;
    }
    downloadSourceMapContents(sourceMapUri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (url.parse(sourceMapUri).hostname === 'localhost') {
                sourceMapUri = sourceMapUri.replace('localhost', '127.0.0.1');
            }
            vscode_debugadapter_1.logger.log(`SourceMaps.loadSourceMapContents: Downloading sourcemap file from ${sourceMapUri}`);
            // use sha256 to ensure the hash value can be used in filenames
            let cachedSourcemapPath;
            if (this._enableSourceMapCaching) {
                const hash = crypto.createHash('sha256').update(sourceMapUri).digest('hex');
                const cachePath = path.join(os.tmpdir(), 'com.microsoft.VSCode', 'node-debug2', 'sm-cache');
                cachedSourcemapPath = path.join(cachePath, hash);
                const exists = utils.existsSync(cachedSourcemapPath);
                if (exists) {
                    vscode_debugadapter_1.logger.log(`Sourcemaps.downloadSourceMapContents: Reading cached sourcemap file from ${cachedSourcemapPath}`);
                    return this.loadSourceMapContents(cachedSourcemapPath);
                }
            }
            const responseText = yield utils.getURL(sourceMapUri);
            if (cachedSourcemapPath) {
                vscode_debugadapter_1.logger.log(`Sourcemaps.downloadSourceMapContents: Caching sourcemap file at ${cachedSourcemapPath}`);
                yield utils.writeFileP(cachedSourcemapPath, responseText);
            }
            return responseText;
        });
    }
}
exports.SourceMapFactory = SourceMapFactory;
//# sourceMappingURL=sourceMapFactory.js.map