"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils = require("../src/utils");
const typemoq_1 = require("typemoq");
const path = require("path");
const mockery = require("mockery");
const fs = require("fs");
const assert = require("assert");
function setupUnhandledRejectionListener() {
    process.addListener('unhandledRejection', unhandledRejectionListener);
}
exports.setupUnhandledRejectionListener = setupUnhandledRejectionListener;
function removeUnhandledRejectionListener() {
    process.removeListener('unhandledRejection', unhandledRejectionListener);
}
exports.removeUnhandledRejectionListener = removeUnhandledRejectionListener;
function unhandledRejectionListener(reason, p) {
    console.log('*');
    console.log('**');
    console.log('***');
    console.log('****');
    console.log('*****');
    console.log(`ERROR!! Unhandled promise rejection, a previous test may have failed but reported success.`);
    console.log(reason.toString());
    console.log('*****');
    console.log('****');
    console.log('***');
    console.log('**');
    console.log('*');
}
class MockEvent {
    constructor(event, body) {
        this.event = event;
        this.body = body;
        this.seq = 0;
        this.type = 'event';
    }
}
exports.MockEvent = MockEvent;
function getStackTraceResponseBody(aPath, locations, sourceReferences = [], isSourceMapped) {
    return {
        stackFrames: locations.map((location, i) => {
            const frame = {
                id: i,
                name: 'line ' + i,
                line: location.line,
                column: location.column,
                source: {
                    path: aPath,
                    name: path.basename(aPath),
                    sourceReference: sourceReferences[i] || undefined,
                    origin: undefined
                }
            };
            if (typeof isSourceMapped === 'boolean') {
                frame.isSourceMapped = isSourceMapped;
            }
            return frame;
        })
    };
}
exports.getStackTraceResponseBody = getStackTraceResponseBody;
/**
 * Some tests use this to override 'os' and 'path' with the windows versions for consistency when running on different
 * platforms. For other tests, it either doesn't matter, or they have platform-specific test code.
 */
function registerWin32Mocks() {
    mockery.registerMock('os', { platform: () => 'win32' });
    mockery.registerMock('path', path.win32);
}
exports.registerWin32Mocks = registerWin32Mocks;
function registerOSXMocks() {
    mockery.registerMock('os', { platform: () => 'darwin' });
    mockery.registerMock('path', path.posix);
}
exports.registerOSXMocks = registerOSXMocks;
function registerLocMocks() {
    mockery.registerMock('vscode-nls', {
        config: () => () => dummyLocalize,
        loadMessageBundle: () => dummyLocalize
    });
}
exports.registerLocMocks = registerLocMocks;
function dummyLocalize(id, englishString) {
    return englishString;
}
/**
 * path.resolve + fixing the drive letter to match what VS Code does. Basically tests can use this when they
 * want to force a path to native slashes and the correct letter case, but maybe can't use un-mocked utils.
 */
function pathResolve(...segments) {
    let aPath = path.resolve.apply(null, segments);
    if (aPath.match(/^[A-Za-z]:/)) {
        aPath = aPath[0].toLowerCase() + aPath.substr(1);
    }
    return aPath;
}
exports.pathResolve = pathResolve;
function registerMockReadFile(...entries) {
    const fsMock = typemoq_1.Mock.ofInstance(fs, typemoq_1.MockBehavior.Strict);
    mockery.registerMock('fs', fsMock.object);
    entries.forEach(entry => {
        fsMock
            .setup(x => x.readFile(typemoq_1.It.isValue(entry.absPath), typemoq_1.It.isAny()))
            .callback((path, callback) => callback(null, entry.data));
    });
}
exports.registerMockReadFile = registerMockReadFile;
/**
 * Mock utils.getURL to return the specified contents.
 * Note that if you call this twice, the second call will overwrite the first.
 */
function registerMockGetURL(utilsRelativePath, url, contents, utilsMock, isError = false) {
    if (!utilsMock) {
        utilsMock = typemoq_1.Mock.ofInstance(utils);
        utilsMock.callBase = true;
        mockery.registerMock(utilsRelativePath, utilsMock.object);
    }
    // Need to register with and without options
    utilsMock
        .setup(x => x.getURL(typemoq_1.It.isValue(url), typemoq_1.It.isAny()))
        .returns(() => isError ? Promise.reject(contents) : Promise.resolve(contents));
    utilsMock
        .setup(x => x.getURL(typemoq_1.It.isValue(url)))
        .returns(() => isError ? Promise.reject(contents) : Promise.resolve(contents));
    utilsMock
        .setup(x => x.isURL(typemoq_1.It.isValue(url)))
        .returns(() => true);
}
exports.registerMockGetURL = registerMockGetURL;
function registerMockGetURLFail(utilsRelativePath, url, failContents, utilsMock) {
    return registerMockGetURL(utilsRelativePath, url, failContents, utilsMock, /*isError=*/ true);
}
exports.registerMockGetURLFail = registerMockGetURLFail;
/**
 * Returns a promise that is resolved if the given promise is rejected, and is rejected if the given
 * promise is resolved
 */
function assertPromiseRejected(promise) {
    return promise.then(result => { throw new Error('Promise was expected to be rejected, but was resolved with ' + result); }, () => { });
}
exports.assertPromiseRejected = assertPromiseRejected;
function assertFail(msg) {
    assert(false, msg);
}
exports.assertFail = assertFail;
//# sourceMappingURL=testUtils.js.map