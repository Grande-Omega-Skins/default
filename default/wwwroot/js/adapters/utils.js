"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Immutable = require("immutable");
const fs = require("fs-extra");
exports.mk_pair = (a, b) => ({ fst: a, snd: b });
exports.mk_left = (a) => ({ kind: "left", value: a });
exports.mk_right = (b) => ({ kind: "right", value: b });
exports.mk_some = (a) => ({ kind: "some", value: a });
exports.mk_none = () => ({ kind: "none" });
exports.init_program_input = (get_program, get_breakpoints) => __awaiter(this, void 0, void 0, function* () {
    let _error = exports.mk_none();
    let program = yield get_program.catch(_ => { _error = exports.mk_some("Error while getting the program"); return ""; });
    let breakpoints = yield get_breakpoints
        .then(bs => bs)
        .catch(_ => { _error = exports.mk_some("Error while getting the breakpoints"); return []; });
    if (_error.kind == "some")
        return exports.mk_left(_error.value);
    return exports.mk_right(exports.mk_pair(program, breakpoints));
});
exports.write_file = (path, content) => __awaiter(this, void 0, void 0, function* () {
    let _error = exports.mk_none();
    yield fs.writeFile(path, content).catch((e) => _error = exports.mk_some(e));
    return _error;
});
exports.push_last_page = (mem_trace) => {
    let last_mem = mem_trace.last();
    if (last_mem.breakpoint_info.line != last_mem.source.split("\n").length) {
        return mem_trace.push(Object.assign({}, mem_trace.last(), { breakpoint_info: { column: 1, line: last_mem.source.split("\n").length }, stack: Immutable.Map(), heap: Immutable.Map(), globals: Immutable.Map() })).toList();
    }
    return mem_trace;
};
//# sourceMappingURL=utils.js.map