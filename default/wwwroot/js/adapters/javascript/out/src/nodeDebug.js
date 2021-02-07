"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
//import { ChromeDebugSession, logger, telemetry } from 'vscode-chrome-debug-core';
const path = require("path");
const os = require("os");
const nodeDebugAdapter_1 = require("./nodeDebugAdapter");
const _1 = require(".");
_1.ChromeDebugSession.run(_1.ChromeDebugSession.getSession({
    logFilePath: path.join(os.tmpdir(), 'vscode-node-debug2.txt'),
    adapter: nodeDebugAdapter_1.NodeDebugAdapter,
    extensionName: 'node-debug2',
    enableSourceMapCaching: true
}));
/* tslint:disable:no-var-requires */
const debugAdapterVersion = require('../../package.json').version;
_1.logger.log('node-debug2: ' + debugAdapterVersion);
/* __GDPR__FRAGMENT__
   "DebugCommonProperties" : {
      "Versions.DebugAdapter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
   }
 */
_1.telemetry.telemetry.addCustomGlobalProperty({ 'Versions.DebugAdapter': debugAdapterVersion });
//# sourceMappingURL=nodeDebug.js.map