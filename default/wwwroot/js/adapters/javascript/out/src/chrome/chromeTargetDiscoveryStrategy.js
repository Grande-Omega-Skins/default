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
const utils = require("../utils");
const executionTimingsReporter_1 = require("../executionTimingsReporter");
const chromeUtils = require("./chromeUtils");
const nls = require("vscode-nls");
const localize = nls.loadMessageBundle();
class ChromeTargetDiscovery {
    constructor(_logger, _telemetry) {
        this.events = new executionTimingsReporter_1.StepProgressEventsEmitter();
        this.logger = _logger;
        this.telemetry = _telemetry;
    }
    getTarget(address, port, targetFilter, targetUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const targets = yield this.getAllTargets(address, port, targetFilter, targetUrl);
            if (targets.length > 1) {
                this.logger.log('Warning: Found more than one valid target page. Attaching to the first one. Available pages: ' + JSON.stringify(targets.map(target => target.url)));
            }
            const selectedTarget = targets[0];
            this.logger.verbose(`Attaching to target: ${JSON.stringify(selectedTarget)}`);
            this.logger.verbose(`WebSocket Url: ${selectedTarget.webSocketDebuggerUrl}`);
            return selectedTarget;
        });
    }
    getAllTargets(address, port, targetFilter, targetUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            const targets = yield this._getTargets(address, port);
            /* __GDPR__
               "targetCount" : {
                  "numTargets" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
                  "${include}": [ "${DebugCommonProperties}" ]
               }
             */
            this.telemetry.reportEvent('targetCount', { numTargets: targets.length });
            if (!targets.length) {
                return utils.errP(localize('attach.responseButNoTargets', 'Got a response from the target app, but no target pages found'));
            }
            return this._getMatchingTargets(targets, targetFilter, targetUrl);
        });
    }
    _getTargets(address, port) {
        return __awaiter(this, void 0, void 0, function* () {
            // Temporary workaround till Edge fixes this bug: https://microsoft.visualstudio.com/OS/_workitems?id=15517727&fullScreen=false&_a=edit
            // Chrome and Node alias /json to /json/list so this should work too
            const url = `http://${address}:${port}/json/list`;
            this.logger.log(`Discovering targets via ${url}`);
            /* __GDPR__FRAGMENT__
               "StepNames" : {
                  "Attach.RequestDebuggerTargetsInformation" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
               }
             */
            this.events.emitStepStarted('Attach.RequestDebuggerTargetsInformation');
            const jsonResponse = yield utils.getURL(url, { headers: { Host: 'localhost' } })
                .catch(e => utils.errP(localize('attach.cannotConnect', 'Cannot connect to the target: {0}', e.message)));
            /* __GDPR__FRAGMENT__
               "StepNames" : {
                  "Attach.ProcessDebuggerTargetsInformation" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
               }
             */
            this.events.emitStepStarted('Attach.ProcessDebuggerTargetsInformation');
            try {
                const responseArray = JSON.parse(jsonResponse);
                if (Array.isArray(responseArray)) {
                    return responseArray
                        .map(target => this._fixRemoteUrl(address, port, target));
                }
                else {
                    return utils.errP(localize('attach.invalidResponseArray', 'Response from the target seems invalid: {0}', jsonResponse));
                }
            }
            catch (e) {
                return utils.errP(localize('attach.invalidResponse', 'Response from the target seems invalid. Error: {0}. Response: {1}', e.message, jsonResponse));
            }
        });
    }
    _getMatchingTargets(targets, targetFilter, targetUrl) {
        let filteredTargets = targetFilter ?
            targets.filter(targetFilter) : // Apply the consumer-specific target filter
            targets;
        // If a url was specified, try to filter to that url
        filteredTargets = targetUrl ?
            chromeUtils.getMatchingTargets(filteredTargets, targetUrl) :
            filteredTargets;
        if (!filteredTargets.length) {
            throw new Error(localize('attach.noMatchingTarget', "Can't find a valid target that matches: {0}. Available pages: {1}", targetUrl, JSON.stringify(targets.map(target => target.url))));
        }
        // If all possible targets appear to be attached to have some other devtool attached, then fail
        const targetsWithWSURLs = filteredTargets.filter(target => !!target.webSocketDebuggerUrl);
        if (!targetsWithWSURLs.length) {
            throw new Error(localize('attach.devToolsAttached', "Can't attach to this target that may have Chrome DevTools attached: {0}", filteredTargets[0].url));
        }
        return targetsWithWSURLs;
    }
    _fixRemoteUrl(remoteAddress, remotePort, target) {
        if (target.webSocketDebuggerUrl) {
            const addressMatch = target.webSocketDebuggerUrl.match(/ws:\/\/([^/]+)\/?/);
            if (addressMatch) {
                const replaceAddress = `${remoteAddress}:${remotePort}`;
                target.webSocketDebuggerUrl = target.webSocketDebuggerUrl.replace(addressMatch[1], replaceAddress);
            }
        }
        return target;
    }
}
exports.ChromeTargetDiscovery = ChromeTargetDiscovery;
//# sourceMappingURL=chromeTargetDiscoveryStrategy.js.map