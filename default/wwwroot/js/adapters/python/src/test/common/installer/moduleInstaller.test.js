// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const TypeMoq = require("typemoq");
const condaInstaller_1 = require("../../../client/common/installer/condaInstaller");
const pipInstaller_1 = require("../../../client/common/installer/pipInstaller");
const types_1 = require("../../../client/common/installer/types");
const types_2 = require("../../../client/common/terminal/types");
const types_3 = require("../../../client/common/types");
const contracts_1 = require("../../../client/interpreter/contracts");
const initialize_1 = require("../../initialize");
// tslint:disable-next-line:max-func-body-length
suite('Module Installerx', () => {
    const pythonPath = path.join(__dirname, 'python');
    suiteSetup(initialize_1.initialize);
    [condaInstaller_1.CondaInstaller, pipInstaller_1.PipInstaller].forEach(installerClass => {
        let disposables = [];
        let installer;
        let installationChannel;
        let serviceContainer;
        let terminalService;
        let pythonSettings;
        let interpreterService;
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType();
            disposables = [];
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);
            installationChannel = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_1.IInstallationChannelManager), TypeMoq.It.isAny())).returns(() => installationChannel.object);
            const condaService = TypeMoq.Mock.ofType();
            condaService.setup(c => c.getCondaFile()).returns(() => Promise.resolve('conda'));
            condaService.setup(c => c.getCondaEnvironment(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined));
            const configService = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_3.IConfigurationService), TypeMoq.It.isAny())).returns(() => configService);
            pythonSettings = TypeMoq.Mock.ofType();
            pythonSettings.setup(p => p.pythonPath).returns(() => pythonPath);
            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => pythonSettings.object);
            terminalService = TypeMoq.Mock.ofType();
            const terminalServiceFactory = TypeMoq.Mock.ofType();
            terminalServiceFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => terminalService.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(types_2.ITerminalServiceFactory), TypeMoq.It.isAny())).returns(() => terminalServiceFactory.object);
            interpreterService = TypeMoq.Mock.ofType();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(contracts_1.IInterpreterService), TypeMoq.It.isAny())).returns(() => interpreterService.object);
            installer = new installerClass(serviceContainer.object);
        });
        teardown(() => {
            disposables.forEach(disposable => {
                if (disposable) {
                    disposable.dispose();
                }
            });
        });
        test(`Ensure getActiveInterperter is used (${installerClass.name})`, () => __awaiter(this, void 0, void 0, function* () {
            if (installer.displayName !== 'Pip') {
                return;
            }
            interpreterService.setup(i => i.getActiveInterpreter(TypeMoq.It.isAny())).returns(() => Promise.resolve(undefined)).verifiable();
            try {
                yield installer.installModule('xyz');
                // tslint:disable-next-line:no-empty
            }
            catch (_a) { }
            interpreterService.verifyAll();
        }));
    });
});
//# sourceMappingURL=moduleInstaller.test.js.map