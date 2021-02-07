"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const mockery = require("mockery");
const os = require("os");
const testUtils = require("../testUtils");
const sourceMapUtils_1 = require("../../src/sourceMaps/sourceMapUtils");
suite('SourceMapUtils', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        testUtils.registerWin32Mocks();
        testUtils.registerLocMocks();
    });
    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });
    suite('getComputedSourceRoot()', () => {
        const GEN_PATH = testUtils.pathResolve('/project/webroot/code/script.js');
        const GEN_URL = 'http://localhost:8080/code/script.js';
        const ABS_SOURCEROOT = testUtils.pathResolve('/project/src');
        const WEBROOT = testUtils.pathResolve('/project/webroot');
        const PATH_MAPPING = { '/': WEBROOT };
        test('handles file:/// sourceRoot', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('file:///' + ABS_SOURCEROOT, GEN_PATH, PATH_MAPPING), ABS_SOURCEROOT);
        });
        test('handles /src style sourceRoot', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('/src', GEN_PATH, PATH_MAPPING), testUtils.pathResolve('/project/webroot/src'));
        });
        test('handles ../../src style sourceRoot', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('../../src', GEN_PATH, PATH_MAPPING), ABS_SOURCEROOT);
        });
        test('handles src style sourceRoot', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('src', GEN_PATH, PATH_MAPPING), testUtils.pathResolve('/project/webroot/code/src'));
        });
        test('handles runtime script not on disk', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('../src', GEN_URL, PATH_MAPPING), testUtils.pathResolve('/project/webroot/src'));
        });
        test('when no sourceRoot specified and runtime script is on disk, uses the runtime script dirname', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('', GEN_PATH, PATH_MAPPING), testUtils.pathResolve('/project/webroot/code'));
        });
        test('when no sourceRoot specified and runtime script is not on disk, uses the runtime script dirname', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('', GEN_URL, PATH_MAPPING), testUtils.pathResolve('/project/webroot/code'));
        });
        test('no crash on debugadapter:// urls', () => {
            assert.equal(sourceMapUtils_1.getComputedSourceRoot('', 'eval://123', PATH_MAPPING), testUtils.pathResolve(WEBROOT));
        });
    });
    suite('applySourceMapPathOverrides', () => {
        test('removes a matching webpack prefix', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('webpack:///src/app.js', { 'webpack:///*': testUtils.pathResolve('/project/*') }), testUtils.pathResolve('/project/src/app.js'));
        });
        test('works using the laptop emoji', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('meteor:///💻app/src/main.js', { 'meteor:///💻app/*': testUtils.pathResolve('/project/*') }), testUtils.pathResolve('/project/src/main.js'));
        });
        test('does nothing when no overrides match', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('file:///c:/project/app.js', { 'webpack:///*': testUtils.pathResolve('/project/*') }), 'file:///c:/project/app.js');
        });
        test('resolves ..', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('/project/source/app.js', { '/project/source/*': testUtils.pathResolve('/') + 'project/../*' }), testUtils.pathResolve('/app.js'));
        });
        test(`does nothing when match but asterisks don't match`, () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('webpack:///src/app.js', { 'webpack:///src/app.js': testUtils.pathResolve('/project/*') }), 'webpack:///src/app.js');
        });
        test(`does nothing when match but too many asterisks`, () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('webpack:///src/code/app.js', { 'webpack:///*/code/app.js': testUtils.pathResolve('/project/*/*') }), 'webpack:///src/code/app.js');
        });
        test('replaces an asterisk in the middle', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('webpack:///src/app.js', { 'webpack:///*/app.js': testUtils.pathResolve('/project/*/app.js') }), testUtils.pathResolve('/project/src/app.js'));
        });
        test('replaces an asterisk at the beginning', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('/src/app.js', { '*/app.js': testUtils.pathResolve('/project/*/app.js') }), testUtils.pathResolve('/project/src/app.js'));
        });
        test('allows some regex characters in the pattern', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('webpack+(foo):///src/app.js', { 'webpack+(foo):///*/app.js': testUtils.pathResolve('/project/*/app.js') }), testUtils.pathResolve('/project/src/app.js'));
        });
        test('replaces correctly when asterisk on left but not right', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('/src/app.js', { '*/app.js': testUtils.pathResolve('/project/app.js') }), testUtils.pathResolve('/project/app.js'));
        });
        test('the pattern is case-insensitive', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('/src/app.js', { '*/APP.js': testUtils.pathResolve('/project/*/app.js') }), testUtils.pathResolve('/project/src/app.js'));
        });
        test('works when multiple overrides provided', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('/src/app.js', {
                'foo': 'bar',
                '/file.js': testUtils.pathResolve('/main.js'),
                '*/app.js': testUtils.pathResolve('/project/*/app.js'),
                '/something/*/else.js': 'main.js'
            }), testUtils.pathResolve('/project/src/app.js'));
        });
        test('applies overrides in order by longest key first', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('/src/app.js', {
                '*': testUtils.pathResolve('/main.js'),
                '*/app.js': testUtils.pathResolve('/project/*/app.js'),
                '*.js': 'main.js'
            }), testUtils.pathResolve('/project/src/app.js'));
        });
        test('is slash agnostic', () => {
            assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('/src/app.js', { '*\\app.js': testUtils.pathResolve('/*/app.js') }), testUtils.pathResolve('/src/app.js'));
            if (os.platform() === 'win32') {
                assert.deepEqual(sourceMapUtils_1.applySourceMapPathOverrides('C:\\foo\\src\\app.js', { 'C:\\foo\\*': 'C:\\bar\\*' }), 'C:\\bar\\src\\app.js');
            }
        });
    });
    suite('resolveMapPath', () => {
        test('works for a relative local path', () => {
            const scriptPath = testUtils.pathResolve('/project/app.js');
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptPath, 'app.js.map', {}), scriptPath + '.map');
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptPath, './app.js.map', {}), scriptPath + '.map');
        });
        test('works for a web relative path', () => {
            const scriptUrl = 'http://localhost:8080/project/app.js';
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, 'app.js.map', {}), scriptUrl + '.map');
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, './app.js.map', {}), scriptUrl + '.map');
        });
        test('works for a full url with local script', () => {
            const urlMap = 'http://localhost/app.js.map';
            const scriptUrl = testUtils.pathResolve('/project/app.js');
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, urlMap, {}), urlMap);
        });
        test('works for a full url with url script', () => {
            const urlMap = 'http://localhost/app.js.map';
            const scriptUrl = 'http://localhost:8080/project/app.js';
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, urlMap, {}), urlMap);
        });
        test('works for a /path', () => {
            const slashPath = '/maps/app.js.map';
            const scriptUrl = 'http://localhost:8080/project/app.js';
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, slashPath, {}), 'http://localhost:8080/maps/app.js.map');
        });
        test('applies pathMappings for /path and local path', () => {
            const slashPath = '/maps/app.js.map';
            const scriptUrl = testUtils.pathResolve('/foo/bar/project/app.js');
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, slashPath, { '/': testUtils.pathResolve('/foo/bar') }), testUtils.pathResolve('/foo/bar/maps/app.js.map'));
        });
        test('works for a file:/// url', () => {
            const winFileUrl = 'file:///c:/project/app.js.map';
            const notWinFileUrl = 'file:///project/app.js.map';
            const scriptUrl = 'http://localhost:8080/project/app.js';
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, winFileUrl, {}), winFileUrl);
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptUrl, notWinFileUrl, {}), notWinFileUrl);
        });
        // https://github.com/Microsoft/vscode-chrome-debug/issues/268
        test('works for an eval script', () => {
            const scriptPath = 'eval://53';
            const sourceMapPath = 'foo.min.js';
            assert.equal(sourceMapUtils_1.resolveMapPath(scriptPath, sourceMapPath, {}), null);
        });
    });
    suite('getFullSourceEntry', () => {
        test('works', () => {
            assert.equal(sourceMapUtils_1.getFullSourceEntry(undefined, 'foo/bar.js'), 'foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('webpack:///', 'foo/bar.js'), 'webpack:///foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('webpack:///project', 'foo/bar.js'), 'webpack:///project/foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('webpack:///project/', 'foo/bar.js'), 'webpack:///project/foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('file:///c:/project', 'foo/bar.js'), 'file:///c:/project/foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('/', 'foo/bar.js'), '/foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('/project/', 'foo/bar.js'), '/project/foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('project/', 'foo/bar.js'), 'project/foo/bar.js');
            assert.equal(sourceMapUtils_1.getFullSourceEntry('./project/', 'foo/bar.js'), './project/foo/bar.js');
        });
    });
});
//# sourceMappingURL=sourceMapUtils.test.js.map