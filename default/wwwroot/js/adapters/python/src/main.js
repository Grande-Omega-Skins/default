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
const constants_1 = require("./client/common/platform/constants");
const linux_shell = require("shelljs");
const win_shell = require("node-powershell");
const fs = require("fs-extra");
const constants_2 = require("./client/debugger/Common/constants");
const PYTHON_PATH = function getPythonPath() {
    if (process.env.CI_PYTHON_PATH && fs.existsSync(process.env.CI_PYTHON_PATH)) {
        return process.env.CI_PYTHON_PATH;
    }
    return 'python';
}();
exports.TIMEOUT_ADAPTER = 20000;
const path = require("path");
const debugClient_1 = require("vscode-debugadapter-testsupport/lib/debugClient");
const Contracts_1 = require("./client/debugger/Common/Contracts");
const memory_1 = require("../../memory");
const utils_1 = require("../../utils");
const DEBUG_INTERNALS = false;
console.log("dirname:", __dirname);
//C:\GIT\GrandeOmega_mk2\desktop
const TEST_FILE_PATH = path.join(__dirname, 'wwwroot', 'js', 'adapters', 'python', 'src');
const DEBUG_ADAPTER = path.join(__dirname, 'wwwroot', 'js', 'adapters', 'python', 'src', 'client', 'debugger', 'Main.js');
//const debugFilesPath = path.join(__dirname,'wwwroot', 'js', 'adapters', 'python', 'src', 'test', 'pythonFiles', 'debugging');
const debugAdapterFileName = path.basename(DEBUG_ADAPTER);
console.log("##################", __dirname, PYTHON_PATH, DEBUG_ADAPTER, TEST_FILE_PATH);
const debuggerType = debugAdapterFileName === 'Main.js' ? 'python' : 'pythonExperimental';
function buildLaunchArgs(pythonFile, stopOnEntry) {
    const env = debuggerType === 'pythonExperimental' ? { PYTHONPATH: constants_2.PTVSD_PATH } : {};
    const options = {
        program: path.join(TEST_FILE_PATH, pythonFile),
        cwd: TEST_FILE_PATH,
        stopOnEntry: stopOnEntry,
        debugOptions: [Contracts_1.DebugOptions.RedirectOutput],
        pythonPath: PYTHON_PATH,
        args: [],
        env,
        envFile: '',
        logToFile: false,
        type: debuggerType
    };
    return options;
}
function createDebugAdapter() {
    // if (IS_WINDOWS) {
    return new debugClient_1.DebugClient('node', DEBUG_ADAPTER, debuggerType);
    // } else {
    //     const coverageDirectory = path.join(EXTENSION_ROOT_DIR, `debug_coverage${testCounter += 1}`);
    //     return new DebugClientEx(DEBUG_ADAPTER, debuggerType, coverageDirectory, { cwd: EXTENSION_ROOT_DIR });
    // }
}
let debugClient = "none";
let print_variables = (frames_vs, language = "python", verbose = false) => {
    frames_vs.forEach((frame_vs, i) => {
        console.log(`Frame ${i}`);
        frame_vs.forEach(vs => {
            if (!vs.success)
                console.log(`Error while getting variables: ${vs.message}`);
            let res = "";
            switch (language) {
                case "python":
                    res =
                        vs.body.variables.filter(v => !v.name.startsWith("__"))
                            .map(v => `${v.name}: ${v.value}`)
                            .join(",\n");
                    break;
            }
            console.log("\n\n---------------------");
            console.log("Variables:");
            console.log(res);
            console.log("---------------------\n");
            if (verbose || DEBUG_INTERNALS) {
                console.log("\n\n---------------------");
                console.log("Variables (verbose):");
                console.log(JSON.stringify(vs));
                console.log("---------------------\n");
            }
        });
    });
};
//python
let try_lambda = (v, memory, frame_index, visited_refs) => __awaiter(this, void 0, void 0, function* () {
    if (v.value.includes("<function") && v.variablesReference > 0) {
        if (debugClient == "none")
            return;
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
        if (variables.has("func_name") && variables.get("func_name").value.includes("<lambda>")) {
            let res = memory.get_heap_address(v.value);
            memory = res.snd.update({ kind: "heap", ref: res.fst, class_name: "lambda", val: "make_ref" });
            let func_code = yield debugClient.variablesRequest({ variablesReference: variables.get("func_code").variablesReference });
            //load closure
            if (variables.get("func_closure").value != "None") {
                let func_closure = yield debugClient.variablesRequest({ variablesReference: variables.get("func_closure").variablesReference });
                let closure_vals = Immutable.List();
                for (let _cell of func_closure.body.variables) {
                    let cell = yield debugClient.variablesRequest({ variablesReference: _cell.variablesReference });
                    //improve: make it recursive
                    let variable = cell.body.variables[0];
                    //it is ref so we traverse it
                    if (variable.variablesReference > 0) {
                        let res = memory.get_heap_address(variable.value);
                        let regex = '\.(.*?)\ ';
                        let _str = variable.value.match(regex);
                        let class_name = _str ? _str.length >= 1 ? _str[1].substr(_str[1].indexOf(".") + 1) : "no_name" : "no_name";
                        memory = res.snd.update({ kind: "heap", ref: res.fst, class_name: class_name, val: "make_ref" });
                        if (!visited_refs.has(res.fst)) {
                            memory = yield traverse_structured_variables(variable.variablesReference, res.fst, memory, frame_index, visited_refs.add(res.fst));
                        }
                    }
                    let cell_val_mem = mk_val(variable.value, variable.variablesReference > 0, memory);
                    memory = cell_val_mem.snd;
                    closure_vals = closure_vals.push(cell_val_mem.fst);
                }
                let closure_vals_arr = closure_vals.toArray();
                for (let _code of func_code.body.variables) {
                    if (_code.name == "co_filename") {
                        //check on different OS
                        let program = yield fs.readFile(_code.value.replace(/'/g, ""));
                        let line = func_code.body.variables.find(v => v.name == "co_firstlineno").value;
                        let program_split = program.toString().split("\n");
                        let lambda_line = program_split[+line - 1];
                        lambda_info = Object.assign({}, lambda_info, { code: lambda_line });
                    }
                    if (_code.name == "co_freevars") {
                        let var_names_ref = yield debugClient.variablesRequest({ variablesReference: _code.variablesReference });
                        var_names_ref.body.variables.forEach((free_var, i) => {
                            lambda_info = Object.assign({}, lambda_info, { free_vars: lambda_info.free_vars.set(free_var.value, closure_vals_arr[i]) });
                        });
                    }
                }
            }
            //load args
            for (let _code of func_code.body.variables) {
                if (_code.name == "co_varnames" && _code.value != "()") {
                    let arg_names_ref = yield debugClient.variablesRequest({ variablesReference: _code.variablesReference });
                    arg_names_ref.body.variables.forEach((arg, i) => {
                        lambda_info = Object.assign({}, lambda_info, { args: lambda_info.args.push(arg.value) });
                    });
                }
            }
            memory = memory.update({ kind: "heap", ref: res.fst, class_name: "update_ref", val: { att_name: "info", val_content: { kind: "closure", val: lambda_info } } });
            return memory;
        }
    }
    return "nothing";
});
let mk_val = (val, is_ref, memory, is_function = false) => {
    if (is_function) {
        return utils_1.mk_pair({ kind: "string", val: "function" }, memory);
    }
    if (is_ref) {
        let res = memory.get_heap_address(val);
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
let traverse_variables_response = (variables_responce, memory, frame_index, visited_refs, ref = "none") => __awaiter(this, void 0, void 0, function* () {
    for (let variable of variables_responce.body.variables
        .filter(v => !v.name.startsWith("__") &&
        !v.name.includes("()") &&
        !v.value.includes("(built-in)") &&
        !v.value.includes("inspect") &&
        !v.value.includes("class"))) {
        variable.name = variable.name.startsWith("['") && variable.name.endsWith("']")
            ? variable.name.replace("['", "").replace("']", "")
            : variable.name;
        //test lambda do lambda
        let lambda_test_res = yield try_lambda(variable, memory, frame_index, visited_refs);
        if (lambda_test_res != "nothing") {
            memory = lambda_test_res;
        }
        if (lambda_test_res == "nothing") {
            //it is ref so we traverse it
            // console.log(variable.name, variable, visited_refs)
            if (lambda_test_res == "nothing" && variable.variablesReference > 0) {
                let res = memory.get_heap_address(variable.value);
                let regex = '\.(.*?)\ ';
                let _str = variable.value.match(regex);
                let class_name = _str ? _str.length >= 1 ? _str[1].substr(_str[1].indexOf(".") + 1) : "_" : "_";
                class_name = class_name.startsWith("'") && (class_name.endsWith(":") || class_name.endsWith(",")) ? "_" : class_name;
                memory = res.snd.update({ kind: "heap", ref: res.fst, class_name: class_name, val: "make_ref" });
                if (!visited_refs.has(res.fst)) {
                    memory = yield traverse_structured_variables(variable.variablesReference, res.fst, memory, frame_index, visited_refs.add(res.fst));
                }
            }
            // if(ref != "none"){
            //     let res = mk_val(variable.value, variable.variablesReference > 0, memory)
            //     memory = res.snd.update({kind:"heap", ref:ref, class_name: "update_ref", val:{att_name:variable.name, val_content:res.fst} })
            // }
            if (ref != "none") {
                let res = mk_val(variable.value, variable.variablesReference > 0, memory, false); //, variable.value.includes("<function") && variable.variablesReference > 0)
                memory = res.snd.update({ kind: "heap", ref: ref, class_name: "update_ref", val: { att_name: variable.name, val_content: res.fst } });
            }
            else {
                if (frame_index == 0) {
                    let res = mk_val(variable.value, variable.variablesReference > 0, memory);
                    memory = res.snd.update({ kind: "globals", val_name: variable.name, val_content: res.fst });
                }
                else {
                    let res = mk_val(variable.value, variable.variablesReference > 0, memory);
                    memory = res.snd.update({ kind: "stack", stack_frame: frame_index, val_name: variable.name, val_content: res.fst });
                }
            }
        }
    }
    return memory;
});
let traverse_structured_variables = (variablesReference, ref, memory, frame_index, visited_refs) => __awaiter(this, void 0, void 0, function* () {
    if (debugClient == "none")
        return;
    let v = yield debugClient.variablesRequest({ variablesReference });
    return yield traverse_variables_response(v, memory, frame_index, visited_refs, ref);
});
let update_memory = (frames, language = "python", memory) => __awaiter(this, void 0, void 0, function* () {
    let s = Immutable.Set();
    for (let frame of frames.map((f, i) => ({ f: f, i: i }))) {
        for (let variables_response of frame.f) {
            if (!variables_response.success) {
                console.log(`[update_memory] Error while getting variables: ${variables_response.message}`);
            }
            else {
                memory = yield traverse_variables_response(variables_response, memory, frames.length - frame.i - 1, s);
            }
        }
    }
    return memory;
});
let print_info = (info, title) => {
    if (!DEBUG_INTERNALS)
        return;
    console.log("\n\n------------------------");
    console.log(`${title}: `);
    console.log(JSON.stringify(info));
    console.log("------------------------\n\n");
};
let get_variables = (stackTraceResponse, language = "python") => __awaiter(this, void 0, void 0, function* () {
    if (debugClient == "none")
        return;
    print_info(stackTraceResponse.body.stackFrames, "Stack frames");
    let vars = yield Promise.all(stackTraceResponse.body.stackFrames.map((frame) => __awaiter(this, void 0, void 0, function* () {
        if (debugClient == "none")
            return;
        let scopes = yield debugClient.scopesRequest({ frameId: frame.id });
        //print_info(scopes, "Scopes")
        return yield Promise.all(scopes.body.scopes.map((scope) => __awaiter(this, void 0, void 0, function* () {
            if (debugClient == "none")
                return;
            const variablesReference = scope.variablesReference;
            let v = yield debugClient.variablesRequest({ variablesReference });
            return utils_1.mk_pair(v, scope.name);
        })));
    })));
    return vars.map(e => e.filter(e => {
        if (language == "php" && e.snd == "Superglobals")
            return false;
        return true;
    }).map(e => e.fst));
});
let trace = [];
function onGenericError() {
    return new Promise((ok, reject) => {
        if (debugClient == "none")
            return;
        debugClient.on('output', (event) => {
            if ((event.event === 'output' &&
                event.body.category === 'stderr') ||
                (event.event === 'output' &&
                    event.body.category === 'stdout')) {
                if (trace.every(e => e != event.body.output)) {
                    let str = event.body.output;
                    if (event.body.output.toLowerCase().includes("file.py")) {
                        let str_split = str.split("file.py");
                        if (str_split.length > 1) {
                            str_split = str_split[1].split(",");
                            if (str_split.length > 1) {
                                str = str_split[1];
                            }
                        }
                    }
                    trace = trace.concat(str);
                }
                if (event.body.output.toLowerCase().includes("error") || event.body.category === 'stderr') {
                    console.log(event.body);
                    reject((event.body.line == undefined ? `` : `[${event.body.line}, `) +
                        (event.body.line == undefined ? `` : `${event.body.column}] `) +
                        event.body.output);
                }
            }
        });
    });
}
function onTerminated() {
    return new Promise((_, reject) => {
        if (debugClient == "none")
            return;
        debugClient.once('terminated', (event) => {
            reject("unexpected termination");
        });
    });
}
function onException() {
    return new Promise((_, reject) => {
        if (debugClient == "none")
            return;
        debugClient.once('exception', (event) => {
            if (event.body.reason === 'exception' &&
                event.body.text && event.body.text.startsWith('AssertionError')) {
                reject(event.body.text);
            }
        });
    });
}
let file_suffix = 0;
let file_suffix_counter = 0;
function run(get_program, get_breakpoints, stop) {
    return __awaiter(this, void 0, void 0, function* () {
        file_suffix_counter += 1;
        file_suffix = file_suffix_counter % 20;
        trace = [];
        let init_program = yield utils_1.init_program_input(get_program, get_breakpoints);
        if (init_program.kind == "left")
            return { kind: "error", message: [init_program.value], accumulated_val: Immutable.List() };
        let file_name = `file${file_suffix}.py`;
        let file_path = path.join(TEST_FILE_PATH, file_name);
        let rmPyFilesInDir = function (dirPath, removeSelf) {
            if (removeSelf === undefined)
                removeSelf = true;
            try {
                var files = fs.readdirSync(dirPath);
            }
            catch (e) {
                return;
            }
            if (files.length > 0)
                for (var i = 0; i < files.length; i++) {
                    var filePath = path.join(dirPath, files[i]);
                    if (files[i].endsWith(".py")) {
                        fs.unlinkSync(filePath);
                    }
                }
            if (removeSelf)
                fs.rmdirSync(dirPath);
        };
        // console.log("removing dir", DATA_ROOT)
        rmPyFilesInDir(TEST_FILE_PATH, false);
        if (constants_1.IS_WINDOWS) {
            console.log("Found windows");
            let ps = new win_shell({
                executionPolicy: 'Bypass',
                noProfile: true
            });
            ps.addCommand("taskkill /f /im  python.exe");
            yield ps.invoke().catch((error) => {
                console.warn(error);
            });
            yield ps.dispose().catch(_ => { });
        }
        else {
            console.log("Found linux or mac");
            let nodePath = (linux_shell.which('node').toString());
            if (nodePath == null)
                nodePath = (linux_shell.which('nodejs').toString());
            linux_shell.config.execPath = nodePath;
            let res0 = linux_shell.exec(`killall python`, { async: true });
        }
        let file_same_res = yield utils_1.write_file(file_path, init_program.value.fst);
        if (file_same_res.kind == "some")
            return { kind: "error", message: [file_same_res.value.message], accumulated_val: Immutable.List() };
        console.log("...");
        if (debugClient && debugClient != "none") {
            console.log("listener on...c");
            debugClient.removeAllListeners();
            yield Promise.race([
                new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
                    if (debugClient == "none")
                        return;
                    yield debugClient.stop().catch(_ => { });
                    yield debugClient.disconnectRequest().catch(_ => { });
                    yield new Promise(resolve => setTimeout(resolve, 1000));
                    res();
                })),
                new Promise(resolve => setTimeout(resolve, 5000))
            ]);
            debugClient = "none";
        }
        debugClient = createDebugAdapter();
        debugClient.defaultTimeout = exports.TIMEOUT_ADAPTER;
        yield debugClient.start();
        console.log("started");
        const threadIdPromise = debugClient.waitForEvent('thread');
        let error = false;
        yield Promise.all([
            debugClient.configurationSequence(),
            stop.then(_ => {
                error = true;
                throw "user stop";
            }),
            debugClient.launch(buildLaunchArgs(file_name, true)).then(_ => console.log("launch")),
            debugClient.waitForEvent('initialized').then(_ => { throw "continue"; }),
            onGenericError().catch(_ => { error = true; throw "exit"; })
        ]).catch(_ => { });
        const info = { path: file_path, breackpoints: init_program.value.snd };
        yield debugClient.setBreakpointsRequest({
            lines: info.breackpoints.map(e => e.line),
            breakpoints: info.breackpoints,
            source: { path: info.path }
        });
        const threadId = (yield threadIdPromise).body.threadId;
        let mem_trace = Immutable.List();
        let memory = memory_1.mk_memory(init_program.value.fst, { column: -1, line: -1 });
        mem_trace = mem_trace.push(memory);
        let current_bp = null;
        // try hit all breakpoints
        var terminated = false;
        let _onGenericError = onGenericError();
        let _onTerminated = onTerminated();
        while (!terminated && !error) {
            let stackTraceRequest;
            let promises = [
                debugClient.continueRequest({ threadId }),
                !error && debugClient.assertStoppedLocation("breakpoint", {})
                    //in case of hit we throw a continue error to force the promise.all 
                    //to stop otherwise the error handlers will lock the cotinuation
                    .then((e) => __awaiter(this, void 0, void 0, function* () {
                    if (debugClient == "none")
                        return;
                    if (error)
                        return;
                    //console.log("yes!", e, e.body.stackFrames[0].line)
                    current_bp = { line: e.body.stackFrames[0].line, column: e.body.stackFrames[0].column };
                    stackTraceRequest = yield debugClient.stackTraceRequest({ threadId });
                    throw "continue";
                }))
                    .catch(e => { if (e == "continue")
                    throw "continue";
                else
                    null; }),
                //these error events handler throw error when hit
                _onGenericError,
                _onTerminated
                    .catch(_ => {
                    terminated = true;
                    throw "continue";
                })
                    .then(_ => {
                    terminated = true;
                    throw "continue";
                }),
                stop.then(_ => {
                    console.log("terminating!");
                    error = true;
                    throw "user stop";
                })
            ];
            yield Promise.all(promises)
                .catch(e => {
                //if e!="continue" then its an error coming 
                //from one of the error event handlers
                if (e != "continue") {
                    console.log("Error: ", JSON.stringify(e));
                    error = true;
                }
            });
            if (!error && !terminated) {
                memory = Object.assign({}, memory_1.mk_memory(init_program.value.fst, current_bp), { __internal_heap_ref_map: memory.__internal_heap_ref_map });
                debugClient.variablesRequest;
                let vs = yield get_variables(stackTraceRequest);
                //print_variables(vs, "python")    
                memory = yield update_memory(vs, "python", memory);
                mem_trace = mem_trace.push(memory);
                //memory.pretty_print()
            }
        }
        //there are no more breakpoints to process or the program crashed
        if (terminated) {
            yield debugClient.stop();
            return { kind: "done", value: mem_trace };
        }
        if (!error) {
            // wait normal termination
            yield Promise.all([
                debugClient.continueRequest({ threadId }),
                debugClient.waitForEvent('terminated')
            ]);
            yield debugClient.stop();
            return { kind: "done", value: mem_trace };
        }
        else {
            yield new Promise((res, rej) => {
                setTimeout(() => { trace.forEach(e => console.log(e)); res("done"); }, 2000);
            });
            yield debugClient.stop();
            return { kind: "error", message: trace, accumulated_val: mem_trace };
        }
    });
}
exports.run = run;
//# sourceMappingURL=main.js.map