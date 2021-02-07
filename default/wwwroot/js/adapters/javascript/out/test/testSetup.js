"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
console.log("TestSetup");
const os = require("os");
const path = require("path");
const debugClient_1 = require("../testSupport/src/debugClient");
// import * as ts from '../testSupport/src/index'
const findFreePort = require("find-free-port");
const NIGHTLY_NAME = os.platform() === 'win32' ? 'node-nightly.cmd' : 'node-nightly';
function findPort() {
    return new Promise(resolve => {
        findFreePort(9000, (err, port) => {
            if (err)
                return resolve(9229);
            resolve(port);
        });
    });
}
function patchLaunchArgs(launchArgs) {
    return __awaiter(this, void 0, void 0, function* () {
        launchArgs.trace = 'verbose';
        console.log("version", process.version);
        if (process.version.startsWith('v6.2')) {
            launchArgs.runtimeExecutable = NIGHTLY_NAME;
        }
        if (!launchArgs.port) {
            launchArgs.port = yield findPort();
            launchArgs.runtimeArgs = launchArgs.runtimeArgs || [];
            launchArgs.runtimeArgs.push(`--inspect=${launchArgs.port}`, '--debug-brk');
        }
    });
}
let unhandledAdapterErrors;
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
function log(e) {
    // Skip telemetry events
    if (e.body.category === 'telemetry')
        return;
    const timestamp = new Date().toISOString().split(/[TZ]/)[1];
    const outputBody = e.body.output ? e.body.output.trim() : 'variablesReference: ' + e.body.variablesReference;
    const msg = ` ${timestamp} ${outputBody}`;
    // LoggingReporter.logEE.emit('log', msg);
    // console.log("msg: ", msg)
    if (msg.indexOf('********') >= 0)
        unhandledAdapterErrors.push(msg);
}
function ts_setup(opts) {
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
exports.ts_setup = ts_setup;
function ts_teardown() {
    dc.removeListener('output', log);
    return dc.stop();
}
exports.ts_teardown = ts_teardown;
function setup(_opts) {
    const opts = Object.assign({
        entryPoint: path.join(__dirname, './wwwroot/js/adapters/javascript/out/src/nodeDebug.js'),
        type: 'node2',
        patchLaunchArgs
    }, _opts);
    return ts_setup(opts);
}
exports.setup = setup;
function teardown() {
    ts_teardown();
}
exports.teardown = teardown;
// export const lowercaseDriveLetterDirname = __dirname.charAt(0).toLowerCase() + __dirname.substr(1);
// export const PROJECT_ROOT = path.join(lowercaseDriveLetterDirname, '../../');
// export const DATA_ROOT = path.join(PROJECT_ROOT, 'testdata/');
//# sourceMappingURL=testSetup.js.map