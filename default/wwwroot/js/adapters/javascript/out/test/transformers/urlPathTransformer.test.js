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
const assert = require("assert");
const mockery = require("mockery");
const testUtils = require("../testUtils");
const chromeUtils = require("../../src/chrome/chromeUtils");
const typemoq_1 = require("typemoq");
const MODULE_UNDER_TEST = '../../src/transformers/urlPathTransformer';
function createTransformer() {
    return new (require(MODULE_UNDER_TEST).UrlPathTransformer)();
}
suite('UrlPathTransformer', () => {
    const TARGET_URL = 'http://mysite.com/scripts/script1.js';
    const CLIENT_PATH = testUtils.pathResolve('/projects/mysite/scripts/script1.js');
    let chromeUtilsMock;
    let transformer;
    setup(() => {
        testUtils.setupUnhandledRejectionListener();
        mockery.enable({ useCleanCache: true, warnOnReplace: false, warnOnUnregistered: false });
        chromeUtilsMock = typemoq_1.Mock.ofInstance(chromeUtils, typemoq_1.MockBehavior.Strict);
        mockery.registerMock('../chrome/chromeUtils', chromeUtilsMock.object);
        transformer = createTransformer();
    });
    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
        chromeUtilsMock.verifyAll();
    });
    suite('setBreakpoints()', () => {
        let SET_BP_ARGS;
        const EXPECTED_SET_BP_ARGS = { source: { path: TARGET_URL } };
        setup(() => {
            // This will be modified by the test, so restore it before each
            SET_BP_ARGS = { source: { path: CLIENT_PATH } };
        });
        test('resolves correctly when it can map the client script to the target script', () => __awaiter(this, void 0, void 0, function* () {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(typemoq_1.It.isValue(TARGET_URL), typemoq_1.It.isValue(undefined)))
                .returns(() => CLIENT_PATH).verifiable();
            yield transformer.scriptParsed(TARGET_URL);
            transformer.setBreakpoints(SET_BP_ARGS);
            assert.deepEqual(SET_BP_ARGS, EXPECTED_SET_BP_ARGS);
        }));
        test(`doesn't modify the args when it can't map the client script to the target script`, () => {
            const origArgs = JSON.parse(JSON.stringify(SET_BP_ARGS));
            transformer.setBreakpoints(SET_BP_ARGS);
            assert.deepEqual(SET_BP_ARGS, origArgs);
        });
        test(`uses path as-is when it's a URL`, () => {
            const args = { source: { path: TARGET_URL } };
            transformer.setBreakpoints(args);
            assert.deepEqual(args, EXPECTED_SET_BP_ARGS);
        });
    });
    suite('scriptParsed', () => {
        test('returns the client path when the file can be mapped', () => __awaiter(this, void 0, void 0, function* () {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(typemoq_1.It.isValue(TARGET_URL), typemoq_1.It.isValue(undefined)))
                .returns(() => CLIENT_PATH).verifiable();
            assert.equal(yield transformer.scriptParsed(TARGET_URL), CLIENT_PATH);
        }));
        test(`returns the given path when the file can't be mapped`, () => __awaiter(this, void 0, void 0, function* () {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(typemoq_1.It.isValue(TARGET_URL), typemoq_1.It.isValue(undefined)))
                .returns(() => '').verifiable();
            chromeUtilsMock
                .setup(x => x.EVAL_NAME_PREFIX)
                .returns(() => 'VM').verifiable();
            assert.equal(yield transformer.scriptParsed(TARGET_URL), TARGET_URL);
        }));
        test('ok with uncanonicalized paths', () => __awaiter(this, void 0, void 0, function* () {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(typemoq_1.It.isValue(TARGET_URL + '?queryparam'), typemoq_1.It.isValue(undefined)))
                .returns(() => CLIENT_PATH).verifiable();
            assert.equal(yield transformer.scriptParsed(TARGET_URL + '?queryparam'), CLIENT_PATH);
            assert.equal(transformer.getClientPathFromTargetPath(TARGET_URL + '?queryparam'), CLIENT_PATH);
            assert.equal(transformer.getTargetPathFromClientPath(CLIENT_PATH), TARGET_URL + '?queryparam');
        }));
    });
    suite('stackTraceResponse()', () => {
        const RUNTIME_LOCATIONS = [
            { line: 2, column: 3 },
            { line: 5, column: 6 },
            { line: 8, column: 9 }
        ];
        test('modifies the source path and clears sourceReference when the file can be mapped', () => __awaiter(this, void 0, void 0, function* () {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(typemoq_1.It.isValue(TARGET_URL), typemoq_1.It.isValue(undefined)))
                .returns(() => CLIENT_PATH).verifiable(typemoq_1.Times.atLeastOnce());
            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LOCATIONS, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(CLIENT_PATH, RUNTIME_LOCATIONS);
            yield transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        }));
        test(`doesn't modify the source path or clear the sourceReference when the file can't be mapped`, () => {
            chromeUtilsMock
                .setup(x => x.targetUrlToClientPath(typemoq_1.It.isValue(TARGET_URL), typemoq_1.It.isValue(undefined)))
                .returns(() => '').verifiable(typemoq_1.Times.atLeastOnce());
            const response = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LOCATIONS, [1, 2, 3]);
            const expectedResponse = testUtils.getStackTraceResponseBody(TARGET_URL, RUNTIME_LOCATIONS, [1, 2, 3]);
            transformer.stackTraceResponse(response);
            assert.deepEqual(response, expectedResponse);
        });
    });
});
//# sourceMappingURL=urlPathTransformer.test.js.map