"use strict";
// tslint:disable:no-string-literal
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const configSettings_1 = require("../client/common/configSettings");
const extension_1 = require("../client/extension");
const common_1 = require("./common");
__export(require("./constants"));
const dummyPythonFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
const multirootPath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = vscode.Uri.file(path.join(multirootPath, 'workspace3'));
//First thing to be executed.
process.env['VSC_PYTHON_CI_TEST'] = '1';
// Ability to use custom python environments for testing
function initializePython() {
    return __awaiter(this, void 0, void 0, function* () {
        yield common_1.resetGlobalPythonPathSetting();
        yield common_1.clearPythonPathInWorkspaceFolder(dummyPythonFile);
        yield common_1.clearPythonPathInWorkspaceFolder(workspace3Uri);
        yield common_1.setPythonPathInWorkspaceRoot(common_1.PYTHON_PATH);
    });
}
exports.initializePython = initializePython;
// tslint:disable-next-line:no-any
function initialize() {
    return __awaiter(this, void 0, void 0, function* () {
        yield initializePython();
        // Opening a python file activates the extension.
        yield vscode.workspace.openTextDocument(dummyPythonFile);
        yield extension_1.activated;
        // Dispose any cached python settings (used only in test env).
        configSettings_1.PythonSettings.dispose();
    });
}
exports.initialize = initialize;
// tslint:disable-next-line:no-any
function initializeTest() {
    return __awaiter(this, void 0, void 0, function* () {
        yield initializePython();
        yield closeActiveWindows();
        // Dispose any cached python settings (used only in test env).
        configSettings_1.PythonSettings.dispose();
    });
}
exports.initializeTest = initializeTest;
function closeActiveWindows() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            vscode.commands.executeCommand('workbench.action.closeAllEditors')
                // tslint:disable-next-line:no-unnecessary-callback-wrapper
                .then(() => resolve(), reject);
            // Attempt to fix #1301.
            // Lets not waste too much time.
            setTimeout(() => {
                reject(new Error('Command \'workbench.action.closeAllEditors\' timedout'));
            }, 15000);
        });
    });
}
exports.closeActiveWindows = closeActiveWindows;
//# sourceMappingURL=initialize.js.map