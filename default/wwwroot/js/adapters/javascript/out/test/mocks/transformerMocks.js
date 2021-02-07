"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const typemoq_1 = require("typemoq");
const lineNumberTransformer_1 = require("../../src/transformers/lineNumberTransformer");
const baseSourceMapTransformer_1 = require("../../src/transformers/baseSourceMapTransformer");
const urlPathTransformer_1 = require("../../src/transformers/urlPathTransformer");
function getMockLineNumberTransformer() {
    const mock = typemoq_1.Mock.ofType(lineNumberTransformer_1.LineColTransformer);
    mock.setup(m => m.setBreakpoints(typemoq_1.It.isAny()))
        .returns(args => args);
    return mock;
}
exports.getMockLineNumberTransformer = getMockLineNumberTransformer;
function getMockSourceMapTransformer() {
    const mock = typemoq_1.Mock.ofType(baseSourceMapTransformer_1.BaseSourceMapTransformer);
    mock.setup(m => m.setBreakpoints(typemoq_1.It.isAny(), typemoq_1.It.isAny()))
        .returns(args => args);
    // mock.setup(m => m.getGeneratedPathFromAuthoredPath(It.isAnyString()))
    //     .returns(somePath => Promise.resolve(''));
    mock.setup(m => m.mapToAuthored(typemoq_1.It.isAnyString(), typemoq_1.It.isAnyNumber(), typemoq_1.It.isAnyNumber()))
        .returns(somePath => Promise.resolve(somePath));
    mock.setup(m => m.allSources(typemoq_1.It.isAnyString()))
        .returns(() => Promise.resolve([]));
    return mock;
}
exports.getMockSourceMapTransformer = getMockSourceMapTransformer;
function getMockPathTransformer() {
    const mock = typemoq_1.Mock.ofType(urlPathTransformer_1.UrlPathTransformer);
    mock.setup(m => m.setBreakpoints(typemoq_1.It.isAny()))
        .returns(args => args);
    mock.setup(m => m.getTargetPathFromClientPath(typemoq_1.It.isAnyString()))
        .returns(somePath => somePath);
    return mock;
}
exports.getMockPathTransformer = getMockPathTransformer;
//# sourceMappingURL=transformerMocks.js.map