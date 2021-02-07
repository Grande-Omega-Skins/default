"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
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
const Immutable = require("immutable");
const testSetup = require("./testSetup");
const utils_1 = require("../../../utils");
const memory_1 = require("../../../memory");
exports.TIMEOUT_ADAPTER = 20000;
let print_variables = (frames_vs, language = "python", verbose = false) => {
    frames_vs.forEach((frame_vs, i) => {
        // console.log(`Frame ${i}`)
        frame_vs.forEach(vs => {
            // if(!vs.success)
            //     console.log(`Error while getting variables: ${vs.message}`)
            let res = "";
            switch (language) {
                case "python":
                    res =
                        vs.body.variables.filter(v => !v.name.startsWith("__"))
                            .map(v => `${v.name}: ${v.value}`)
                            .join(",\n");
                    break;
            }
            // console.log("\n\n---------------------")
            // console.log("Variables:")
            // console.log(res)
            // console.log("---------------------\n")
            // if(verbose){
            //     console.log("\n\n---------------------")
            //     console.log("Variables (verbose):")
            //     console.log(JSON.stringify(vs))
            //     console.log("---------------------\n")
            // }
        });
    });
};
let debugClient = "none";
// console.log("dirname:", __dirname)
//C:\GIT\GrandeOmega_mk2\desktop
const file_name = "file.js";
let mk_val = (val, ref, memory, is_function) => {
    if (is_function) {
        return utils_1.mk_pair({ kind: "string", val: "function" }, memory);
    }
    if (ref > 0) {
        let res = memory.get_heap_address(`${is_function ? ref : val}`);
        return utils_1.mk_pair({ kind: "ref", val: res.fst }, res.snd);
    }
    if (!val.match(/^-?[0-9]+(\.[0-9]*)?$/)) {
        if (val.startsWith("\"") && val.endsWith("\"") ||
            val.startsWith("'") && val.endsWith("'")) {
            return utils_1.mk_pair({ kind: "string", val: val }, memory);
        }
        else {
            if (val == "True" || val == "False") {
                return utils_1.mk_pair({ kind: "bool", val: val == "True" }, memory);
            }
            else {
                return utils_1.mk_pair({ kind: "string", val: val }, memory);
            }
        }
    }
    else {
        return utils_1.mk_pair({ kind: "number", val: +val }, memory);
    }
};
//javascript
let try_lambda = (v, memory, frame_index, visited_refs) => __awaiter(this, void 0, void 0, function* () {
    if (v.type && v.type.toLowerCase() == "function" && debugClient != "none") {
        let variablesReference = v.variablesReference;
        let variables_responce = yield debugClient.variablesRequest({ variablesReference });
        let lambda_info = {
            free_vars: Immutable.Map(),
            args: Immutable.List(),
            code: "feature not made yet"
        };
        let variables = Immutable.Map();
        variables_responce.body.variables.forEach(v => {
            variables = variables.set(v.name, v);
        });
        //console.log("variables:", variables)
        if (variables.has("[[Scopes]]")) {
            // let res = memory.get_heap_address(`${variablesReference}`)
            // memory = res.snd.update({kind:"heap", ref:res.fst, class_name: "lambda", val:"make_ref" })
            //let func_code = await debugClient.variablesRequest({ variablesReference:variables.get("func_code").variablesReference })
            //load closure
            if (variables.get("[[Scopes]]").value != "None") {
                let func_closure = yield debugClient.variablesRequest({ variablesReference: variables.get("[[Scopes]]").variablesReference });
                let closure_vals = Immutable.List();
                func_closure.body.variables.forEach(v => {
                    variables = variables.set(v.name, v);
                });
                for (let __cell of func_closure.body.variables) {
                    if (__cell.variablesReference > 0) {
                        let scope_vals = yield debugClient.variablesRequest({ variablesReference: __cell.variablesReference });
                        for (let _cell of scope_vals.body.variables) {
                            {
                                if (scope_vals.body.variables.every(e => e.name.toLowerCase() != "object" &&
                                    e.name != "Boolean" &&
                                    e.name != "Buffer" &&
                                    e.name != "adjustOffset")) {
                                    if (_cell.name != "kGroupIndent" &&
                                        _cell.name != "util" &&
                                        _cell.name != "noop" &&
                                        _cell.name != "createWriteErrorHandler" &&
                                        _cell.name != "errors" &&
                                        _cell.name != "createWritableStdioStream" &&
                                        _cell.name != "kCounts" &&
                                        _cell.name != "Console" &&
                                        _cell.name != "kGroupIndent" &&
                                        _cell.name != "root" &&
                                        _cell.name != "set" &&
                                        _cell.name != "RegExp" &&
                                        _cell.name != "ArrayBuffer" &&
                                        _cell.name != "Atomix" &&
                                        _cell.name != "write") {
                                        //let cell = await debugClient.variablesRequest({ variablesReference: _cell.variablesReference })
                                        // console.log("cell: ",_cell)
                                        if (_cell.variablesReference == 0) {
                                            let cell_val_mem = mk_val(_cell.value, _cell.variablesReference, memory, false);
                                            memory = cell_val_mem.snd;
                                            memory = memory.update({ kind: "closure", val_name: _cell.name, val_content: cell_val_mem.fst });
                                        }
                                        //improve: make it recursive
                                        //it is ref so we traverse it
                                        // if(_cell.variablesReference > 0){
                                        //     let res = memory.get_heap_address(_cell.value)
                                        //     let regex = '\.(.*?)\ '
                                        //     let _str = _cell.value.match(regex)
                                        //     console.log("no name", JSON.stringify(_cell))
                                        //     let class_name = _str ? _str.length >= 1 ? _str[1].substr(_str[1].indexOf(".") + 1) : _cell.value : _cell.value
                                        //     if(_cell.type && _cell.type.toLowerCase() == "function"){
                                        //         class_name = "lambda"
                                        //     }
                                        //     memory = res.snd.update({kind:"heap", ref:res.fst, class_name: class_name, val:"make_ref" })
                                        //     if(!visited_refs.has(res.fst)){
                                        //         visited_refs = visited_refs.add(res.fst)
                                        //         //memory = await traverse_structured_variables(_cell.variablesReference, res.fst, memory, frame_index, visited_refs)
                                        //     }
                                        //     else{
                                        //         console.log("already visited")
                                        //     }
                                        // }
                                        // let cell_val_mem = mk_val(_cell.value, _cell.variablesReference, memory)
                                        // memory = cell_val_mem.snd
                                        // lambda_info = {...lambda_info, free_vars: lambda_info.free_vars.set(_cell.name, cell_val_mem.fst)}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        //     let closure_vals_arr = closure_vals.toArray()
        //     // for(let _code of func_code.body.variables){
        //             // if(_code.name == "co_filename"){
        //             //     //check on different OS
        //             //     let program = await fs.readFile(_code.value.replace(/'/g, ""));
        //             //     let line = func_code.body.variables.find(v => v.name == "co_firstlineno").value
        //             //     let program_split = program.toString().split("\n")
        //             //     let lambda_line = program_split[+line - 1]
        //             //     lambda_info = {...lambda_info, code: lambda_line}
        //             // }
        //             // if(_code.name == "co_freevars"){
        //             //     let var_names_ref = await debugClient.variablesRequest({ variablesReference:_code.variablesReference })
        //             //     var_names_ref.body.variables.forEach((free_var, i) => {
        //             //         lambda_info = {...lambda_info, free_vars: lambda_info.free_vars.set(free_var.value, closure_vals_arr[i])}
        //             // })
        //         // }
        //     }
        // }
        //load args
        // for(let _code of func_code.body.variables){
        //     if(_code.name == "co_varnames" && _code.value != "()"){
        //         let arg_names_ref = await debugClient.variablesRequest({ variablesReference:_code.variablesReference })
        //         arg_names_ref.body.variables.forEach((arg, i) => {
        //             lambda_info = {...lambda_info, args: lambda_info.args.push(arg.value)}
        //         })
        //     }
        // }
        // console.log("returning memory", memory)
        return memory;
    }
    return "nothing";
});
let traverse_variables_response = (variables_responce, memory, frame_index, visited_refs, ref = "none") => __awaiter(this, void 0, void 0, function* () {
    for (let variable of variables_responce.body.variables
        .filter(v => !v.name.startsWith("module") &&
        !v.name.startsWith("exports") &&
        !v.name.startsWith("__") &&
        !v.name.startsWith("require") &&
        !v.value.includes("bound") &&
        !v.value.includes("global") &&
        !v.name.includes("Return value") &&
        !v.value.includes("class"))) {
        //test lambda do lambda
        let lambda_test_res = yield try_lambda(variable, memory, frame_index, visited_refs);
        if (lambda_test_res != "nothing") {
            memory = lambda_test_res;
        }
        // console.log(JSON.stringify(variable), lambda_test_res == "nothing")
        if (!variable.name.startsWith("_") && !variable.name.startsWith("Symbol(")) {
            //it is ref so we traverse it
            if (lambda_test_res == "nothing" && variable.variablesReference > 0 && variable.type && variable.type.toLowerCase() != "function") {
                let res = memory.get_heap_address(variable.value);
                // console.log("no_name", variable.value)
                let regex = '(.*?)\ ';
                let _str = variable.value.match(regex);
                let class_name = _str ? _str.length >= 1 ? _str[1].substr(_str[1].indexOf(".") + 1) : variable.value : variable.value;
                memory = res.snd.update({ kind: "heap", ref: res.fst, class_name: class_name, val: "make_ref" });
                if (!visited_refs.has(res.fst)) {
                    memory = yield traverse_structured_variables(variable.variablesReference, res.fst, memory, frame_index, visited_refs.add(res.fst));
                }
            }
            if (ref != "none") {
                let res = mk_val(variable.value, variable.variablesReference, memory, variable.type && variable.type.toLowerCase() == "function");
                memory = res.snd.update({ kind: "heap", ref: ref, class_name: "update_ref", val: { att_name: variable.name, val_content: res.fst } });
            }
            else {
                if (frame_index == 0) {
                    let res = mk_val(variable.value, variable.variablesReference, memory, variable.type && variable.type.toLowerCase() == "function");
                    // console.log("GLOBALS:", JSON.stringify([variable.name, res.fst]))
                    memory = res.snd.update({ kind: "globals", val_name: variable.name, val_content: res.fst });
                }
                else {
                    let res = mk_val(variable.value, variable.variablesReference, memory, variable.type && variable.type.toLowerCase() == "function");
                    memory = res.snd.update({ kind: "stack", stack_frame: frame_index, val_name: variable.name, val_content: res.fst });
                }
            }
        }
    }
    return memory;
});
let traverse_structured_variables = (variablesReference, ref, memory, frame_index, visited_refs) => __awaiter(this, void 0, void 0, function* () {
    if (debugClient == "none")
        return memory;
    let v = yield debugClient.variablesRequest({ variablesReference });
    return yield traverse_variables_response(v, memory, frame_index, visited_refs, ref);
});
let update_memory = (frames, language = "python", memory) => __awaiter(this, void 0, void 0, function* () {
    let s = Immutable.Set();
    for (let frame of frames.map((f, i) => ({ f: f, i: i }))) {
        for (let variables_response of frame.f) {
            if (!variables_response.success) {
                // console.log(`[update_memory] Error while getting variables: ${variables_response.message}`)
            }
            else {
                // console.log(JSON.stringify(variables_response.body.variables))
                memory = yield traverse_variables_response(variables_response, memory, frames.length - frame.i - 1, s);
            }
        }
    }
    return memory;
});
let get_variables = (stackTraceResponse, language = "python") => __awaiter(this, void 0, void 0, function* () {
    if (debugClient == "none")
        return [];
    // console.log("get_variables", stackTraceResponse.body.stackFrames)
    let vars = yield Promise.all(stackTraceResponse.body.stackFrames
        .filter((sf, i) => {
        return debugClient != "none" && sf.source && sf.source.path && path.basename(sf.source.path) == file_name;
    })
        .map((frame) => __awaiter(this, void 0, void 0, function* () {
        if (debugClient == "none")
            return [];
        let scopes;
        try {
            scopes = yield debugClient.scopesRequest({ frameId: frame.id });
        }
        catch (e) {
            return [];
        }
        return yield Promise.all(scopes.body.scopes
            .filter((sf, i) => {
            // console.log("sf: ", sf.name, sf)
            return !sf.expensive && (sf.name == "Local" || sf.name == "Closure");
            return i == 0;
        })
            .map((scope, i) => __awaiter(this, void 0, void 0, function* () {
            if (debugClient == "none")
                return undefined;
            let variablesReference = scope.variablesReference;
            let v = yield debugClient.variablesRequest({ variablesReference });
            return utils_1.mk_pair(v, scope.name);
        })));
    })));
    // console.log("vars: ", vars)
    return vars.filter(e => e.length > 0).map(e => e.filter(e => {
        if (debugClient == "none")
            return true;
        if (language == "php" && e.snd == "Superglobals")
            return false;
        return true;
    }).map(e => e.fst));
});
let trace = [];
function run(get_program, get_breakpoints, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        trace = [];
        require('events').EventEmitter.defaultMaxListeners = 15;
        let init_program = yield utils_1.init_program_input(get_program, get_breakpoints);
        if (init_program.kind == "left")
            return { kind: "error", message: [init_program.value], accumulated_val: Immutable.List() };
        const lowercaseDriveLetterDirname = __dirname.charAt(0).toLowerCase() + __dirname.substr(1);
        const TEST_FILE_PATH = path.join(lowercaseDriveLetterDirname, 'wwwroot', 'js', 'adapters', 'javascript', 'out', 'src');
        // console.log(TEST_FILE_PATH)
        let file_path = path.join(TEST_FILE_PATH, file_name);
        // console.log("path:", file_path)
        let file_same_res = yield utils_1.write_file(file_path, init_program.value.fst);
        if (file_same_res.kind == "some")
            return { kind: "error", message: [file_same_res.value.message], accumulated_val: Immutable.List() };
        if (debugClient && debugClient != "none") {
            yield debugClient.stop();
            debugClient = "none";
        }
        debugClient = yield testSetup.setup();
        debugClient.defaultTimeout = exports.TIMEOUT_ADAPTER;
        yield debugClient.start();
        let error = false;
        debugClient.addListener('output', function (event) {
            // If console.log event statement is executed, pass the test
            let output = event.body.output;
            if (event.body.category === 'stdout' && output.includes("SyntaxError") && !output.includes("this.SyntaxError.prototype")) {
                if (trace.every(e => e != "SyntaxError")) {
                    trace = trace.concat("SyntaxError");
                }
                error = true;
            }
        });
        // const PROGRAM = path.join(DATA_ROOT, PROGRAM_FILE);
        // const info = { path: PROGRAM, breackpoints:[{line: 5},
        //                                             {line: 13},
        //                                             {line: 25},
        //                                             {line: 30}] };
        const info = { path: file_path, breackpoints: init_program.value.snd.map(e => ({ line: e.line })) };
        // console.log("info: ", info)
        let stop_test_error = false;
        let test_error_AUX = () => new Promise((_, reject) => {
            let f = () => {
                if (stop_test_error)
                    return;
                if (error) {
                    return reject("error");
                }
                else {
                    return setTimeout(f, 1000);
                }
            };
            return setTimeout(f, 1000);
        });
        let test_error = () => {
            stop_test_error = false;
            return test_error_AUX();
        };
        let go = 0;
        yield Promise.all([
            debugClient.configurationSequence()
                .then(_ => {
                go++;
                if (go == 2)
                    throw "continue";
            }),
            debugClient.launch({ program: info.path, stopOnEntry: true })
                .then(_ => {
                go++;
                if (go == 2)
                    throw "continue";
            }),
            test_error(),
            stop.then(_ => {
                error = true;
                throw "user stop";
            })
        ]).catch(_ => { });
        stop_test_error = true;
        if (!error) {
            yield debugClient.setBreakpointsRequest({
                breakpoints: info.breackpoints,
                source: { path: info.path }
            });
        }
        let current_bp = null;
        let mem_trace = Immutable.List();
        let memory = memory_1.mk_memory(init_program.value.fst, { column: -1, line: -1 });
        mem_trace = mem_trace.push(memory);
        let wait_event = debugClient.waitForEvent('terminated');
        let _test_error = test_error();
        // try hit all breakpoints
        var terminated = false;
        while (!terminated && !error) {
            // let stackTraceRequest : DebugProtocol.StackTraceResponse
            let promises = [
                wait_event.then(_ => {
                    terminated = true;
                    // console.log("terminated!")
                    throw "continue";
                }),
                debugClient.continueRequest().catch(e => { } // console.log("continue error")
                ),
                debugClient.assertStoppedLocation("breakpoint", {})
                    //in case of hit we throw a continue error to force the promise.all
                    //to stop otherwise the error handlers will lock the cotinuation
                    .then(e => {
                    current_bp = { line: e.body.stackFrames[0].line, column: e.body.stackFrames[0].column };
                    //stackTraceRequest = e;
                    throw "continue";
                })
                    .catch(e => { if (e == "continue")
                    throw "continue";
                else
                    throw "error"; }),
                _test_error.then(_ => { })
                    .catch(_ => { }),
                stop.then(_ => {
                    error = true;
                    throw "user stop";
                })
            ];
            yield Promise.all(promises)
                .catch(e => {
                //if e!="continue" then its an error coming
                //from one of the error event handlers
                if (e != "continue") {
                    error = true;
                }
            });
            stop_test_error = true;
            if (!error && !terminated) {
                //console.log("no err...")
                memory = Object.assign({}, memory_1.mk_memory(init_program.value.fst, current_bp), { __internal_heap_ref_map: memory.__internal_heap_ref_map });
                let stackTraceRequest = yield debugClient.stackTraceRequest();
                let vs = yield get_variables(stackTraceRequest);
                // print_variables(vs, "python")
                memory = yield update_memory(vs, "php", memory);
                mem_trace = mem_trace.push(memory);
                // memory.pretty_print()
            }
        }
        if (terminated) {
            yield debugClient.stop();
            // console.log("done!")
            return { kind: "done", value: utils_1.push_last_page(mem_trace) };
        }
        //there are no more breakpoints to process or the program crashed
        if (!error) {
            // wait normal termination
            yield Promise.all([
                debugClient.continueRequest(),
                debugClient.waitForEvent('terminated')
            ]);
            // console.log("done!")
            yield debugClient.stop();
            // console.log("done!")
            return { kind: "done", value: utils_1.push_last_page(mem_trace) };
        }
        else {
            yield new Promise((res, rej) => {
                setTimeout(() => { res("done"); }, 2000);
            });
            yield debugClient.stop();
            return { kind: "error", message: trace, accumulated_val: mem_trace };
        }
    });
}
exports.run = run;
//# sourceMappingURL=main.js.map