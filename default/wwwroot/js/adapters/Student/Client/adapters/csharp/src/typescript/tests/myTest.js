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
const memory_1 = require("../../../../memory");
const utils_1 = require("../../../../utils");
const Immutable = require("immutable");
const fs = require("fs-extra");
const path = require("path");
const win_shell = require("node-powershell");
const linux_shell = require("shelljs");
const Path = require("path");
const vscode_debugadapter_testsupport_1 = require("vscode-debugadapter-testsupport");
exports.TIMEOUT_ADAPTER = 30000;
exports.IS_WINDOWS = /^win/.test(process.platform);
const PROJECT_ROOT = Path.join(__dirname, 'wwwroot', 'js', 'adapters', 'csharp');
// const TEST_FILE_PATH = path.join(__dirname,'wwwroot', 'js', 'adapters', 'csharp', 'src')
// const DEBUG_ADAPTER = Path.join(PROJECT_ROOT, 'bin/Release/mono-debug.exe'); // "C:\Program Files (x86)\Mono\bin\mono.exe" //
const DEBUG_INTERNALS = false;
function buildLaunchArgs(file, stopOnEntry) {
    const env = "mono";
    const options = {
        program: file,
        // cwd: TEST_FILE_PATH,
        stopOnEntry: true,
        // debugOptions: ["RedirectOutput"],
        // args: [],
        // env,
        // envFile: '',
        // logToFile: false,
        type: "mono"
    };
    return options;
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
    return "nothing";
});
let string_to_number = (s) => {
    switch (s) {
        case "double": return "double";
        case "int": return "int";
        case "float": return "float";
        default: return undefined;
    }
};
let string_to_string_or_char = (s) => {
    switch (s) {
        case "string": return "string";
        case "char": return "char";
        default: return undefined;
    }
};
let mk_val = (val, is_ref, memory, type, variable_reference, is_function = false) => {
    if (val == "(null)") {
        val = "null";
    }
    if (is_function) {
        return utils_1.mk_pair({ kind: "string", val: "function" }, memory);
    }
    if (is_ref) {
        let res = memory.get_heap_address(variable_reference.toString());
        return utils_1.mk_pair({ kind: "ref", val: res.fst }, res.snd);
    }
    if (!val.match(/^-?[0-9]+([\.,][0-9]+)?$/)) {
        if (val.startsWith("\"") && val.endsWith("\"") ||
            val.startsWith("'") && val.endsWith("'")) {
            return utils_1.mk_pair({ kind: "string", val: val, type: string_to_string_or_char(type) }, memory);
        }
        else {
            if (val == null || val == undefined) {
                return utils_1.mk_pair({ kind: "string", val: "", type: "string" }, memory);
            }
            if (val.toLowerCase() == "true" || val.toLowerCase() == "false" || type.toLowerCase() == "bool" || type.toLowerCase() == "boolean") {
                return utils_1.mk_pair({ kind: "bool", val: val.toLowerCase() == "true" }, memory);
            }
            else {
                let v = val;
                if (string_to_string_or_char(type) == "char" || val.endsWith("'")) {
                    v = v.substring(v.indexOf(' ') + 1);
                }
                return utils_1.mk_pair({ kind: "string", val: v, type: string_to_string_or_char(type) }, memory);
            }
        }
    }
    else {
        return utils_1.mk_pair({ kind: "number", val: +(val.replace(",", ".")), type: string_to_number(type) }, memory);
    }
};
let mySplit = function (input, char) {
    var arr = new Array();
    arr[0] = input.substring(0, input.indexOf(char));
    arr[1] = input.substring(input.indexOf(char) + 1);
    return { prefix: arr[0], suffix: arr[1] };
};
let stack_frame_id = 1000;
let traverse_variables_response = (variables_responce, memory, stack_frame_index, visited_refs, parent_name, parent_ref = "none") => __awaiter(this, void 0, void 0, function* () {
    for (let variable of variables_responce.body.variables
        .filter(v => !v.name.includes("()") &&
        !v.value.includes("(built-in)") &&
        !v.value.includes("inspect") &&
        !v.name.includes("IsPublic") &&
        !v.name.includes("IsPrivate") &&
        !v.name.includes("Assembly") &&
        !v.name.includes("FieldType") &&
        !v.name.includes("DeclaringType") &&
        !v.name.includes("Attributes") &&
        !v.name.includes("SpecialName") &&
        !v.name.includes("Security") &&
        !v.name.includes("BySig") &&
        !v.name.includes("IsConstructor") &&
        !v.name.includes("DeclaringType") &&
        !v.name.includes("IsAbstract") &&
        !v.name.includes("Raw View") &&
        !v.name.includes("Parameters") &&
        !v.name.includes("GenericParameters") &&
        !v.name.includes("CallingConvention") &&
        !v.name.includes("CustomAttributes") &&
        !v.name.includes("DeclaredConstructors") &&
        !v.name.includes("BaseType") &&
        !v.name.toLowerCase().includes("non-public") &&
        !v.name.includes("NamedArguments") &&
        !v.name.includes("ScopeName") &&
        !v.name.toLowerCase().includes("static members") &&
        !v.name.includes("MethodImplementationFlags") &&
        !v.name.includes("IsReadOnly") &&
        //extra C# related names
        !v.name.includes("delegate_trampoline") &&
        !v.name.includes("delegates") &&
        !v.name.includes("extra_arg") &&
        !v.name.includes("HasSingleTarget") &&
        !v.name.includes("interp_invoke_impl") &&
        !v.name.includes("interp_method") &&
        !v.name.includes("invoke_impl") &&
        !v.name.includes("method") &&
        !v.name.includes("method_code") &&
        !v.name.includes("method_info") &&
        !v.name.includes("method_is_virtual") &&
        !v.name.includes("method_ptr") &&
        !v.name.includes("original_method_info") &&
        !v.name.includes("m_target") &&
        //
        !v.name.includes("<") &&
        !v.name.includes(">") &&
        !v.name.includes("Method"))) {
        // if(variable.name.includes(" ")){
        // 	console.log(variable)
        // }
        if (variable.name.includes(" ") && variable.name.toLowerCase().includes("system") && variable.name.toLowerCase().includes("ienumerator")) {
            //ok
        }
        else {
            if (variable.name.includes(" ") && variable.name.toLowerCase().includes("system"))
                return;
            if (variable.name.includes(".") && variable.name.toLowerCase().includes("system"))
                return;
            if (variable.name == "this") {
                if (variable.value.startsWith("["))
                    return;
            }
        }
        // variable.name = variable.name.startsWith("['") && variable.name.endsWith("']")
        // 			? variable.name.replace("['", "").replace("']", "")
        // 			: variable.name
        let variable_path = `${parent_name != "" ? (parent_name +
            `${variable.name.startsWith("[") && variable.name.endsWith("]") ? "" : "."}`)
            : ""}${variable.name}`;
        let variable_address = variable.variablesReference.toString();
        let variable_address_num = variable.variablesReference;
        //if variable is a ref we try to get its hash code
        if (variable_address_num > 0 && debugClient != "none") {
            //	console.log("requesting hashcode for: ", variable_path)
            yield debugClient.evaluateRequest({
                expression: `${variable_path} == null ? null : ${variable_path}.GetHashCode()`,
                context: "watch",
                frameId: stack_frame_id
            }).then(res => {
                if (res.body.result == "null" || res.body.result == "\"null\"" || res.body.result == null) {
                    variable.variablesReference = 0;
                    variable.value = "(null)";
                    return;
                }
                variable_address = res.body.result;
                // console.log("result: ", variable_address)
                variable_address_num = Number.parseInt(res.body.result);
            }).catch((e) => __awaiter(this, void 0, void 0, function* () {
                //	console.log("requesting hashcode times x 2 for: ", `${parent_name.split(".")[0]}, "${mySplit(variable_path, ".").suffix}"`)
                if (parent_name == "")
                    return;
                if (debugClient == "none")
                    return; //(${parent_name.split(".")[0]}, "${mySplit(variable_path, ".").suffix}")`)
                if (parent_name.split(".")[0] == undefined || parent_name.split(".")[0] == null)
                    return;
                if (parent_name.split(".")[0].toLowerCase().replace(/ /g, "") == "localvariables")
                    return;
                yield debugClient.evaluateRequest({
                    expression: `global::Global.Closure.getClosure(${parent_name.split(".")[0]}, "${mySplit(variable_path, ".").suffix}")`,
                    context: "watch",
                    frameId: stack_frame_id
                })
                    .then((res) => __awaiter(this, void 0, void 0, function* () {
                    //	 console.log("closure result x2: ", res.body.result)
                    let result = res.body.result;
                    if (result == "[K]K" || result == "\"[K]K\"") {
                        console.warn("-1-1");
                        variable.variablesReference = 0;
                        variable.value = "(null)";
                        return;
                    }
                    result = result.substr(1, result.length - 2); //removes the quotes
                    result = result.replace("[K", "").replace("]K", ""); //removes the []
                    let atts_to_iter = Immutable.List();
                    result.split("!K")
                        .filter(e => e.length > 0)
                        .map((elem, index) => {
                        elem = elem.replace("{K", "").replace("}K", "");
                        let values = elem.split("#K"); //this 654800907 false
                        //		console.log(values)
                        if ( //result.split("!K").filter(e => e.length > 0).length == 1 && 
                        values.length == 2 &&
                            index == 0) { // HashIs 1234
                            variable_address = values[1];
                            // console.log("result 111: ", variable_address)
                            variable_address_num = Number.parseInt(values[1]);
                        }
                        // let _field_name = values[0]
                        // let _hash_code = values[1]
                        // // // console.log("comparing: ", _field_name, variable.name)
                        // if(_field_name==variable.name){
                        // 	variable_address = _hash_code
                        // 	// console.log("result 111: ", variable_address)
                        // 	variable_address_num = Number.parseInt(_hash_code)
                        // }
                    });
                })).catch(e => { console.error(e); });
            }));
        }
        //it the variable is a ref we traverse it
        if (variable.variablesReference > 0) {
            //	console.log("getting variable reference of ", variable_address)
            let parent = memory.get_heap_address(variable_address);
            //	console.log("res:  ", parent)
            let class_name = variable.value;
            if (variable.name == "Target" && debugClient != "none" && !variable.type.toLocaleLowerCase().includes("tuple")) {
                class_name = "closure";
            }
            if (variable.value.startsWith("(") && variable.value.endsWith(")")) {
                class_name = variable.type;
            }
            memory = parent.snd.update({ kind: "heap", ref: parent.fst, class_name: class_name, val: "make_ref" });
            //	console.log("already visited test", parent, visited_refs)
            if (visited_refs.has(parent.fst)) {
                //	console.log("already visited!", parent)
            }
            if (!visited_refs.has(parent.fst)) {
                if (variable.name == "Target" && debugClient != "none" && !variable.type.toLocaleLowerCase().includes("tuple")) {
                    if (parent_ref != "none") {
                        if (variable.value != undefined && variable.value != null) {
                            let variable_ref = mk_val(variable.name, true, memory, "", variable_address_num);
                            if (variable_ref == undefined) {
                                debugger;
                                let variable_ref = mk_val(variable.name, true, memory, "", variable_address_num);
                            }
                            memory = variable_ref.snd.update({ kind: "heap",
                                ref: parent_ref,
                                class_name: "update_ref",
                                val: { att_name: variable.name, val_content: variable_ref.fst } });
                            // if(variable_ref.fst.kind == "ref" && variable_ref.fst.val == 8){
                            // 	console.log(variable_ref, memory)
                            // }
                        }
                    }
                    //	console.log("requesting closure for 3: ", `global::Global.Closure.getClosure(${parent_name.split(".")[0]}, "${mySplit(variable_path, ".").suffix}")`)
                    // let stack_frame_id_address = memory.get_heap_address(stack_frame_id.toString())
                    // memory = stack_frame_id_address.snd
                    yield debugClient.evaluateRequest({
                        expression: `global::Global.Closure.getClosure(${parent_name.split(".")[0]}, "${mySplit(variable_path, ".").suffix}")`,
                        context: "watch",
                        frameId: stack_frame_id
                    })
                        .then((res) => __awaiter(this, void 0, void 0, function* () {
                        //		 console.log("closure result 3: ", res.body.result)
                        let result = res.body.result;
                        if (result == "[K]K" || result == "\"[K]K\"")
                            return;
                        result = result.substr(1, result.length - 2); //removes the quotes
                        result = result.replace("[K", "").replace("]K", ""); //removes the []
                        //example: "[{inc#494047559#false}!{this#654800907#false}]" => {name, hashcode, is_primitive}
                        let atts_to_iter = Immutable.List();
                        result.split("!K")
                            .filter(e => e.length > 0)
                            .map((elem, i) => {
                            if (i == 0)
                                return;
                            elem = elem.replace("{K", "").replace("}K", "");
                            let values = elem.split("#K"); //this 654800907 false
                            let _field_name = values[0];
                            let _hash_code = values[1];
                            let _is_primitive = values[2] == 'true';
                            let _type = _is_primitive ? values[3] : "";
                            let _value = _is_primitive ? values[4] : "";
                            if (variable.value == undefined || variable.value == null || _type == null || _type == undefined)
                                return;
                            let _res = mk_val(_type.toLowerCase() == "string" ? "\"" + _value + "\"" : _value, !_is_primitive, memory, _type, Number.parseInt(_hash_code), false);
                            memory = _res.snd.update({ kind: "heap",
                                ref: parent.fst,
                                class_name: "update_ref",
                                val: { att_name: _field_name, val_content: _res.fst } });
                            //		console.log("setting heap", parent.fst, _res, memory, Number.parseInt(_hash_code))
                            if (_res.fst.kind == "ref" && !_res.snd.heap.has(_res.fst.val)) {
                                //	console.log("Value ref not in heap: ", _field_name, _hash_code, _type, _value, res)
                                atts_to_iter = atts_to_iter.push(_field_name);
                            }
                        });
                        if (debugClient != "none" && atts_to_iter.size > 0) {
                            let vars = yield debugClient.variablesRequest({ variablesReference: variable.variablesReference });
                            let non_public_member = vars.body.variables.filter(e => e.name.toLocaleLowerCase().includes("non-public"))[0];
                            //console.log("traversing over", non_public_member, variable_path)
                            if (non_public_member) {
                                let non_public_member_expanded = yield debugClient.variablesRequest({ variablesReference: non_public_member.variablesReference });
                                let non_public_member_traverse_res = yield traverse_variables_response(non_public_member_expanded, memory, stack_frame_index, visited_refs.add(parent.fst), variable_path, parent.fst);
                                //console.log("vars", non_public_member_expanded)
                                memory = non_public_member_traverse_res.fst;
                                visited_refs = non_public_member_traverse_res.snd;
                            }
                        }
                    })).catch(e => { console.error(e); });
                }
                else {
                    if (variable.name == "Target")
                        continue;
                    //			console.log("recurring", variable_path, variable)
                    let res = yield traverse_structured_variables(variable_path, variable.variablesReference, parent.fst, memory, stack_frame_index, visited_refs.add(parent.fst));
                    memory = res.fst;
                    visited_refs = res.snd;
                }
            }
        }
        if (variable.name == "Target")
            continue;
        if (parent_ref != "none") {
            if (variable.value == undefined || variable.value == null || variable.type == undefined || variable.type == null)
                continue;
            let res = mk_val(variable.value, variable.value != "(null)" && variable.variablesReference > 0, memory, variable.type, variable_address_num, false);
            memory = res.snd.update({ kind: "heap", ref: parent_ref, class_name: "update_ref", val: { att_name: variable.name, val_content: res.fst } });
            // if(res.fst.kind == "ref" && res.fst.val == 8){
            //     console.log(res, memory)
            // }
        }
        else {
            if (stack_frame_index == 0) {
                if (variable.value != undefined && variable.value != null && variable.type != undefined && variable.type != null) {
                    let res = mk_val(variable.value, variable.variablesReference > 0, memory, variable.type, variable_address_num);
                    memory = res.snd.update({ kind: "stack", stack_frame: 0, val_name: variable.name, val_content: res.fst });
                }
            }
            else {
                if (variable.value != undefined && variable.value != null && variable.type != undefined && variable.type != null) {
                    let res = mk_val(variable.value, variable.variablesReference > 0, memory, variable.type, variable_address_num);
                    memory = res.snd.update({ kind: "stack", stack_frame: stack_frame_index, val_name: variable.name, val_content: res.fst });
                }
            }
        }
    }
    return utils_1.mk_pair(memory, visited_refs);
});
let traverse_structured_variables = (var_name, variablesReference, ref, memory, frame_index, visited_refs) => __awaiter(this, void 0, void 0, function* () {
    if (debugClient == "none")
        return;
    let v = yield debugClient.variablesRequest({ variablesReference });
    return yield traverse_variables_response(v, memory, frame_index, visited_refs, var_name, ref);
});
let update_memory = (frames, language = "python", memory) => __awaiter(this, void 0, void 0, function* () {
    let s = Immutable.Set();
    for (let frame of frames.reverse().map((f, i) => ({ f: f, i: i }))) {
        stack_frame_id = frame.f.frameId;
        let vars_to_iterate = frame.f.vars;
        let res = frame.f.vars.find(vs => vs.body.variables.find(v => v.name == "Local Variables") != undefined);
        if (res != undefined) {
            let local_variables = res.body.variables.find(v => v.name == "Local Variables");
            let local_parameters = res.body.variables.find(v => v.name == "Parameters");
            if (debugClient != "none") {
                if (local_variables.variablesReference > 0) {
                    let vars = yield debugClient.variablesRequest({ variablesReference: local_variables.variablesReference });
                    for (let i = 0; i < frame.f.vars.length; i++) {
                        const element = frame.f.vars[i];
                        element.body.variables = element.body.variables.filter(v => v.name != "Parameters" && v.name != "Local Variables" && v.name != "this");
                    }
                    vars_to_iterate = frame.f.vars.concat([vars]);
                }
                if (local_parameters.variablesReference > 0) {
                    let vars = yield debugClient.variablesRequest({ variablesReference: local_parameters.variablesReference });
                    for (let i = 0; i < frame.f.vars.length; i++) {
                        const element = frame.f.vars[i];
                        element.body.variables = element.body.variables.filter(v => v.name != "Parameters" && v.name != "Local Variables" && v.name != "this");
                    }
                    vars_to_iterate = vars_to_iterate.concat([vars]);
                }
            }
        }
        for (let variables_response of vars_to_iterate) {
            if (!variables_response.success) {
                console.log(`[update_memory] Error while getting variables: ${variables_response.message}`);
            }
            else {
                let res = yield traverse_variables_response(variables_response, memory, frame.i, s, "");
                memory = res.fst;
                s = res.snd;
            }
        }
    }
    return Object.assign({}, memory, { stack: memory.stack.reverse().toMap() });
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
        //frame.id
        let scopes = yield debugClient.scopesRequest({ frameId: frame.id });
        //print_info(scopes, "Scopes")
        let res = yield Promise.all(scopes.body.scopes.map((scope) => __awaiter(this, void 0, void 0, function* () {
            if (debugClient == "none")
                return;
            const variablesReference = scope.variablesReference;
            let v = yield debugClient.variablesRequest({ variablesReference });
            return utils_1.mk_pair(v, scope.name);
        })));
        return { variables: res, framId: frame.id };
    })));
    let res = vars.map(e => ({
        vars: e.variables.filter(e => {
            if (language == "php" && e.snd == "Superglobals")
                return false;
            return true;
        }).map(e => e.fst),
        frameId: e.framId
    }));
    return res;
});
let trace = [];
function onGenericError() {
    return new Promise((ok, reject) => {
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
    });
}
let file_suffix = 0;
let file_suffix_counter = 0;
function run(get_program, get_breakpoints, stop, language, retry_count = 0, max_pages) {
    return __awaiter(this, void 0, void 0, function* () {
        file_suffix_counter += 1;
        file_suffix = file_suffix_counter % 20;
        const DATA_ROOT = Path.join(PROJECT_ROOT, 'src/');
        const DEBUG_ADAPTER = Path.join(PROJECT_ROOT, `bin/mono/${exports.IS_WINDOWS ? "Windows" : "Linux"}/mono-debug.exe`); // "C:\Program Files (x86)\Mono\bin\mono.exe" //
        let init_program = yield utils_1.init_program_input(get_program, get_breakpoints);
        if (init_program.kind == "left")
            return { kind: "error", message: [init_program.value], accumulated_val: Immutable.List() };
        let rmDir = function (dirPath, removeSelf) {
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
                    if (fs.statSync(filePath).isFile())
                        fs.unlinkSync(filePath);
                    else
                        rmDir(filePath);
                }
            if (removeSelf)
                fs.rmdirSync(dirPath);
        };
        console.log("removing dir", DATA_ROOT);
        rmDir(DATA_ROOT, false);
        let PROGRAM = Path.join(DATA_ROOT, `Program${file_suffix}.exe`);
        const SOURCE = Path.join(DATA_ROOT, `Program${file_suffix}.cs`);
        let closure_program = `
namespace Global{
	using System;
	using System.Reflection;
	public static class Closure {
		public static string getClosure(object f, string path){
			if(f == null) return "[K]K";
			try{
				var path_split = path.Split(".");
				var f_instance = f;
				foreach (var item in path_split)
				{
					if(item == "") continue;
					try{
						f_instance = f_instance.GetType().GetProperty(item,
																		System.Reflection.BindingFlags.NonPublic |
																		System.Reflection.BindingFlags.Instance |
																		System.Reflection.BindingFlags.Public |
																		System.Reflection.BindingFlags.Static).GetValue(f_instance);
					}
					catch(Exception e){
						f_instance = f_instance.GetType().GetField(item,
																		System.Reflection.BindingFlags.NonPublic |
																		System.Reflection.BindingFlags.Instance |
																		System.Reflection.BindingFlags.Public |
																		System.Reflection.BindingFlags.Static).GetValue(f_instance);
					}

				}


				var closure = f_instance.GetType().GetFields(System.Reflection.BindingFlags.NonPublic |
																										System.Reflection.BindingFlags.Instance |
																										System.Reflection.BindingFlags.Public |
																										System.Reflection.BindingFlags.Static);
				var res_str = "";
				for (int i = 0; i < closure.Length; i++)
				{
						var closure_field = closure[i];
						var _f = closure_field.Name.Replace("$", "");
						var _v = closure_field.GetValue(f_instance);
						var _a = closure_field.GetValue(f_instance).GetHashCode();
						var _t = "";
						Type t = closure_field.GetValue(f_instance).GetType();
						bool isPrimitiveType = t.IsPrimitive || t.IsValueType || (t == typeof(string));
						if(isPrimitiveType){
							var tmp = closure_field.GetValue(f_instance).GetType().Name;
							_t = "#K" + tmp + "#K" + _v;
						}
						res_str += "{K" + _f + "#K" + _a + "#K" + isPrimitiveType.ToString().ToLower() + _t + "}K";
						if(i + 1 < closure.Length){
							res_str += "!K";
						}
				}
				return "[K" + "{KHashIs#K"+f_instance.GetHashCode()+"}K!K" + res_str + "]K";
			}
			catch(Exception e){
				return "[K]K";
			}
		}
	}
}`;
        let kill_mono = () => __awaiter(this, void 0, void 0, function* () {
            console.log("killing mono");
            if (exports.IS_WINDOWS) {
                console.log("killing mono (windows)");
                let ps = new win_shell({
                    executionPolicy: 'Bypass',
                    noProfile: true
                });
                ps.addCommand(`taskkill /F /IM mono.exe`);
                yield ps.invoke();
                yield ps.dispose().catch(_ => { });
            }
            else {
                console.log("killing mono (mac)");
                linux_shell.exec(`killall mono`, { async: true });
            }
        });
        let file_path = SOURCE;
        let txt = init_program.value.fst + "\n" + closure_program;
        let file_same_res = yield utils_1.write_file(file_path, txt);
        if (file_same_res.kind == "some")
            return { kind: "error", message: [file_same_res.value.message], accumulated_val: Immutable.List() };
        let compilation_errors = [];
        let retry_compilation = false;
        if (exports.IS_WINDOWS) {
            console.log("Found windows");
            let ps = new win_shell({
                executionPolicy: 'Bypass',
                noProfile: true
            });
            // ps.addCommand(`cd ${Path.join(PROJECT_ROOT,"src")}`)
            if (language == "csharp") {
                let local_file_path = `\"${Path.join(PROJECT_ROOT, "src/Program") + file_suffix + ".cs\""}`;
                ps.addCommand(`mcs -debug ${local_file_path}`);
            }
            yield ps.invoke().catch((compilation_error) => {
                console.warn(compilation_error);
                if (compilation_error.toLowerCase().includes("cs0016")) {
                    console.log("file locked");
                    retry_compilation = true;
                    file_suffix++;
                    return;
                }
                if (!(compilation_error.toLowerCase().includes("error cs") ||
                    compilation_error.toLowerCase().includes("fout cs")) &&
                    (compilation_error.toLowerCase().includes("cs0168") ||
                        compilation_error.toLowerCase().includes("cs0219"))) {
                    return;
                }
                compilation_errors = compilation_error.split("\n").filter(e => e.length > 0 && (e.toLowerCase().includes("error cs") ||
                    e.toLowerCase().toLowerCase().includes("fout cs") ||
                    e.toLowerCase().includes("error fs") ||
                    e.toLowerCase().toLowerCase().includes("fout fs")))
                    .map(e => e.replace(`Program${file_suffix}.cs`, ""))
                    .map(e => e.replace(`Program${file_suffix}.fs`, ""));
            });
            yield ps.dispose().catch(_ => { });
        }
        else {
            console.log("Found linux or mac");
            linux_shell.cd(`${Path.join(PROJECT_ROOT, "src")}`);
            let nodePath = (linux_shell.which('node').toString());
            if (nodePath == null)
                nodePath = (linux_shell.which('nodejs').toString());
            linux_shell.config.execPath = nodePath;
            let _continue = false;
            let res0 = linux_shell.exec(`killall mono`, { async: true });
            let res = linux_shell.exec(`mcs -debug Program${file_suffix}.cs`, { async: true }, (code, stdout, stderr) => {
                if (stderr.toLowerCase().includes("cs0016")) {
                    console.log("file locked");
                    retry_compilation = true;
                    file_suffix++;
                    _continue = true;
                    return;
                }
                if (!(stderr.toLowerCase().includes("error cs") ||
                    stderr.toLowerCase().includes("fout cs")) &&
                    (stderr.toLowerCase().includes("cs0168") ||
                        stderr.toLowerCase().includes("cs0219"))) {
                    _continue = true;
                    return;
                }
                compilation_errors = stderr.split("\n").filter(e => e.length > 0 &&
                    (e.toLowerCase().includes("error cs") ||
                        e.toLowerCase().toLowerCase().includes("fout cs") ||
                        e.toLowerCase().includes("error fs") ||
                        e.toLowerCase().toLowerCase().includes("fout fs")))
                    .map(e => e.replace(`Program${file_suffix}.cs`, ""))
                    .map(e => e.replace(`Program${file_suffix}.fs`, ""));
                _continue = true;
            });
            yield new Promise((res, rej) => {
                let loop = () => setTimeout(_ => {
                    if (_continue) {
                        return res();
                    }
                    return loop();
                }, 500);
                loop();
            });
        }
        if (retry_compilation) {
            return yield run(get_program, get_breakpoints, stop, language, retry_count, max_pages);
        }
        if (compilation_errors.length > 0) {
            return { kind: "error", message: compilation_errors, accumulated_val: Immutable.List() };
        }
        if (debugClient && debugClient != "none") {
            debugClient.removeAllListeners();
            let continued = false;
            Promise.race([
                Promise.resolve([
                    debugClient.stop().catch(_ => { }),
                    debugClient.disconnectRequest().catch(_ => { })
                ]),
                new Promise((resolve, reject) => setTimeout(() => {
                    if (!continued)
                        reject("debugClient dispose timeout");
                }, 5000))
            ]).catch(r => console.log(r));
            continued = true;
            yield new Promise(resolve => setTimeout(resolve, 1000));
            debugClient = "none";
        }
        debugClient = new vscode_debugadapter_testsupport_1.DebugClient('mono', DEBUG_ADAPTER, 'mono');
        debugClient.defaultTimeout = exports.TIMEOUT_ADAPTER;
        console.log("starting");
        yield debugClient.start();
        debugClient.once('terminated', (event) => {
        });
        yield Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(buildLaunchArgs(PROGRAM, true)),
            debugClient.waitForEvent('initialized').then(_ => { console.log("initialized"); throw "continue"; }),
        ]).catch(_ => { });
        ;
        let error = false;
        let restart = false;
        yield debugClient.setBreakpointsRequest({
            lines: init_program.value.snd.map(e => e.line),
            breakpoints: init_program.value.snd.map(e => ({ line: e.line })),
            source: { path: SOURCE }
        }).catch(e => {
            console.log("????", e);
            error = true;
            restart = true;
        });
        if (restart && retry_count < 3) {
            return run(get_program, get_breakpoints, stop, language, retry_count + 1, max_pages);
        }
        let mem_trace = Immutable.List();
        let memory = memory_1.mk_memory("", { column: -1, line: -1 });
        mem_trace = mem_trace.push(memory);
        let current_bp = null;
        // try hit all breakpoints
        var terminated = false;
        let _onGenericError = onGenericError();
        let _onTerminated = onTerminated();
        let stackTraceRequest;
        let continue_count = 0;
        let complete_memory = memory_1.mk_memory("", current_bp);
        let first_loop = true;
        let iteration = -1;
        while (!terminated && !error) {
            iteration++;
            let stackTraceRequest;
            let promises = [
                new Promise((res, rej) => {
                    let my_iteration = iteration;
                    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                        if (iteration == my_iteration && debugClient != "none") {
                            rej("restart");
                        }
                    }), 8000);
                }),
                debugClient.assertStoppedLocation("exception", {})
                    .then(e => {
                    //console.log(e)
                    trace = e.body.stackFrames.map(f => {
                        return `Exception at line ${f.line} in ${f.name}`;
                    });
                    error = true;
                    throw "continue";
                })
                    .catch(e => { if (e == "continue")
                    throw "continue";
                else
                    null; }),
                (!first_loop ? debugClient.continueRequest({ threadId: 1 }).catch(_ => { }) : new Promise((res, rej) => { })),
                !error && debugClient.assertStoppedLocation("breakpoint", {})
                    //in case of hit we throw a continue error to force the promise.all
                    //to stop otherwise the error handlers will lock the cotinuation
                    .then((e) => __awaiter(this, void 0, void 0, function* () {
                    if (debugClient == "none")
                        return;
                    if (error)
                        return;
                    current_bp = { line: e.body.stackFrames[0].line, column: e.body.stackFrames[0].column };
                    stackTraceRequest = yield debugClient.stackTraceRequest({ threadId: 1 });
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
                stop.then((_) => __awaiter(this, void 0, void 0, function* () {
                    yield kill_mono().catch(e => console.log(e));
                    error = true;
                    throw "user stop";
                }))
            ];
            let restart = false;
            yield Promise.all(promises)
                .catch(e => {
                if (e == "restart") {
                    restart = true;
                }
                //if e!="continue" then its an error coming
                //from one of the error event handlers
                if (e != "continue") {
                    console.log("Error: ", JSON.stringify(e));
                    error = true;
                }
            });
            if (restart) {
                return run(get_program, get_breakpoints, stop, language, retry_count, max_pages);
            }
            first_loop = false;
            if (terminated == false && max_pages < continue_count - 5) { //magic number
                error = true;
                restart = false;
                trace = trace.concat(["Your program is generating too many steps. Check for an infinite loop."]);
                console.log(`Memory too long. Expected ${max_pages}, but found ${continue_count}. Stopping.`);
            }
            if (!error && !terminated) {
                continue_count++;
                memory = Object.assign({}, memory_1.mk_memory("", current_bp), { __internal_heap_ref_map: complete_memory.__internal_heap_ref_map });
                //debugClient.variablesRequest
                let vs = yield get_variables(stackTraceRequest);
                //print_variables(vs, "python")
                let restart = false;
                let new_memory = yield update_memory(vs, "csharp", memory)
                    .catch(e => { console.log({ e }); restart = true; });
                if (restart) {
                    yield debugClient.stop()
                        .then((_) => __awaiter(this, void 0, void 0, function* () { return yield kill_mono().catch(e => console.log(e)); }))
                        .catch((_) => __awaiter(this, void 0, void 0, function* () { return yield kill_mono().catch(e => console.log(e)); }));
                    return run(get_program, get_breakpoints, stop, language, retry_count, max_pages);
                }
                complete_memory = Object.assign({}, complete_memory, { __internal_heap_ref_map: new_memory.__internal_heap_ref_map });
                new_memory.heap.forEach((v, k) => {
                    complete_memory = Object.assign({}, complete_memory, { heap: complete_memory.heap.set(k, v) });
                });
                let tmp_memory = new_memory;
                new_memory.heap.forEach((v, k) => {
                    v && v.attributes.forEach(a => {
                        if (a && a.kind == "ref" && !new_memory.heap.has(a.val) && complete_memory.heap.has(a.val)) {
                            tmp_memory = Object.assign({}, tmp_memory, { heap: tmp_memory.heap.set(a.val, complete_memory.heap.get(a.val)) });
                        }
                    });
                });
                new_memory.stack.forEach((v, k) => {
                    v && v.forEach(a => {
                        if (a && a.kind == "ref" && !new_memory.heap.has(a.val) && complete_memory.heap.has(a.val)) {
                            tmp_memory = Object.assign({}, tmp_memory, { heap: tmp_memory.heap.set(a.val, complete_memory.heap.get(a.val)) });
                        }
                    });
                });
                new_memory = tmp_memory;
                mem_trace = mem_trace.push(new_memory);
                //memory.pretty_print()
            }
        }
        //there are no more breakpoints to process or the program crashed
        let should_retry = false;
        console.log(mem_trace, init_program.value.snd, retry_count, mem_trace.count() <= 1 && init_program.value.snd.length > 0 && retry_count < 8);
        if (mem_trace.count() <= 1 && init_program.value.snd.length > 0 && retry_count < 8) {
            console.log("breakpoint not empty but memory yes...retrying");
            should_retry = true;
        }
        //search for objects around
        mem_trace.forEach((m, k) => {
            let heap_values_to_remove = Immutable.List();
            m.heap.forEach((heap_value, heap_ref) => {
                let atts_to_delete = Immutable.List();
                heap_value.attributes.forEach((att_value, att_name) => {
                    if (att_value.kind == "ref") {
                        let att_value_refrenced_object = m.heap.get(att_value.val);
                        if (att_value_refrenced_object.className.toLocaleLowerCase() == "object" &&
                            att_value_refrenced_object.attributes.count() == 0) {
                            atts_to_delete = atts_to_delete.push(att_name);
                            heap_values_to_remove = heap_values_to_remove.push(att_value.val);
                        }
                    }
                });
                atts_to_delete.forEach(a => heap_value.attributes = heap_value.attributes.remove(a));
            });
            heap_values_to_remove.forEach(hv => m.heap = m.heap.remove(hv));
        });
        mem_trace.forEach((m, k) => {
            if (k == 0)
                return;
            m.stack.forEach((ss, ss_k) => {
                ss.forEach((s, s_k) => {
                    if (s_k == "args")
                        return;
                    if (s.kind == "ref") {
                        let ref = s.val;
                        let heap_value = m.heap.get(s.val);
                        if (heap_value != undefined) {
                            if (heap_value.className.toLowerCase().includes("system.func<"))
                                return;
                            if (heap_value.className.toLowerCase().includes("system.action<"))
                                return;
                            if (heap_value.className.toLowerCase().includes("system.action"))
                                return;
                            if (heap_value.className.toLowerCase().includes("system.tuple<") && heap_value.attributes.count() == 0) {
                                console.log("removing 1", m, ss_k, heap_value);
                                m.stack = m.stack.set(ss_k, m.stack.get(ss_k).set(s_k, { kind: "string", val: "null" }));
                                m.heap = m.heap.remove(ref);
                                return;
                            }
                        }
                        let skip_check = false;
                        if (heap_value != undefined && heap_value.className.split(".").every(v => txt.includes(v))) {
                            if (heap_value.attributes.count() == 0) {
                                skip_check = true;
                            }
                            else {
                                return;
                            }
                        }
                        if (skip_check || (heap_value != undefined && heap_value.attributes.count() == 0 && !heap_value.className.startsWith("System."))) {
                            let is_referenced_by_heap = false;
                            m.heap.forEach(m => m.attributes.forEach(a => {
                                if (a.kind == "ref" && a.val == ref) {
                                    is_referenced_by_heap = true;
                                }
                            }));
                            if (!is_referenced_by_heap) {
                                m.stack = m.stack.set(ss_k, m.stack.get(ss_k).set(s_k, { kind: "string", val: "null" }));
                                m.heap = m.heap.remove(ref);
                            }
                        }
                    }
                });
            });
        });
        console.log("map2", mem_trace);
        mem_trace.forEach((m, k) => {
            if (k == 0)
                return;
            let refs_to_remove = [];
            m.heap.forEach((_, ref) => {
                let is_referenced = false;
                m.heap.forEach(mi => {
                    if (is_referenced)
                        return;
                    mi.attributes.forEach(ma => {
                        if (is_referenced)
                            return;
                        if (ma.kind == "ref" && ma.val == ref) {
                            is_referenced = true;
                        }
                    });
                });
                if (is_referenced)
                    return;
                m.stack.forEach(ss => {
                    if (is_referenced)
                        return;
                    ss.forEach(s => {
                        if (is_referenced)
                            return;
                        if (s.kind == "ref" && s.val == ref) {
                            is_referenced = true;
                        }
                    });
                });
                if (!is_referenced) {
                    refs_to_remove = refs_to_remove.concat([ref]);
                }
            });
            if (refs_to_remove.length > 0) {
                refs_to_remove.forEach(r => {
                    console.log("removing 2", r, m.heap);
                    m.heap = m.heap.remove(r);
                });
            }
        });
        if (terminated) {
            yield debugClient.stop().catch(e => console.error(e));
            if (should_retry) {
                return run(get_program, get_breakpoints, stop, language, retry_count + 1, max_pages);
            }
            return { kind: "done", value: mem_trace };
        }
        if (!error) {
            // wait normal termination
            yield Promise.all([
                debugClient.continueRequest({ threadId: 1 }),
                debugClient.waitForEvent('terminated')
            ]).catch(e => console.error(e));
            yield debugClient.stop().catch(e => console.error(e));
            if (should_retry) {
                return run(get_program, get_breakpoints, stop, language, retry_count + 1, max_pages);
            }
            return { kind: "done", value: mem_trace };
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
//# sourceMappingURL=myTest.js.map