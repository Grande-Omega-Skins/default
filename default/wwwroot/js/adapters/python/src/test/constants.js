"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const configSettings_1 = require("../client/common/configSettings");
exports.IS_APPVEYOR = process.env.APPVEYOR === 'true';
exports.IS_TRAVIS = process.env.TRAVIS === 'true';
exports.IS_VSTS = process.env.TF_BUILD !== undefined;
exports.IS_CI_SERVER = exports.IS_TRAVIS || exports.IS_APPVEYOR || exports.IS_VSTS;
// allow the CI server to specify JUnit output...
let reportJunit = false;
if (exports.IS_CI_SERVER && process.env.MOCHA_REPORTER_JUNIT !== undefined) {
    reportJunit = process.env.MOCHA_REPORTER_JUNIT.toLowerCase() === 'true';
}
exports.MOCHA_REPORTER_JUNIT = reportJunit;
exports.MOCHA_CI_REPORTFILE = exports.MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_REPORTFILE !== undefined ?
    process.env.MOCHA_CI_REPORTFILE : './junit-out.xml';
exports.MOCHA_CI_PROPERTIES = exports.MOCHA_REPORTER_JUNIT && process.env.MOCHA_CI_PROPERTIES !== undefined ?
    process.env.MOCHA_CI_PROPERTIES : '';
exports.TEST_TIMEOUT = 25000;
exports.IS_MULTI_ROOT_TEST = isMultitrootTest();
exports.IS_CI_SERVER_TEST_DEBUGGER = process.env.IS_CI_SERVER_TEST_DEBUGGER === '1';
// If running on CI server, then run debugger tests ONLY if the corresponding flag is enabled.
exports.TEST_DEBUGGER = exports.IS_CI_SERVER ? exports.IS_CI_SERVER_TEST_DEBUGGER : true;
function isMultitrootTest() {
    return Array.isArray(vscode_1.workspace.workspaceFolders) && vscode_1.workspace.workspaceFolders.length > 1;
}
exports.IsAnalysisEngineTest = () => !exports.IS_TRAVIS && (process.env.VSC_PYTHON_ANALYSIS === '1' || !configSettings_1.PythonSettings.getInstance().jediEnabled);
//# sourceMappingURL=constants.js.map