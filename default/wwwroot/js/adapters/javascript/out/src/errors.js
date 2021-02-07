"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle();
exports.evalNotAvailableMsg = localize('eval.not.available', 'not available');
exports.runtimeNotConnectedMsg = localize('not.connected', 'not connected to runtime');
exports.noRestartFrame = localize('restartFrame.cannot', "Can't restart frame");
class ErrorWithMessage extends Error {
    constructor(message) {
        super(message.format);
        this.id = message.id;
        this.format = message.format;
        this.variables = message.variables;
        this.sendTelemetry = message.sendTelemetry;
        this.showUser = message.showUser;
        this.url = message.url;
        this.urlLabel = message.urlLabel;
    }
}
exports.ErrorWithMessage = ErrorWithMessage;
function attributePathNotExist(attribute, path) {
    return new ErrorWithMessage({
        id: 2007,
        format: localize('attribute.path.not.exist', "Attribute '{0}' does not exist ('{1}').", attribute, '{path}'),
        variables: { path }
    });
}
exports.attributePathNotExist = attributePathNotExist;
/**
 * Error stating that a relative path should be absolute
 */
function attributePathRelative(attribute, path) {
    return new ErrorWithMessage(withInfoLink(2008, localize('attribute.path.not.absolute', "Attribute '{0}' is not absolute ('{1}'); consider adding '{2}' as a prefix to make it absolute.", attribute, '{path}', '${workspaceFolder}/'), { path }, 20003));
}
exports.attributePathRelative = attributePathRelative;
/**
 * Get error with 'More Information' link.
 */
function withInfoLink(id, format, variables, infoId) {
    return new ErrorWithMessage({
        id,
        format,
        variables,
        showUser: true,
        url: 'http://go.microsoft.com/fwlink/?linkID=534832#_' + infoId.toString(),
        urlLabel: localize('more.information', 'More Information')
    });
}
exports.withInfoLink = withInfoLink;
function setValueNotSupported() {
    return new ErrorWithMessage({
        id: 2004,
        format: localize('setVariable.error', 'Setting value not supported')
    });
}
exports.setValueNotSupported = setValueNotSupported;
function errorFromEvaluate(errMsg) {
    return new ErrorWithMessage({
        id: 2025,
        format: errMsg
    });
}
exports.errorFromEvaluate = errorFromEvaluate;
function sourceRequestIllegalHandle() {
    return new ErrorWithMessage({
        id: 2027,
        format: 'sourceRequest error: illegal handle',
        sendTelemetry: true
    });
}
exports.sourceRequestIllegalHandle = sourceRequestIllegalHandle;
function sourceRequestCouldNotRetrieveContent() {
    return new ErrorWithMessage({
        id: 2026,
        format: localize('source.not.found', 'Could not retrieve content.')
    });
}
exports.sourceRequestCouldNotRetrieveContent = sourceRequestCouldNotRetrieveContent;
function pathFormat() {
    return new ErrorWithMessage({
        id: 2018,
        format: 'debug adapter only supports native paths',
        sendTelemetry: true
    });
}
exports.pathFormat = pathFormat;
function runtimeConnectionTimeout(timeoutMs, errMsg) {
    return new ErrorWithMessage({
        id: 2010,
        format: localize('VSND2010', 'Cannot connect to runtime process, timeout after {0} ms - (reason: {1}).', '{_timeout}', '{_error}'),
        variables: { _error: errMsg, _timeout: timeoutMs + '' }
    });
}
exports.runtimeConnectionTimeout = runtimeConnectionTimeout;
function stackFrameNotValid() {
    return new ErrorWithMessage({
        id: 2020,
        format: 'stack frame not valid',
        sendTelemetry: true
    });
}
exports.stackFrameNotValid = stackFrameNotValid;
function noCallStackAvailable() {
    return new ErrorWithMessage({
        id: 2023,
        format: localize('VSND2023', 'No call stack available.')
    });
}
exports.noCallStackAvailable = noCallStackAvailable;
function invalidThread(threadId) {
    return new ErrorWithMessage({
        id: 2030,
        format: 'Invalid thread {_thread}',
        variables: { _thread: threadId + '' },
        sendTelemetry: true
    });
}
exports.invalidThread = invalidThread;
function exceptionInfoRequestError() {
    return new ErrorWithMessage({
        id: 2031,
        format: 'exceptionInfoRequest error',
        sendTelemetry: true
    });
}
exports.exceptionInfoRequestError = exceptionInfoRequestError;
function noStoredException() {
    return new ErrorWithMessage({
        id: 2032,
        format: 'exceptionInfoRequest error: no stored exception',
        sendTelemetry: true
    });
}
exports.noStoredException = noStoredException;
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
function runtimeNotFound(_runtime) {
    return new ErrorWithMessage({
        id: 2001,
        format: localize('VSND2001', "Cannot find runtime '{0}' on PATH.", '{_runtime}'),
        variables: { _runtime }
    });
}
exports.runtimeNotFound = runtimeNotFound;
function cannotLaunchInTerminal(_error) {
    return new ErrorWithMessage({
        id: 2011,
        format: localize('VSND2011', 'Cannot launch debug target in terminal ({0}).', '{_error}'),
        variables: { _error }
    });
}
exports.cannotLaunchInTerminal = cannotLaunchInTerminal;
function cannotLaunchDebugTarget(_error) {
    return new ErrorWithMessage({
        id: 2017,
        format: localize('VSND2017', 'Cannot launch debug target ({0}).', '{_error}'),
        variables: { _error },
        showUser: true,
        sendTelemetry: true
    });
}
exports.cannotLaunchDebugTarget = cannotLaunchDebugTarget;
function unknownConsoleType(consoleType) {
    return new ErrorWithMessage({
        id: 2028,
        format: localize('VSND2028', "Unknown console type '{0}'.", consoleType)
    });
}
exports.unknownConsoleType = unknownConsoleType;
function cannotLaunchBecauseSourceMaps(programPath) {
    return new ErrorWithMessage({
        id: 2002,
        format: localize('VSND2002', "Cannot launch program '{0}'; configuring source maps might help.", '{path}'),
        variables: { path: programPath }
    });
}
exports.cannotLaunchBecauseSourceMaps = cannotLaunchBecauseSourceMaps;
function cannotLaunchBecauseOutFiles(programPath) {
    return new ErrorWithMessage({
        id: 2003,
        format: localize('VSND2003', "Cannot launch program '{0}'; setting the '{1}' attribute might help.", '{path}', 'outFiles'),
        variables: { path: programPath }
    });
}
exports.cannotLaunchBecauseOutFiles = cannotLaunchBecauseOutFiles;
function cannotLaunchBecauseJsNotFound(programPath) {
    return new ErrorWithMessage({
        id: 2009,
        format: localize('VSND2009', "Cannot launch program '{0}' because corresponding JavaScript cannot be found.", '{path}'),
        variables: { path: programPath }
    });
}
exports.cannotLaunchBecauseJsNotFound = cannotLaunchBecauseJsNotFound;
function cannotLoadEnvVarsFromFile(error) {
    return new ErrorWithMessage({
        id: 2029,
        format: localize('VSND2029', "Can't load environment variables from file ({0}).", '{_error}'),
        variables: { _error: error }
    });
}
exports.cannotLoadEnvVarsFromFile = cannotLoadEnvVarsFromFile;
//# sourceMappingURL=errors.js.map