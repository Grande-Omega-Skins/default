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
const vscode_debugadapter_1 = require("vscode-debugadapter");
const transformerMocks_1 = require("../mocks/transformerMocks");
const debugProtocolMocks_1 = require("../mocks/debugProtocolMocks");
const chromeConnection_1 = require("../../src/chrome/chromeConnection");
const mockery = require("mockery");
const assert = require("assert");
const typemoq_1 = require("typemoq");
const testUtils = require("../testUtils");
const utils = require("../../src/utils");
const fs = require("fs");
const debugSession_1 = require("vscode-debugadapter/lib/debugSession");
const MODULE_UNDER_TEST = '../../src/chrome/chromeDebugAdapter';
suite('ChromeDebugAdapter', () => {
    const ATTACH_SUCCESS_PORT = 9222;
    const ATTACH_FAIL_PORT = 2992;
    const ATTACH_ARGS = { port: ATTACH_SUCCESS_PORT };
    const THREAD_ID = 1;
    let mockChromeConnection;
    let mockEventEmitter;
    let mockLineNumberTransformer;
    let mockSourceMapTransformer;
    let mockPathTransformer;
    let mockChrome;
    let chromeDebugAdapter;
    let sendEventHandler;
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });
        testUtils.registerWin32Mocks();
        testUtils.registerLocMocks();
        // Create a ChromeConnection mock with .on and .attach. Tests can fire events via mockEventEmitter
        mockChromeConnection = typemoq_1.Mock.ofType(chromeConnection_1.ChromeConnection, typemoq_1.MockBehavior.Strict);
        mockChromeConnection
            .setup(x => x.attach(typemoq_1.It.isValue(undefined), typemoq_1.It.isValue(ATTACH_SUCCESS_PORT), typemoq_1.It.isValue(undefined), typemoq_1.It.isValue(undefined), typemoq_1.It.isValue(undefined)))
            .returns(() => Promise.resolve())
            .verifiable(typemoq_1.Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.isAttached)
            .returns(() => false)
            .verifiable(typemoq_1.Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.onClose(typemoq_1.It.isAny()))
            .verifiable(typemoq_1.Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.events)
            .returns(() => null)
            .verifiable(typemoq_1.Times.atLeast(0));
        mockChrome = debugProtocolMocks_1.getMockChromeConnectionApi();
        mockEventEmitter = mockChrome.mockEventEmitter;
        mockChromeConnection
            .setup(x => x.api)
            .returns(() => mockChrome.apiObjects)
            .verifiable(typemoq_1.Times.atLeast(0));
        mockChromeConnection
            .setup(x => x.run())
            .returns(() => Promise.resolve())
            .verifiable(typemoq_1.Times.atLeast(0));
        mockLineNumberTransformer = transformerMocks_1.getMockLineNumberTransformer();
        mockSourceMapTransformer = transformerMocks_1.getMockSourceMapTransformer();
        mockPathTransformer = transformerMocks_1.getMockPathTransformer();
        initChromeDebugAdapter();
    });
    function initChromeDebugAdapter() {
        // Instantiate the ChromeDebugAdapter, injecting the mock ChromeConnection
        /* tslint:disable */
        chromeDebugAdapter = new (require(MODULE_UNDER_TEST).ChromeDebugAdapter)({
            chromeConnection: function () { return mockChromeConnection.object; },
            lineColTransformer: function () { return mockLineNumberTransformer.object; },
            sourceMapTransformer: function () { return mockSourceMapTransformer.object; },
            pathTransformer: function () { return mockPathTransformer.object; }
        }, {
            sendEvent: (e) => {
                if (sendEventHandler) {
                    // Filter telemetry events
                    if (!(e.event === 'output' && e.body.category === 'telemetry')) {
                        sendEventHandler(e);
                    }
                }
            }
        });
        /* tslint:enable */
    }
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        sendEventHandler = undefined;
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
        // To avoid warnings about leaking event listeners
        yield vscode_debugadapter_1.logger.dispose();
        mockChromeConnection.verifyAll();
        mockChrome.Debugger.verifyAll();
    }));
    function emitScriptParsed(url, scriptId, sources = []) {
        mockPathTransformer.setup(m => m.scriptParsed(typemoq_1.It.isValue(url)))
            .returns(() => Promise.resolve(url));
        mockSourceMapTransformer.setup(m => m.scriptParsed(typemoq_1.It.isAny(), typemoq_1.It.isValue(undefined)))
            .returns(() => Promise.resolve(sources));
        mockSourceMapTransformer.setup(m => m.getGeneratedPathFromAuthoredPath(typemoq_1.It.isAnyString()))
            .returns(authoredPath => {
            const returnedUrl = url || `VM${scriptId}`;
            return (!sources.length || sources.indexOf(authoredPath) >= 0) ?
                Promise.resolve(returnedUrl) :
                Promise.resolve('');
        });
        mockEventEmitter.emit('Debugger.scriptParsed', { scriptId, url });
    }
    // Helper to run async asserts inside promises so they can be correctly awaited
    function asyncAssert(assertFn, resolve, reject) {
        try {
            assertFn();
            resolve();
        }
        catch (e) {
            reject(e);
        }
    }
    suite('attach()', () => {
        test('Initialized event is fired after first scriptParsed event', done => {
            let firstEventReceived = false;
            sendEventHandler = (event) => {
                if (!firstEventReceived && event.event === 'initialized') {
                    firstEventReceived = true;
                    done();
                }
                else if (event.event !== 'script' && event.event !== 'loadedSource') {
                    done(new Error('An unexpected event was fired: ' + event.event));
                }
            };
            chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                emitScriptParsed('http://localhost', '4');
            });
        });
        test('if unsuccessful, the promise is rejected and an initialized event is not fired', (done) => {
            sendEventHandler = (event) => {
                done(new Error('Not expecting any event in this scenario: ' + event.event));
            };
            mockChromeConnection
                .setup(x => x.attach(typemoq_1.It.isValue(undefined), typemoq_1.It.isValue(ATTACH_FAIL_PORT), typemoq_1.It.isValue(undefined), typemoq_1.It.isValue(undefined), typemoq_1.It.isValue(undefined)))
                .returns(() => utils.errP('Testing attach failed'));
            chromeDebugAdapter.attach({ port: ATTACH_FAIL_PORT }).then(() => done(new Error('Expecting promise to be rejected')), e => { done(); /* Expecting promise to be rejected */ });
        });
    });
    suite('setBreakpoints()', () => {
        const BP_ID = 'bpId';
        const FILE_NAME = 'file:///a.js';
        const SCRIPT_ID = '1';
        function expectSetBreakpoint(breakpoints, url, scriptId = SCRIPT_ID, success = true) {
            breakpoints.forEach((bp, i) => {
                const { line: lineNumber, column: columnNumber, condition } = bp;
                const location = { scriptId, lineNumber, columnNumber };
                if (url) {
                    const urlRegex = utils.pathToRegex(url, true);
                    mockChrome.Debugger
                        .setup(x => x.setBreakpointByUrl(typemoq_1.It.isValue({ urlRegex, lineNumber, columnNumber, condition })))
                        .returns(() => Promise.resolve({
                        breakpointId: BP_ID + i,
                        locations: success ? [location] : []
                    }))
                        .verifiable(typemoq_1.Times.atLeastOnce());
                }
                else {
                    mockChrome.Debugger
                        .setup(x => x.setBreakpoint(typemoq_1.It.isValue({ location: { lineNumber, columnNumber, scriptId }, condition })))
                        .returns(() => Promise.resolve({
                        breakpointId: BP_ID + i,
                        actualLocation: success ? location : null
                    }))
                        .verifiable(typemoq_1.Times.atLeastOnce());
                }
            });
        }
        function expectRemoveBreakpoint(indicies) {
            indicies.forEach(i => {
                mockChrome.Debugger
                    .setup(x => x.removeBreakpoint(typemoq_1.It.isValue({ breakpointId: BP_ID + i })))
                    .returns(() => Promise.resolve())
                    .verifiable(typemoq_1.Times.atLeastOnce());
            });
        }
        function makeExpectedResponse(breakpoints, verified = true) {
            const resultBps = breakpoints.map((bp, i) => {
                return verified ?
                    {
                        line: bp.line,
                        column: bp.column || 0,
                        verified
                    } :
                    {
                        verified
                    };
            });
            return { breakpoints: resultBps };
        }
        function assertExpectedResponse(response, breakpoints, verified = true) {
            // Assert that each bp has some id, then remove, because we don't know or care what it is
            response = JSON.parse(JSON.stringify(response));
            response.breakpoints.forEach(bp => {
                assert(typeof bp.id === 'number');
                delete bp.id;
                // Remove a message, we'll check errors based on 'verified'
                delete bp.message;
                if (!verified) {
                    // Column and line are sometimes not set on unverified breakpoints, we don't care here
                    delete bp.column;
                    delete bp.line;
                }
            });
            assert.deepEqual(response, makeExpectedResponse(breakpoints, verified));
        }
        function setBp_emitScriptParsed(url = FILE_NAME, scriptId = SCRIPT_ID, sources = []) {
            emitScriptParsed(url, scriptId, sources);
        }
        test('When setting one breakpoint, returns the correct result', () => {
            const breakpoints = [
                { line: 5, column: 6 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);
            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => setBp_emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0))
                .then(response => assertExpectedResponse(response, breakpoints));
        });
        test('When setting multiple breakpoints, returns the correct result', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 },
                { line: 151, column: 1 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);
            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => setBp_emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0))
                .then(response => assertExpectedResponse(response, breakpoints));
        });
        test('The adapter clears all previous breakpoints in a script before setting the new ones', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);
            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => setBp_emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0))
                .then(response => {
                breakpoints.push({ line: 321, column: 123 });
                expectRemoveBreakpoint([0, 1]);
                expectSetBreakpoint(breakpoints, FILE_NAME);
                return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0);
            })
                .then(response => assertExpectedResponse(response, breakpoints));
        });
        test('The adapter handles removing a breakpoint', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);
            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => setBp_emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0))
                .then(response => {
                breakpoints.shift();
                expectRemoveBreakpoint([0, 1]);
                expectSetBreakpoint(breakpoints, FILE_NAME);
                return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0);
            })
                .then(response => assertExpectedResponse(response, breakpoints));
        });
        test('After a page refresh, clears the newly resolved breakpoints before adding new ones', () => {
            const breakpoints = [
                { line: 14, column: 33 },
                { line: 200, column: 16 }
            ];
            expectSetBreakpoint(breakpoints, FILE_NAME);
            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => setBp_emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0))
                .then(response => {
                expectRemoveBreakpoint([0, 1]);
                mockEventEmitter.emit('Debugger.globalObjectCleared');
                mockEventEmitter.emit('Debugger.scriptParsed', { scriptId: 'afterRefreshScriptId', url: FILE_NAME });
                mockEventEmitter.emit('Debugger.breakpointResolved', { breakpointId: BP_ID + 0, location: { scriptId: 'afterRefreshScriptId' } });
                mockEventEmitter.emit('Debugger.breakpointResolved', { breakpointId: BP_ID + 1, location: { scriptId: 'afterRefreshScriptId' } });
                breakpoints.push({ line: 321, column: 123 });
                expectSetBreakpoint(breakpoints, FILE_NAME, 'afterRefreshScriptId');
                return chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0);
            })
                .then(response => assertExpectedResponse(response, breakpoints));
        });
        test('returns the actual location specified by the runtime', () => {
            const breakpoints = [
                { line: 5, column: 6 }
            ];
            // Set up the mock to return a different location
            const location = {
                scriptId: SCRIPT_ID, lineNumber: breakpoints[0].line + 10, columnNumber: breakpoints[0].column + 10
            };
            const expectedResponse = {
                breakpoints: [{ line: location.lineNumber, column: location.columnNumber, verified: true, id: 1000 }]
            };
            const expectedRegex = utils.pathToRegex(FILE_NAME, true);
            mockChrome.Debugger
                .setup(x => x.setBreakpointByUrl(typemoq_1.It.isValue({ urlRegex: expectedRegex, lineNumber: breakpoints[0].line, columnNumber: breakpoints[0].column, condition: undefined })))
                .returns(() => Promise.resolve({ breakpointId: BP_ID, locations: [location] }))
                .verifiable();
            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => setBp_emitScriptParsed())
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: FILE_NAME }, breakpoints }, null, 0))
                .then(response => assert.deepEqual(response, expectedResponse));
        });
        test('setting breakpoints in a sourcemapped eval script handles the placeholder url', () => {
            const breakpoints = [
                { line: 5, column: 6 }
            ];
            expectSetBreakpoint(breakpoints);
            return chromeDebugAdapter.attach(ATTACH_ARGS)
                .then(() => setBp_emitScriptParsed(/*url=*/ '', SCRIPT_ID))
                .then(() => chromeDebugAdapter.setBreakpoints({ source: { path: 'VM' + SCRIPT_ID }, breakpoints }, null, 0))
                .then(response => assertExpectedResponse(response, breakpoints));
        });
        function setBp_emitScriptParsedWithSourcemaps(generatedScriptPath, authoredSourcePath) {
            mockSourceMapTransformer.setup(m => m.mapToAuthored(typemoq_1.It.isAnyString(), typemoq_1.It.isAnyNumber(), typemoq_1.It.isAnyNumber()))
                .returns(somePath => Promise.resolve(somePath));
            mockSourceMapTransformer.setup(m => m.allSources(typemoq_1.It.isAnyString()))
                .returns(() => Promise.resolve([]));
            mockSourceMapTransformer.setup(x => x.getGeneratedPathFromAuthoredPath(typemoq_1.It.isValue(authoredSourcePath)))
                .returns(() => Promise.resolve(generatedScriptPath));
            mockSourceMapTransformer.setup(x => x.setBreakpoints(typemoq_1.It.isAny(), typemoq_1.It.isAnyNumber()))
                .returns((args) => {
                args.source.path = generatedScriptPath;
                return args;
            });
            setBp_emitScriptParsed(generatedScriptPath, undefined, [authoredSourcePath]);
        }
        function expectBreakpointEvent(bpId) {
            return new Promise((resolve, reject) => {
                sendEventHandler = e => {
                    try {
                        if (e.event === 'breakpoint') {
                            const bpEvent = e;
                            assert.equal(bpEvent.body.reason, 'changed');
                            assert(bpEvent.body.breakpoint.verified);
                            assert.equal(bpEvent.body.breakpoint.id, bpId);
                            resolve();
                        }
                    }
                    catch (e) {
                        reject(e);
                    }
                };
            });
        }
        test('breakpoints in an unknown .ts script are resolved when the script is loaded', () => __awaiter(this, void 0, void 0, function* () {
            const breakpoints = [
                { line: 5, column: 6 }
            ];
            const authoredSourcePath = '/project/foo.ts';
            const generatedScriptPath = '/project/foo.js';
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            mockSourceMapTransformer.setup(x => x.getGeneratedPathFromAuthoredPath(typemoq_1.It.isValue(authoredSourcePath)))
                .returns(() => Promise.resolve(undefined));
            const response = yield chromeDebugAdapter.setBreakpoints({ source: { path: authoredSourcePath }, breakpoints }, null, 0);
            yield assertExpectedResponse(response, breakpoints, false);
            const bpId = response.breakpoints[0].id;
            mockSourceMapTransformer.reset();
            expectSetBreakpoint(breakpoints, generatedScriptPath);
            setBp_emitScriptParsedWithSourcemaps(generatedScriptPath, authoredSourcePath);
            yield expectBreakpointEvent(bpId);
        }));
        test('breakpoints in an unknown sourcemapped .js script are resolved when the script is loaded', () => __awaiter(this, void 0, void 0, function* () {
            const breakpoints = [
                { line: 5, column: 6 }
            ];
            const authoredSourcePath = '/project/foo.js';
            const generatedScriptPath = '/project/_foo.js';
            // Simulate what node2 does - override validateBreakpointsPath for any .js script even if it isn't loaded
            mockSourceMapTransformer.setup(x => x.getGeneratedPathFromAuthoredPath(typemoq_1.It.isValue(authoredSourcePath)))
                .returns(() => Promise.resolve(authoredSourcePath));
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            expectSetBreakpoint(breakpoints, authoredSourcePath, undefined, false);
            const response = yield chromeDebugAdapter.setBreakpoints({ source: { path: authoredSourcePath }, breakpoints }, null, 0);
            yield assertExpectedResponse(response, breakpoints, false);
            const bpId = response.breakpoints[0].id;
            mockSourceMapTransformer.reset();
            expectSetBreakpoint(breakpoints, generatedScriptPath);
            setBp_emitScriptParsedWithSourcemaps(generatedScriptPath, authoredSourcePath);
            yield expectBreakpointEvent(bpId);
        }));
    });
    suite('Console.messageAdded', () => {
        test('Fires an output event when a console message is added', done => {
            const testLog = 'Hello, world!';
            sendEventHandler = (event) => {
                if (event.event === 'output') {
                    assert.equal(event.body.output.trim(), testLog);
                    done();
                }
                else {
                    testUtils.assertFail('An unexpected event was fired');
                }
            };
            chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                mockEventEmitter.emit('Console.messageAdded', {
                    message: {
                        source: 'console-api',
                        level: 'log',
                        type: 'log',
                        text: testLog,
                        timestamp: Date.now(),
                        line: 2,
                        column: 13,
                        url: 'file:///c:/page/script.js',
                        executionContextId: 2,
                        parameters: [
                            { type: 'string', value: testLog }
                        ]
                    }
                });
            });
        });
    });
    suite('Runtime.consoleAPICalled', () => {
        test('Fires an output event when a console api is called', done => {
            const testLog = 'Hello, world!';
            sendEventHandler = (event) => {
                if (event.event === 'output') {
                    assert.equal(event.body.output.trim(), testLog);
                    done();
                }
                else {
                    testUtils.assertFail('An unexpected event was fired');
                }
            };
            chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                mockEventEmitter.emit('Runtime.consoleAPICalled', {
                    type: 'log',
                    args: [{
                            type: 'string',
                            value: testLog
                        }],
                    executionContextId: 1,
                    timestamp: 1754079033.244016
                });
            });
        });
    });
    suite('Debugger.scriptParsed', () => {
        const FILE_NAME = 'file:///a.js';
        const SCRIPT_ID = '1';
        function emitScriptParsed(url = FILE_NAME, scriptId = SCRIPT_ID, otherArgs = {}) {
            mockSourceMapTransformer.setup(m => m.scriptParsed(typemoq_1.It.isValue(undefined), typemoq_1.It.isValue(undefined)))
                .returns(() => Promise.resolve([]));
            otherArgs.url = url;
            otherArgs.scriptId = scriptId;
            mockEventEmitter.emit('Debugger.scriptParsed', otherArgs);
        }
        test('adds default url when missing', done => {
            chromeDebugAdapter.attach(ATTACH_ARGS).then(() => {
                mockPathTransformer.setup(m => m.scriptParsed(typemoq_1.It.isAnyString()))
                    .returns(url => {
                    assert(!!url, 'Default url missing'); // Should be called with some default url
                    return url;
                });
                mockSourceMapTransformer.setup(m => m.scriptParsed(typemoq_1.It.isAny(), typemoq_1.It.isValue(undefined)))
                    .returns(() => {
                    done();
                    return Promise.resolve([]);
                });
                emitScriptParsed(/*url=*/ '');
            });
        });
        // This is needed for Edge debug adapter, please keep the logic of sendLoadedSourceEvent()
        test('tests that sendLoadedSourceEvent will set the `reason` parameter based on our internal view of the events we sent to the client', () => __awaiter(this, void 0, void 0, function* () {
            let eventIndex = 0;
            sendEventHandler = (event) => {
                switch (eventIndex) {
                    case 0:
                        assert.equal('loadedSource', event.event);
                        assert.notEqual(null, event.body);
                        assert.equal('new', event.body.reason);
                        break;
                    case 1:
                        assert.equal('loadedSource', event.event);
                        assert.notEqual(null, event.body);
                        assert.equal('changed', event.body.reason);
                        break;
                    default:
                        throw new RangeError('Unexpected event index');
                }
                ++eventIndex;
            };
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            yield chromeDebugAdapter.sendLoadedSourceEvent({
                scriptId: 1,
                url: '',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 0,
                executionContextId: 0,
                hash: ''
            });
            yield chromeDebugAdapter.sendLoadedSourceEvent({
                scriptId: 1,
                url: '',
                startLine: 0,
                startColumn: 0,
                endLine: 0,
                endColumn: 0,
                executionContextId: 0,
                hash: ''
            });
        }));
        // This is needed for Edge debug adapter, please keep the logic of sendLoadedSourceEvent()
        test('tests that sendLoadedSourceEvent will set the `reason` parameter based on our internal view of the events we sent to the client even if fs.access takes unexpected times while blocking async', () => __awaiter(this, void 0, void 0, function* () {
            let eventIndex = 0;
            sendEventHandler = (event) => {
                switch (eventIndex) {
                    case 0:
                        assert.equal('loadedSource', event.event);
                        assert.notEqual(null, event.body);
                        assert.equal('new', event.body.reason);
                        break;
                    case 1:
                        assert.equal('loadedSource', event.event);
                        assert.notEqual(null, event.body);
                        assert.equal('changed', event.body.reason);
                        break;
                    default:
                        throw new RangeError('Unexpected event index');
                }
                ++eventIndex;
            };
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            const originalFSAccess = fs.access;
            let callIndex = 0;
            let callbackForFirstEvent = null;
            /* Mock fs.access so the first call will block until the second call is finished */
            fs.access = (path, callback) => {
                if (callIndex === 0) {
                    callbackForFirstEvent = callback;
                    // Blocking first fs.access until second call is finished
                    ++callIndex;
                }
                else {
                    callback();
                    if (callbackForFirstEvent !== null) {
                        // Second call went through. Unblocking first call
                        setTimeout(callbackForFirstEvent, 50);
                        callbackForFirstEvent = null;
                    }
                }
            };
            try {
                const firstEvent = chromeDebugAdapter.sendLoadedSourceEvent({
                    scriptId: 1,
                    url: '',
                    startLine: 0,
                    startColumn: 0,
                    endLine: 0,
                    endColumn: 0,
                    executionContextId: 0,
                    hash: ''
                });
                const secondEvent = chromeDebugAdapter.sendLoadedSourceEvent({
                    scriptId: 1,
                    url: '',
                    startLine: 0,
                    startColumn: 0,
                    endLine: 0,
                    endColumn: 0,
                    executionContextId: 0,
                    hash: ''
                });
                yield Promise.all([firstEvent, secondEvent]);
            }
            finally {
                fs.access = originalFSAccess;
            }
        }));
        function createSource(name, path, sourceReference, origin) {
            return {
                name: name,
                path: path,
                // if the path exists, do not send the sourceReference
                sourceReference: sourceReference,
                origin
            };
        }
        test('When a page refreshes, finish sending the "new" source events, before sending the corresponding "removed" source event', () => __awaiter(this, void 0, void 0, function* () {
            const expectedEvents = [
                new debugSession_1.InitializedEvent(),
                new debugSession_1.LoadedSourceEvent('new', createSource('about:blank', 'about:blank', 1000)),
                new debugSession_1.LoadedSourceEvent('removed', createSource('about:blank', 'about:blank', 1000)),
                new debugSession_1.LoadedSourceEvent('new', createSource('localhost:61312', 'http://localhost:61312/', 1001))
            ];
            const receivedEvents = [];
            sendEventHandler = (event) => { receivedEvents.push(event); };
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            emitScriptParsed('about:blank', '1');
            mockEventEmitter.emit('Debugger.globalObjectCleared');
            mockEventEmitter.emit('Runtime.executionContextsCleared');
            emitScriptParsed('http://localhost:61312/', '2');
            yield chromeDebugAdapter.doAfterProcessingSourceEvents(() => {
                assert.deepEqual(receivedEvents, expectedEvents);
            });
        }));
    });
    suite('evaluate()', () => {
        function getExpectedValueResponse(resultObj) {
            let result;
            let variablesReference = 0;
            if (resultObj.type === 'string') {
                result = resultObj.description;
            }
            return {
                result,
                variablesReference,
                indexedVariables: undefined,
                namedVariables: undefined,
                type: resultObj.type
            };
        }
        function setupEvalMock(expression, result) {
            mockChrome.Runtime
                .setup(x => x.evaluate(typemoq_1.It.isValue({ expression, silent: true, generatePreview: true, includeCommandLineAPI: true, objectGroup: 'console', userGesture: true })))
                .returns(() => Promise.resolve({ result }));
        }
        function setupEvalOnCallFrameMock(expression, callFrameId, result) {
            mockChrome.Debugger
                .setup(x => x.evaluateOnCallFrame(typemoq_1.It.isValue({ expression, callFrameId, silent: true, generatePreview: true, includeCommandLineAPI: true, objectGroup: 'console' })))
                .returns(() => Promise.resolve({ result }));
        }
        test('calls Runtime.evaluate when not paused', () => {
            const expression = '1+1';
            const result = { type: 'string', description: '2' };
            setupEvalMock(expression, result);
            return chromeDebugAdapter.evaluate({ expression }).then(response => {
                assert.deepEqual(response, getExpectedValueResponse(result));
            });
        });
        test('calls Debugger.evaluateOnCallFrame when paused', () => {
            const callFrameId = '1';
            const expression = '1+1';
            const result = { type: 'string', description: '2' };
            setupEvalOnCallFrameMock(expression, callFrameId, result);
            // Sue me (just easier than sending a Debugger.paused event)
            chromeDebugAdapter._frameHandles = { get: () => ({ callFrameId }) };
            return chromeDebugAdapter.evaluate({ expression, frameId: 0 }).then(response => {
                assert.deepEqual(response, getExpectedValueResponse(result));
            });
        });
    });
    suite('Debugger.pause', () => {
        test('returns the same sourceReferences for the same scripts', () => __awaiter(this, void 0, void 0, function* () {
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            const scriptId = 'script1';
            const location = { lineNumber: 0, columnNumber: 0, scriptId };
            const callFrame = { callFrameId: 'id1', location };
            emitScriptParsed('', scriptId);
            mockEventEmitter.emit('Debugger.paused', { callFrames: [callFrame, callFrame] });
            const { stackFrames } = yield chromeDebugAdapter.stackTrace({ threadId: THREAD_ID });
            // Should have two stack frames with the same sourceReferences
            assert.equal(stackFrames.length, 2);
            assert.equal(stackFrames[0].source.sourceReference, stackFrames[1].source.sourceReference);
            const sourceReference = stackFrames[0].source.sourceReference;
            // If it pauses a second time, and we request another stackTrace, should have the same result
            mockEventEmitter.emit('Debugger.paused', { callFrames: [callFrame, callFrame] });
            const { stackFrames: stackFrames2 } = yield chromeDebugAdapter.stackTrace({ threadId: THREAD_ID });
            assert.equal(stackFrames2.length, 2);
            assert.equal(stackFrames2[0].source.sourceReference, sourceReference);
            assert.equal(stackFrames2[1].source.sourceReference, sourceReference);
        }));
    });
    suite('onExceptionThrown', () => {
        const authoredPath = '/Users/me/error.ts';
        const generatedPath = 'http://localhost:9999/error.js';
        const getExceptionStr = (path, line) => 'Error: kaboom!\n' +
            `    at error (${path}:${line}:1)\n` +
            `    at ${path}:${line}:1`;
        const generatedExceptionStr = getExceptionStr(generatedPath, 6);
        const authoredExceptionStr = getExceptionStr(authoredPath, 12);
        const exceptionEvent = {
            'timestamp': 1490164925297,
            'exceptionDetails': {
                'exceptionId': 21,
                'text': 'Uncaught',
                'lineNumber': 5,
                'columnNumber': 10,
                'url': 'http://localhost:9999/error.js',
                'stackTrace': null,
                'exception': {
                    'type': 'object',
                    'subtype': 'error',
                    'className': 'Error',
                    'description': generatedExceptionStr,
                    'objectId': '{"injectedScriptId":148,"id":1}'
                },
                'executionContextId': 148
            }
        };
        test('passes through exception when no source mapping present', () => __awaiter(this, void 0, void 0, function* () {
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            const sendEventP = new Promise((resolve, reject) => {
                sendEventHandler = (event) => asyncAssert(() => assert.equal(event.body.output.trim(), generatedExceptionStr), resolve, reject);
            });
            mockEventEmitter.emit('Runtime.exceptionThrown', exceptionEvent);
            yield sendEventP;
        }));
        test('translates callstack to authored files via source mapping', () => __awaiter(this, void 0, void 0, function* () {
            // We need to reset mocks and re-initialize chromeDebugAdapter
            // because reset() creates a new instance of object
            mockSourceMapTransformer.reset();
            mockery.resetCache();
            mockery.registerMock('fs', { statSync: () => { } });
            initChromeDebugAdapter();
            yield chromeDebugAdapter.attach(ATTACH_ARGS);
            const sendEventP = new Promise((resolve, reject) => {
                sendEventHandler = (event) => asyncAssert(() => assert.equal(event.body.output.trim(), authoredExceptionStr), resolve, reject);
            });
            mockSourceMapTransformer.setup(m => m.mapToAuthored(typemoq_1.It.isValue(generatedPath), typemoq_1.It.isAnyNumber(), typemoq_1.It.isAnyNumber()))
                .returns(() => Promise.resolve({ source: authoredPath, line: 12, column: 1 }));
            mockEventEmitter.emit('Runtime.exceptionThrown', exceptionEvent);
            yield sendEventP;
        }));
    });
    suite('setExceptionBreakpoints()', () => { });
    suite('stepping', () => { });
    suite('stackTrace()', () => { });
    suite('scopes()', () => { });
    suite('variables()', () => { });
    suite('source()', () => { });
    suite('threads()', () => { });
    suite('Debugger.resume', () => { });
    suite('target close/error/detach', () => { });
});
//# sourceMappingURL=chromeDebugAdapter.test.js.map