"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/* tslint:disable:typedef */
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const typemoq_1 = require("typemoq");
// See https://github.com/florinn/typemoq/issues/20
function getConsoleStubs(mockEventEmitter) {
    return {
        enable() { },
        on(eventName, handler) { mockEventEmitter.on(`Console.${eventName}`, handler); }
    };
}
function getDebuggerStubs(mockEventEmitter) {
    return {
        setBreakpoint() { },
        setBreakpointByUrl() { },
        removeBreakpoint() { },
        enable() { },
        evaluateOnCallFrame() { },
        setAsyncCallStackDepth() { },
        on(eventName, handler) { mockEventEmitter.on(`Debugger.${eventName}`, handler); }
    };
}
function getRuntimeStubs(mockEventEmitter) {
    return {
        enable() { },
        evaluate() { },
        on(eventName, handler) { mockEventEmitter.on(`Runtime.${eventName}`, handler); }
    };
}
function getInspectorStubs(mockEventEmitter) {
    return {
        on(eventName, handler) { mockEventEmitter.on(`Inspector.${eventName}`, handler); }
    };
}
function getMockChromeConnectionApi() {
    const mockEventEmitter = new events_1.EventEmitter();
    let mockConsole = typemoq_1.Mock.ofInstance(getConsoleStubs(mockEventEmitter));
    mockConsole.callBase = true;
    mockConsole
        .setup(x => x.enable())
        .returns(() => Promise.resolve());
    let mockDebugger = typemoq_1.Mock.ofInstance(getDebuggerStubs(mockEventEmitter));
    mockDebugger.callBase = true;
    mockDebugger
        .setup(x => x.enable())
        .returns(() => Promise.resolve(null));
    let mockRuntime = typemoq_1.Mock.ofInstance(getRuntimeStubs(mockEventEmitter));
    mockRuntime.callBase = true;
    mockRuntime
        .setup(x => x.enable())
        .returns(() => Promise.resolve());
    let mockInspector = typemoq_1.Mock.ofInstance(getInspectorStubs(mockEventEmitter));
    mockInspector.callBase = true;
    const chromeConnectionAPI = {
        Console: mockConsole.object,
        Debugger: mockDebugger.object,
        Runtime: mockRuntime.object,
        Inspector: mockInspector.object
    };
    return {
        apiObjects: chromeConnectionAPI,
        Console: mockConsole,
        Debugger: mockDebugger,
        Runtime: mockRuntime,
        Inspector: mockInspector,
        mockEventEmitter
    };
}
exports.getMockChromeConnectionApi = getMockChromeConnectionApi;
//# sourceMappingURL=debugProtocolMocks.js.map