"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_debugadapter_1 = require("vscode-debugadapter");
const utils = require("../utils");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle();
class StoppedEvent2 extends vscode_debugadapter_1.StoppedEvent {
    constructor(reason, threadId, exception) {
        const exceptionText = exception && exception.description && utils.firstLine(exception.description);
        super(reason, threadId, exceptionText);
        switch (reason) {
            case 'step':
                this.body.description = localize('reason.description.step', 'Paused on step');
                break;
            case 'breakpoint':
                this.body.description = localize('reason.description.breakpoint', 'Paused on breakpoint');
                break;
            case 'exception':
                const uncaught = exception && exception.uncaught; // Currently undocumented
                if (typeof uncaught === 'undefined') {
                    this.body.description = localize('reason.description.exception', 'Paused on exception');
                }
                else if (uncaught) {
                    this.body.description = localize('reason.description.uncaughtException', 'Paused on uncaught exception');
                }
                else {
                    this.body.description = localize('reason.description.caughtException', 'Paused on caught exception');
                }
                break;
            case 'pause':
                this.body.description = localize('reason.description.user_request', 'Paused on user request');
                break;
            case 'entry':
                this.body.description = localize('reason.description.entry', 'Paused on entry');
                break;
            case 'debugger_statement':
                this.body.description = localize('reason.description.debugger_statement', 'Paused on debugger statement');
                break;
            case 'frame_entry':
                this.body.description = localize('reason.description.restart', 'Paused on frame entry');
                break;
            case 'promise_rejection':
                this.body.description = localize('reason.description.promiseRejection', 'Paused on promise rejection');
                this.body.reason = 'exception';
                break;
            default:
                this.body.description = 'Unknown pause reason';
                break;
        }
    }
}
exports.StoppedEvent2 = StoppedEvent2;
//# sourceMappingURL=stoppedEvent.js.map