"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/* tslint:disable:typedef */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mockery = require("mockery");
const typemoq_1 = require("typemoq");
const testUtils = require("../testUtils");
const sourceMaps_1 = require("../../src/sourceMaps/sourceMaps");
const utils = require("../../src/utils");
/* tslint:disable:no-function-expression */
const MODULE_UNDER_TEST = '../../src/transformers/baseSourceMapTransformer';
const AUTHORED_PATH = testUtils.pathResolve('/project/authored.ts');
const RUNTIME_FILE = 'runtime.js';
const RUNTIME_PATH = testUtils.pathResolve('/project', RUNTIME_FILE);
// These are fns because the data will be modified by tests
const AUTHORED_BPS = () => [
    { line: 1, column: 4 },
    { line: 2, column: 5 },
    { line: 3, column: 6 }
];
const RUNTIME_BPS = () => [
    { line: 2, column: 3 },
    { line: 5, column: 7 },
    { line: 8, column: 11 }
];
const AUTHORED_PATH2 = testUtils.pathResolve('/project/authored2.ts');
const AUTHORED_BPS2 = () => [
    { line: 90, column: 5 },
    { line: 105, column: 6 }
];
const RUNTIME_BPS2 = () => [
    { line: 78, column: 0 },
    { line: 81, column: 1 }
];
suite('BaseSourceMapTransformer', () => {
    let utilsMock;
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        // Mock the utils module
        utilsMock = typemoq_1.Mock.ofInstance(utils);
        utilsMock.callBase = true;
        mockery.registerMock('../utils', utilsMock.object);
        // Set up mockery
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
    });
    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });
    function getTransformer(sourceMaps = true, suppressDefaultMock = false) {
        if (!suppressDefaultMock) {
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: StubSourceMaps });
        }
        let BaseSourceMapTransformer = require(MODULE_UNDER_TEST).BaseSourceMapTransformer;
        const transformer = new BaseSourceMapTransformer();
        transformer.launch({
            sourceMaps,
            generatedCodeDirectory: 'test'
        });
        return transformer;
    }
    suite('setBreakpoints()', () => {
        function createArgs(path, breakpoints) {
            return {
                source: { path },
                breakpoints
            };
        }
        function createExpectedArgs(authoredPath, path, breakpoints) {
            const args = createArgs(path, breakpoints);
            args.authoredPath = authoredPath;
            return args;
        }
        function createMergedSourcesMock(args, args2) {
            const mock = typemoq_1.Mock.ofType(sourceMaps_1.SourceMaps, typemoq_1.MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: function () { return mock.object; } });
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(typemoq_1.It.isValue(AUTHORED_PATH)))
                .returns(() => RUNTIME_PATH)
                .verifiable(typemoq_1.Times.atLeastOnce());
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(typemoq_1.It.isValue(AUTHORED_PATH2)))
                .returns(() => RUNTIME_PATH)
                .verifiable(typemoq_1.Times.atLeastOnce());
            mock
                .setup(x => x.allMappedSources(typemoq_1.It.isValue(RUNTIME_PATH)))
                .returns(() => [AUTHORED_PATH, AUTHORED_PATH2])
                .verifiable(typemoq_1.Times.atLeastOnce());
            args.breakpoints.forEach((bp, i) => {
                mock
                    .setup(x => x.mapToGenerated(typemoq_1.It.isValue(AUTHORED_PATH), typemoq_1.It.isValue(bp.line), typemoq_1.It.isValue(bp.column || 0)))
                    .returns(() => ({ source: RUNTIME_PATH, line: RUNTIME_BPS()[i].line, column: RUNTIME_BPS()[i].column })).verifiable();
            });
            args2.breakpoints.forEach((bp, i) => {
                mock
                    .setup(x => x.mapToGenerated(typemoq_1.It.isValue(AUTHORED_PATH2), typemoq_1.It.isValue(bp.line), typemoq_1.It.isValue(bp.column || 0)))
                    .returns(() => ({ source: RUNTIME_PATH, line: RUNTIME_BPS2()[i].line, column: RUNTIME_BPS2()[i].column })).verifiable();
            });
            return mock;
        }
        test('modifies the source and lines', () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_BPS());
            const expected = createExpectedArgs(AUTHORED_PATH, RUNTIME_PATH, RUNTIME_BPS());
            getTransformer().setBreakpoints(args, 0);
            assert.deepEqual(args, expected);
        });
        test(`doesn't do anything when sourcemaps are disabled`, () => {
            const args = createArgs(RUNTIME_PATH, RUNTIME_BPS());
            const expected = createArgs(RUNTIME_PATH, RUNTIME_BPS());
            getTransformer(/*sourceMaps=*/ false).setBreakpoints(args, 0);
            assert.deepEqual(args, expected);
        });
        // #106
        test.skip(`if the source can't be mapped, waits until the runtime script is loaded`, () => __awaiter(this, void 0, void 0, function* () {
            const args = createArgs(AUTHORED_PATH, AUTHORED_BPS());
            const expected = createExpectedArgs(AUTHORED_PATH, RUNTIME_PATH, RUNTIME_BPS());
            const sourceMapURL = 'script.js.map';
            const mock = typemoq_1.Mock.ofType(sourceMaps_1.SourceMaps, typemoq_1.MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: function () { return mock.object; } });
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(typemoq_1.It.isValue(AUTHORED_PATH)))
                .returns(() => null).verifiable();
            mock
                .setup(x => x.getGeneratedPathFromAuthoredPath(typemoq_1.It.isValue(AUTHORED_PATH)))
                .returns(() => RUNTIME_PATH).verifiable();
            mock
                .setup(x => x.allMappedSources(typemoq_1.It.isValue(RUNTIME_PATH)))
                .returns(() => [AUTHORED_PATH]).verifiable();
            mock
                .setup(x => x.processNewSourceMap(typemoq_1.It.isValue(RUNTIME_PATH), typemoq_1.It.isValue(sourceMapURL)))
                .returns(() => Promise.resolve()).verifiable();
            args.breakpoints.forEach((bp, i) => {
                mock
                    .setup(x => x.mapToGenerated(typemoq_1.It.isValue(AUTHORED_PATH), typemoq_1.It.isValue(bp.line), typemoq_1.It.isValue(bp.column || 0)))
                    .returns(() => ({ source: RUNTIME_PATH, line: RUNTIME_BPS()[i].line, column: RUNTIME_BPS()[i].column })).verifiable();
            });
            const transformer = getTransformer(/*sourceMaps=*/ true, /*suppressDefaultMock=*/ true);
            transformer.setBreakpoints(args, /*requestSeq=*/ 0);
            assert.deepEqual(args, expected);
            mock.verifyAll();
            yield transformer.scriptParsed(RUNTIME_PATH, sourceMapURL);
            // return setBreakpointsP;
        }));
        test('if the source maps to a merged file, includes the breakpoints in other files that map to the same file', () => {
            const args = createArgs(AUTHORED_PATH, AUTHORED_BPS());
            const args2 = createArgs(AUTHORED_PATH2, AUTHORED_BPS2());
            const expected = createExpectedArgs(AUTHORED_PATH2, RUNTIME_PATH, RUNTIME_BPS2().concat(RUNTIME_BPS()));
            const mock = createMergedSourcesMock(args, args2);
            const transformer = getTransformer(/*sourceMaps=*/ true, /*suppressDefaultMock=*/ true);
            transformer.setBreakpoints(args, 0);
            transformer.setBreakpoints(args2, 1);
            assert.deepEqual(args2, expected);
            mock.verifyAll();
        });
        suite('setBreakpointsResponse()', () => {
            function getResponseBody(breakpoints) {
                return {
                    breakpoints: breakpoints.map(({ line, column }) => {
                        return {
                            line,
                            column,
                            verified: true
                        };
                    })
                };
            }
            test('modifies the response source and breakpoints', () => {
                const response = getResponseBody(RUNTIME_BPS());
                const expected = getResponseBody(AUTHORED_BPS());
                const transformer = getTransformer();
                transformer.setBreakpoints({
                    source: { path: AUTHORED_PATH },
                    breakpoints: AUTHORED_BPS()
                }, 0);
                transformer.setBreakpointsResponse(response, 0);
                assert.deepEqual(response, expected);
            });
            test(`doesn't do anything when sourcemaps are disabled except remove the column`, () => {
                const response = getResponseBody(RUNTIME_BPS());
                const expected = getResponseBody(RUNTIME_BPS());
                const transformer = getTransformer(/*sourceMaps=*/ false);
                transformer.setBreakpoints({
                    source: { path: RUNTIME_PATH },
                    breakpoints: RUNTIME_BPS()
                }, 0);
                transformer.setBreakpointsResponse(response, 0);
                assert.deepEqual(response, expected);
            });
            test(`if the source maps to a merged file, filters breakpoint results from other files`, () => {
                const setBPArgs = createArgs(AUTHORED_PATH, AUTHORED_BPS());
                const setBPArgs2 = createArgs(AUTHORED_PATH2, AUTHORED_BPS2());
                const response = getResponseBody(RUNTIME_BPS2().concat(RUNTIME_BPS()));
                const expected = getResponseBody(AUTHORED_BPS2());
                const mock = createMergedSourcesMock(setBPArgs, setBPArgs2);
                RUNTIME_BPS2().forEach((bp, i) => {
                    mock
                        .setup(x => x.mapToAuthored(typemoq_1.It.isValue(RUNTIME_PATH), typemoq_1.It.isValue(bp.line), typemoq_1.It.isValue(bp.column)))
                        .returns(() => ({ source: AUTHORED_PATH2, line: AUTHORED_BPS2()[i].line, column: AUTHORED_BPS2()[i].column })).verifiable();
                });
                const transformer = getTransformer(/*sourceMaps=*/ true, /*suppressDefaultMock=*/ true);
                transformer.setBreakpoints(setBPArgs, /*requestSeq=*/ 0);
                transformer.setBreakpoints(setBPArgs2, /*requestSeq=*/ 1);
                transformer.setBreakpointsResponse(response, /*requestSeq=*/ 1);
                assert.deepEqual(response, expected);
                mock.verifyAll();
            });
        });
    });
    suite('stackTraceResponse()', () => {
        test('modifies the response stackFrames', () => __awaiter(this, void 0, void 0, function* () {
            utilsMock
                .setup(x => x.existsSync(typemoq_1.It.isValue(AUTHORED_PATH)))
                .returns(() => true);
            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_BPS(), [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(AUTHORED_PATH, AUTHORED_BPS(), undefined, /*isSourceMapped=*/ true);
            yield getTransformer().stackTraceResponse(response);
            assert.deepEqual(response, expected);
        }));
        test('doesn\'t clear the path when there are no sourcemaps', () => __awaiter(this, void 0, void 0, function* () {
            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_BPS(), [1, 2, 3]);
            yield getTransformer(/*sourceMaps=*/ false).stackTraceResponse(response);
            response.stackFrames.forEach(frame => assert(!!frame.source));
        }));
        test(`keeps the path when the file can't be sourcemapped if it's on disk`, () => __awaiter(this, void 0, void 0, function* () {
            const mock = typemoq_1.Mock.ofType(sourceMaps_1.SourceMaps, typemoq_1.MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: function () { return mock.object; } });
            RUNTIME_BPS().forEach(bp => {
                mock
                    .setup(x => x.mapToAuthored(typemoq_1.It.isValue(RUNTIME_PATH), typemoq_1.It.isValue(bp.line), typemoq_1.It.isValue(bp.column)))
                    .returns(() => null).verifiable();
            });
            utilsMock
                .setup(x => x.existsSync(typemoq_1.It.isValue(RUNTIME_PATH)))
                .returns(() => true);
            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_BPS(), [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_BPS());
            yield getTransformer(/*sourceMaps=*/ true, /*suppressDefaultMock=*/ true).stackTraceResponse(response);
            assert.deepEqual(response, expected);
            mock.verifyAll();
        }));
        test(`clears the name and leaves the path when it can't be sourcemapped and doesn't exist on disk`, () => __awaiter(this, void 0, void 0, function* () {
            const mock = typemoq_1.Mock.ofType(sourceMaps_1.SourceMaps, typemoq_1.MockBehavior.Strict);
            mockery.registerMock('../sourceMaps/sourceMaps', { SourceMaps: function () { return mock.object; } });
            RUNTIME_BPS().forEach(bp => {
                mock
                    .setup(x => x.mapToAuthored(typemoq_1.It.isValue(RUNTIME_PATH), typemoq_1.It.isValue(bp.line), typemoq_1.It.isValue(bp.column)))
                    .returns(() => null).verifiable();
            });
            utilsMock
                .setup(x => x.existsSync(typemoq_1.It.isValue(RUNTIME_PATH)))
                .returns(() => false);
            const response = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_BPS(), [1, 2, 3]);
            const expected = testUtils.getStackTraceResponseBody(RUNTIME_PATH, RUNTIME_BPS(), [1, 2, 3]);
            expected.stackFrames.forEach(stackFrame => {
                stackFrame.source.name = RUNTIME_FILE;
            });
            yield getTransformer(/*sourceMaps=*/ true, /*suppressDefaultMock=*/ true).stackTraceResponse(response);
            assert.deepEqual(response, expected);
            mock.verifyAll();
        }));
    });
});
class StubSourceMaps {
    getGeneratedPathFromAuthoredPath(path) {
        return RUNTIME_PATH;
    }
    /*
     * Map location in source language to location in generated code.
     * line and column are 0 based.
     */
    mapToGenerated(path, line, column) {
        const authored = AUTHORED_BPS();
        let i;
        for (i = 0; i < authored.length; i++) {
            if (authored[i].line === line && authored[i].column === column)
                break;
        }
        const mapping = RUNTIME_BPS()[i];
        return { source: RUNTIME_PATH, line: mapping.line, column: mapping.column };
    }
    /*
     * Map location in generated code to location in source language.
     * line and column are 0 based.
     */
    mapToAuthored(path, line, column) {
        const runtime = RUNTIME_BPS();
        let i;
        for (i = 0; i < runtime.length; i++) {
            if (runtime[i].line === line && runtime[i].column === column)
                break;
        }
        const mapping = AUTHORED_BPS()[i];
        return { source: AUTHORED_PATH, line: mapping.line, column: mapping.column };
    }
    allMappedSources(pathToGenerated) {
        return [AUTHORED_PATH];
    }
    processNewSourceMap(pathToGenerated, sourceMapURL) {
        return Promise.resolve();
    }
}
//# sourceMappingURL=baseSourceMapTransformer.test.js.map