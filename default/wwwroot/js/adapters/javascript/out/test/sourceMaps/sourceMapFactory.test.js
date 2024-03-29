"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mockery = require("mockery");
const path = require("path");
const typemoq_1 = require("typemoq");
const utils = require("../../src/utils");
const testUtils = require("../testUtils");
const MODULE_UNDER_TEST = '../../src/sourceMaps/sourceMapFactory';
/**
 * Unit tests for SourceMap + source-map (the mozilla lib). source-map is included in the test and not mocked
 */
suite('SourceMapFactory', () => {
    let sourceMapFactory;
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        // Set up mockery
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
    });
    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });
    /**
     * Register a SourceMap mock that asserts that it was called with the correct args. The exception
     * should be caught by the factory, but then it should return null.
     * Should take the same args as the SourceMap constructor, but you can't enforce that with TS.
     * Mocks need to be registered before calling this.
     */
    function setExpectedConstructorArgs(generatedPath, json, pathMapping = undefined) {
        const expectedArgs = [generatedPath, json, pathMapping, undefined]; // arguments doesn't have the default param
        function mockSourceMapConstructor() {
            assert.deepEqual(Array.prototype.slice.call(arguments), expectedArgs);
        }
        mockery.registerMock('./sourceMap', { SourceMap: mockSourceMapConstructor });
        const smfConstructor = require(MODULE_UNDER_TEST).SourceMapFactory;
        sourceMapFactory = new smfConstructor(pathMapping);
    }
    // How these tests basically work - The factory function should call the mocked SourceMap constructor
    // which asserts that it's called with the correct args. Also assert that it returned some object (ie nothing threw or failed);
    suite('getMapForGeneratedPath', () => {
        const GENERATED_SCRIPT_DIRNAME = testUtils.pathResolve('/project/app/out/');
        const GENERATED_SCRIPT_PATH = path.join(GENERATED_SCRIPT_DIRNAME, 'script.js');
        const GENERATED_SCRIPT_URL = 'http://localhost:8080/app/script.js';
        const PATHMAPPING = { '/': testUtils.pathResolve('/project/app') };
        const FILEDATA = 'data';
        test('resolves inlined sourcemap', () => {
            const sourceMapData = JSON.stringify({ sources: ['a.ts', 'b.ts'] });
            const encodedData = 'data:application/json;base64,' + new Buffer(sourceMapData).toString('base64');
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, sourceMapData, PATHMAPPING);
            return sourceMapFactory.getMapForGeneratedPath(GENERATED_SCRIPT_PATH, encodedData).then(sourceMap => {
                assert(sourceMap);
            });
        });
        test('returns null on malformed inline sourcemap', () => {
            const encodedData = 'data:application/json;base64,this is not base64-encoded data';
            return sourceMapFactory.getMapForGeneratedPath(GENERATED_SCRIPT_PATH, encodedData).then(sourceMap => {
                assert(!sourceMap);
            });
        });
        test('handles an absolute path to the sourcemap', () => {
            // Can't be an absolute local path - just a /path from webroot
            const absMapPath = '/files/app.js.map';
            testUtils.registerMockReadFile({ absPath: testUtils.pathResolve('/project/app/files/app.js.map'), data: FILEDATA });
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, FILEDATA, PATHMAPPING);
            return sourceMapFactory.getMapForGeneratedPath(GENERATED_SCRIPT_PATH, absMapPath).then(sourceMap => {
                assert(sourceMap);
            });
        });
        test('handles a relative path next to the script', () => {
            testUtils.registerMockReadFile({ absPath: GENERATED_SCRIPT_PATH + '.map', data: FILEDATA });
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, FILEDATA, PATHMAPPING);
            return sourceMapFactory.getMapForGeneratedPath(GENERATED_SCRIPT_PATH, 'script.js.map').then(sourceMap => {
                assert(sourceMap);
            });
        });
        test('handles a relative path with a generated script url', () => {
            const utilsMock = typemoq_1.Mock.ofInstance(utils);
            utilsMock.callBase = true;
            mockery.registerMock('../utils', utilsMock.object);
            testUtils.registerMockGetURL('../utils', GENERATED_SCRIPT_URL + '.map', FILEDATA, utilsMock);
            setExpectedConstructorArgs(GENERATED_SCRIPT_URL, FILEDATA, PATHMAPPING);
            return sourceMapFactory.getMapForGeneratedPath(GENERATED_SCRIPT_URL, 'script.js.map').then(sourceMap => {
                assert(sourceMap);
                utilsMock.verifyAll();
            });
        });
        test('looks for a map file next to the script', () => {
            const badMapPath = '/files/app.js.map';
            testUtils.registerMockReadFile({ absPath: testUtils.pathResolve('/project/app/files/app.js.map'), data: null }, { absPath: GENERATED_SCRIPT_PATH + '.map', data: FILEDATA });
            setExpectedConstructorArgs(GENERATED_SCRIPT_PATH, FILEDATA, PATHMAPPING);
            return sourceMapFactory.getMapForGeneratedPath(GENERATED_SCRIPT_PATH, badMapPath).then(sourceMap => {
                assert(sourceMap);
            });
        });
    });
});
//# sourceMappingURL=sourceMapFactory.test.js.map