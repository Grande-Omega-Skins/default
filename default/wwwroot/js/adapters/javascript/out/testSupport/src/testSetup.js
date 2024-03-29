"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const debugClient_1 = require("./debugClient");
// ES6 default export...
// tslint:disable-next-line:no-var-requires
// const LoggingReporter = require('./loggingReporter');
// LoggingReporter.alwaysDumpLogs = true;
let unhandledAdapterErrors;
// const origTest = test;
const checkLogTest = (title, testCallback, testFn = undefined) => {
    // Hack to always check logs after a test runs, can simplify after this issue:
    // https://github.com/mochajs/mocha/issues/1635
    if (!testCallback) {
        // return origTest(title, testCallback);
    }
    function runTest() {
        return new Promise((resolve, reject) => {
            const optionalCallback = e => {
                if (e)
                    reject(e);
                else
                    resolve();
            };
            const maybeP = testCallback(optionalCallback);
            if (maybeP && maybeP.then) {
                maybeP.then(resolve, reject);
            }
        });
    }
    return testFn(title, () => {
        return runTest()
            .then(() => {
            // If any unhandled errors were logged, then ensure the test fails
            if (unhandledAdapterErrors.length) {
                const errStr = unhandledAdapterErrors.length === 1 ? unhandledAdapterErrors[0] :
                    JSON.stringify(unhandledAdapterErrors);
                throw new Error(errStr);
            }
        });
    });
};
// (<Mocha.ITestDefinition>checkLogTest).only = (expectation, assertion) => checkLogTest(expectation, assertion, origTest.only);
// (<Mocha.ITestDefinition>checkLogTest).skip = test.skip;
test = checkLogTest;
function log(e) {
    // Skip telemetry events
    if (e.body.category === 'telemetry')
        return;
    const timestamp = new Date().toISOString().split(/[TZ]/)[1];
    const outputBody = e.body.output ? e.body.output.trim() : 'variablesReference: ' + e.body.variablesReference;
    const msg = ` ${timestamp} ${outputBody}`;
    // LoggingReporter.logEE.emit('log', msg);
    if (msg.indexOf('********') >= 0)
        unhandledAdapterErrors.push(msg);
}
let dc;
function patchLaunchFn(patchLaunchArgsCb) {
    function patchLaunchArgs(launchArgs) {
        launchArgs.trace = 'verbose';
        const patchReturnVal = patchLaunchArgsCb(launchArgs);
        return patchReturnVal || Promise.resolve();
    }
    const origLaunch = dc.launch;
    dc.launch = (launchArgs) => {
        return patchLaunchArgs(launchArgs)
            .then(() => origLaunch.call(dc, launchArgs));
    };
}
function setup(opts) {
    unhandledAdapterErrors = [];
    dc = new debugClient_1.ExtendedDebugClient('node', opts.entryPoint, opts.type);
    if (opts.patchLaunchArgs) {
        patchLaunchFn(opts.patchLaunchArgs);
    }
    // LoggingReporter.alwaysDumpLogs = opts.alwaysDumpLogs;
    dc.addListener('output', log);
    return dc.start(opts.port)
        .then(() => dc);
}
exports.setup = setup;
function teardown() {
    dc.removeListener('output', log);
    return dc.stop();
}
exports.teardown = teardown;
//# sourceMappingURL=testSetup.js.map