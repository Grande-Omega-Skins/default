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
const debugClient_1 = require("../../../../../../../Shared/debug_client/debugClient");
const os = require("os");
exports.TIMEOUT_ADAPTER = 30000;
const IS_WINDOWS = /^win/.test(process.platform) || os.type().toLowerCase().includes("windows");
const IS_MAC = /^win/.test(process.platform) || os.type().toLowerCase().includes("darwin");
const IS_LINUX = /^win/.test(process.platform) || os.type().toLowerCase().includes("linux");
const PROJECT_ROOT = Path.join(__dirname, 'wwwroot', 'js', 'adapters', 'csharp');
console.log("OS: " + os.type());
// const TEST_FILE_PATH = path.join(__dirname,'wwwroot', 'js', 'adapters', 'csharp', 'src')
// const DEBUG_ADAPTER = Path.join(PROJECT_ROOT, 'bin/Release/mono-debug.exe'); // "C:\Program Files (x86)\Mono\bin\mono.exe" //
const DEBUG_INTERNALS = false;
function buildLaunchArgs(file, workspace, stopOnEntry) {
    const env = "netcoredbg";
    console.log("buildLaunchArgs");
    console.log("file", file);
    console.log("workspace", workspace);
    const options = {
        name: ".NET Core Launch (console)",
        type: env,
        program: file,
        args: [],
        console: "internalConsole",
        request: "launch",
        stopAtEntry: false
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
    if (!val.match(/^-?[0-9]+(\.[0-9]*)?$/)) {
        if (val.startsWith("\"") && val.endsWith("\"") ||
            val.startsWith("'") && val.endsWith("'")) {
            return utils_1.mk_pair({ kind: "string", val: val, type: string_to_string_or_char(type) }, memory);
        }
        else {
            if (val == "True" || val == "False") {
                return utils_1.mk_pair({ kind: "bool", val: val == "True" }, memory);
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
        return utils_1.mk_pair({ kind: "number", val: +val, type: string_to_number(type) }, memory);
    }
};
let traverse_variables_response = (variables_responce, memory, frame_index, visited_refs, parent_name, ref = "none") => __awaiter(this, void 0, void 0, function* () {
    for (let variable of variables_responce.body.variables
        //Tests.Simple.<Main>c__AnonStorey1
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
        !(v.name.includes("_tag") && v.variablesReference == 0 && variables_responce.body.variables.find(e => e.name == "Tag" && e.variablesReference == 0) != null) &&
        !(v.name.includes("Tag") && v.variablesReference == 0 && variables_responce.body.variables.find(e => e.name == "_tag" && e.variablesReference == 0) != null) &&
        !(v.name.startsWith("Is") && v.variablesReference == 0 && variables_responce.body.variables.find(e => e.name == "_tag") != null) &&
        !(v.name.startsWith("Item") && v.variablesReference > 0 && variables_responce.body.variables.find(e => e.name == "_tag") != null) &&
        !(v.name == "Item" && variables_responce.body.variables.find(e => e.name == "_tag") != null
            && variables_responce.body.variables.find(e => e.name == "item") != null) &&
        !v.name.includes("method") &&
        !v.name.includes("method_code") &&
        !v.name.includes("method_info") &&
        !v.name.includes("method_is_virtual") &&
        !v.name.includes("method_ptr") &&
        !v.name.includes("@") &&
        !v.name.includes("original_method_info") &&
        !v.name.includes("m_target") &&
        //
        !v.name.includes("<") &&
        !v.name.includes(">") &&
        !v.name.includes("Method"))) {
        if (variable.name.includes("Non-public members") && parent_name.includes("System"))
            return memory;
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
            if (lambda_test_res == "nothing" && variable.variablesReference > 0) {
                let res = memory.get_heap_address(variable.variablesReference.toString());
                let regex = '\.(.*?)\ ';
                let _str = variable.value.match(regex);
                let class_name = variable.value; //? _str.length >= 1 ? _str[1].substr(_str[1].indexOf(".") + 1) : "_" : "_"
                //class_name = class_name.startsWith("'") && (class_name.endsWith(":") || class_name.endsWith(",")) ? "_" : class_name
                if (variable.name.includes("Target") && parent_name.includes("System")) {
                    class_name = "closure";
                }
                class_name = class_name.replace("{", "");
                class_name = class_name.replace("}", "");
                class_name = class_name.substring(class_name.lastIndexOf(".") + 1);
                // console.log({class_name}, {parent_name}, parent_name.includes("Target"), variable.name, variable.value)
                // if(variable.name.includes("Target") && parent_name.includes("System")){
                // 	console.log(!(variable.name.includes("Target") && parent_name.includes("System") && variable.value == "(null)"))
                // 	console.log(variable)
                // }
                if (variable.name.includes("Target") && parent_name.includes("System")) {
                    if (variable.value != "(null)")
                        memory = res.snd.update({ kind: "heap", ref: res.fst, class_name: class_name, val: "make_ref" });
                }
                else {
                    memory = res.snd.update({ kind: "heap", ref: res.fst, class_name: class_name, val: "make_ref" });
                }
                // if(variable.name.includes("Target") && parent_name.includes("System")){
                // 	console.log(!(variable.name.includes("Target") && parent_name.includes("System") && variable.value == "(null)"))
                // 	console.log(variable)
                // }
                if (!(variable.name.includes("Target") && parent_name.includes("System") && variable.value == "(null)") &&
                    !visited_refs.has(res.fst)) {
                    memory = yield traverse_structured_variables(variable.name + " " + variable.value, variable.variablesReference, res.fst, memory, frame_index, visited_refs.add(res.fst));
                }
            }
            if (ref != "none") {
                let res = mk_val(variable.value, variable.value != "(null)" && variable.variablesReference > 0, memory, variable.type, variable.variablesReference, false); //, variable.value.includes("<function") && variable.variablesReference > 0)
                memory = res.snd.update({ kind: "heap", ref: ref, class_name: "update_ref", val: { att_name: variable.name, val_content: res.fst } });
            }
            else {
                if (frame_index == 0) {
                    let res = mk_val(variable.value, variable.variablesReference > 0, memory, variable.type, variable.variablesReference);
                    memory = res.snd.update({ kind: "stack", stack_frame: 0, val_name: variable.name, val_content: res.fst });
                }
                else {
                    let res = mk_val(variable.value, variable.variablesReference > 0, memory, variable.type, variable.variablesReference);
                    memory = res.snd.update({ kind: "stack", stack_frame: frame_index, val_name: variable.name, val_content: res.fst });
                }
            }
        }
    }
    return memory;
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
        for (let variables_response of frame.f) {
            if (!variables_response.success) {
                console.log(`[update_memory] Error while getting variables: ${variables_response.message}`);
            }
            else {
                memory = yield traverse_variables_response(variables_response, memory, frame.i, s, "");
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
function run(get_program, get_breakpoints, stop, language, retry_count = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        const DATA_ROOT = Path.join(PROJECT_ROOT, 'src', 'testapp');
        // const DEBUG_ADAPTER = Path.join(PROJECT_ROOT, `bin/${IS_WINDOWS ? "Windows" : "Linux"}/mono-debug.exe`); // "C:\Program Files (x86)\Mono\bin\mono.exe" //
        console.log("DEBUG_ADAPTER start");
        const DEBUG_ADAPTER = path.join(PROJECT_ROOT, `bin/netcoredbg/${IS_WINDOWS ? "Windows" : IS_MAC ? "Mac" : "Linux"}/netcoredbg${IS_WINDOWS ? ".exe" : ""}`);
        console.log("DEBUG_ADAPTER after", DEBUG_ADAPTER);
        let init_program = yield utils_1.init_program_input(get_program, get_breakpoints);
        if (init_program.kind == "left")
            return { kind: "error", message: [init_program.value], accumulated_val: Immutable.List() };
        const PROGRAM = Path.join(DATA_ROOT, "bin", "Debug", "netcoreapp2.1", "testapp.dll");
        let SOURCE = Path.join(DATA_ROOT, `Program${file_suffix}.` + (language == "fsharp" ? "fs" : "cs"));
        let SOURCE_PROJ = Path.join(DATA_ROOT, `testapp.` + (language == "fsharp" ? "fsproj" : "csproj"));
        let files = fs.readdirSync(DATA_ROOT);
        let extension = language == "fsharp" ? /\.cs$/ : /\.fs$/;
        let extension2 = language == "fsharp" ? /\.csproj$/ : /\.fsproj$/;
        const fsFiles = files.filter(el => extension.test(el) || extension2.test(el));
        fsFiles.forEach(f => fs.unlinkSync(path.join(DATA_ROOT, f)));
        let proj = `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>netcoreapp2.1</TargetFramework>
  </PropertyGroup>

  ${language == "fsharp" ? `<ItemGroup>
    <Compile Include="Program${file_suffix}.fs" />
  </ItemGroup>` : ""}

</Project>
`;
        let closure_program = `
namespace Global{
	using System; 
	using System.Reflection;
	public static class Closure {
		public static string getClosure(object f, string path){
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
        if (language == "fsharp") {
            closure_program = `
namespace Global 
  open System
  open System.Reflection;
  open Microsoft.FSharp.Collections
  module Closure =
    let getClosure = 
      fun (f:Object, path: string) -> 
          try
            let path_split = path.Split('.') |> List.ofArray
            let mutable f_instance = f;
            path_split |> List.iter(fun item -> 
                                        if(item <> "") then
                                          try
                                            f_instance <- f_instance.GetType().GetProperty(item,
                                                        System.Reflection.BindingFlags.NonPublic |||
                                                        System.Reflection.BindingFlags.Instance |||
                                                        System.Reflection.BindingFlags.Public |||
                                                        System.Reflection.BindingFlags.Static).GetValue(f_instance)
                                          with e ->
                                            f_instance <- f_instance.GetType().GetField(item,
                                                        System.Reflection.BindingFlags.NonPublic |||
                                                        System.Reflection.BindingFlags.Instance |||
                                                        System.Reflection.BindingFlags.Public |||
                                                        System.Reflection.BindingFlags.Static).GetValue(f_instance))
            let closure = f_instance.GetType().GetFields(System.Reflection.BindingFlags.NonPublic |||
                                                            System.Reflection.BindingFlags.Instance |||
                                                            System.Reflection.BindingFlags.Public |||
                                                            System.Reflection.BindingFlags.Static);                    
            let mutable res_str = ""
            [0..closure.Length-1] |> List.iter(fun i -> 
              let closure_field = closure.[i]
              let _f = closure_field.Name.Replace("$", "").Replace("@", "")
              let _v = closure_field.GetValue(f_instance)
              let _a = closure_field.GetValue(f_instance).GetHashCode()
              let mutable _t = ""
              let t = closure_field.GetValue(f_instance).GetType()
              let isPrimitiveType = t.IsPrimitive || t.IsValueType || (t = string.GetType())
              if(isPrimitiveType) then
                  let tmp = closure_field.GetValue(f_instance).GetType().Name
                  _t <- "#K" + tmp + "#K" + string _v

              res_str <- res_str + "{K" + _f + "#K" + string _a + "#K" + isPrimitiveType.ToString().ToLower() + _t + "}K"
              if(i + 1 < closure.Length) then
                  res_str <- res_str + "!K")
            "[K" + "{KHashIs#K" + string (f_instance.GetHashCode()) + "}K!K" + res_str + "]K"                  
          with e ->
            "[K]K"

namespace Start
  module Entry =
    [<EntryPoint>]
    let start _ =
        printfn "Starting F#"
        let res = Application.Program.main()
        printfn "Ending F#"
        0`;
        }
        let file_path = SOURCE;
        let txt = init_program.value.fst + "\n" + closure_program;
        let file_same_res = yield utils_1.write_file(file_path, txt);
        let proj_file = yield utils_1.write_file(SOURCE_PROJ, proj);
        if (file_same_res.kind == "some")
            return { kind: "error",
                message: [file_same_res.value.message],
                accumulated_val: Immutable.List() };
        if (proj_file.kind == "some")
            return { kind: "error",
                message: [proj_file.value.message],
                accumulated_val: Immutable.List() };
        let compilation_errors = [];
        let retry_compilation = false;
        let filter_errors = (res) => {
            if (res.toLowerCase().includes("error") || res.toLowerCase().includes("fout")) {
                let strs = res.split("\n").filter(line => line.includes(".fsproj]"));
                let tmp_compilation_errors = res.split("\n").filter(e => e.includes("fout") || e.includes("error") || e.includes("warning")).filter(e => !e.includes("FS0064"));
                if (tmp_compilation_errors.filter(e => e.includes("fout") || e.includes("error")).length > 0) {
                    compilation_errors = tmp_compilation_errors.map(e => {
                        let [left, ..._right] = e.split(":");
                        let right = _right.join(":");
                        if (left.length == 1 || IS_WINDOWS) { //like C:\..\..\..(x,y):error
                            let [_left, ..._right1] = right.split(":");
                            right = _right1.join(":");
                            left = _left;
                        }
                        if (left == undefined || right == undefined) {
                            return e;
                        }
                        right = right.split("[")[0];
                        if (right == "" || right == undefined) {
                            right = "";
                        }
                        let tmp_left = left.split("(");
                        if (tmp_left[1] != undefined) {
                            left = "(" + tmp_left[1];
                        }
                        if (left == "" || left == undefined) {
                            left = e;
                        }
                        return `${left}:${right}`;
                    });
                }
            }
        };
        if (IS_WINDOWS) {
            console.log("Found windows");
            let ps = new win_shell({
                executionPolicy: 'Bypass',
                noProfile: true
            });
            ps.addCommand(`cd ${Path.join(PROJECT_ROOT, "src", "testapp")}`);
            console.log("compiling");
            // if(language == "")
            ps.addCommand(`dotnet build -c Debug`);
            // if(language == "fsharp")
            // 	ps.addCommand(`fsharpc --debug:full Program${file_suffix}.fs`)
            console.log("compilation done");
            let res = yield ps.invoke().catch((compilation_error) => {
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
            if (typeof res === 'string' && (res.toLowerCase().includes("error") || res.toLowerCase().includes("fout"))) {
                filter_errors(res);
            }
            yield ps.dispose().catch(_ => { });
        }
        else {
            console.log("Found linux or mac");
            linux_shell.cd(`${Path.join(PROJECT_ROOT, "src", "testapp")}`);
            let nodePath = (linux_shell.which('node').toString());
            if (nodePath == null)
                nodePath = (linux_shell.which('nodejs').toString());
            linux_shell.config.execPath = nodePath;
            let _continue = false;
            let res = linux_shell.exec(`dotnet build -c Debug`, { async: true }, (code, stdout, stderr) => {
                if (stderr.toLowerCase().includes("cs0016")) {
                    console.log("file locked");
                    retry_compilation = true;
                    file_suffix++;
                    _continue = true;
                    return;
                }
                if (stdout.toLowerCase().includes("error") || stdout.toLowerCase().includes("fout")) {
                    filter_errors(stdout);
                }
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
            return yield run(get_program, get_breakpoints, stop, language);
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
        //		debugClient = new DebugClient(DEBUG_ADAPTER, ['--interpreter=vscode', '--engineLogging=./log.txt'], 'netcoredbg');
        debugClient = new debugClient_1.DebugClient(DEBUG_ADAPTER, ['--interpreter=vscode'], 'netcoredbg');
        debugClient.defaultTimeout = exports.TIMEOUT_ADAPTER;
        let file_exists = fs.existsSync(DEBUG_ADAPTER);
        console.log("starting", file_exists);
        yield debugClient.start();
        debugClient.once('terminated', (event) => {
        });
        let threadId = 1;
        yield Promise.all([
            debugClient.launch(buildLaunchArgs(PROGRAM, DATA_ROOT, false)).catch(e => console.log(e)),
            debugClient.waitForEvent('initialized').then(e => { console.log("initialized", e); }),
            debugClient.waitForEvent('thread').then(e => { console.log("thread", e); threadId = +e.body.threadId; throw "continue"; }),
            debugClient.configurationSequence().catch(e => console.log(e))
        ]).catch(_ => { });
        ;
        console.log("starting3");
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
        if (restart && retry_count < 8) {
            return run(get_program, get_breakpoints, stop, language, retry_count + 1);
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
        // if(!error && !terminated){
        // 		// await debugClient.assertStoppedLocation("exception", {}).then(e => console.log({e})).catch(_ => {}),
        // 		await debugClient.assertStoppedLocation("breakpoint", {})
        // 		//in case of hit we throw a continue error to force the promise.all
        // 		//to stop otherwise the error handlers will lock the cotinuation
        // 			.then(async e => {
        // 				if(debugClient == "none") return
        // 				if(error) return
        // 				current_bp = {line:e.body.stackFrames[0].line, column:e.body.stackFrames[0].column}
        // 				stackTraceRequest = await debugClient.stackTraceRequest({threadId:1})
        // 				throw "continue"})
        // 			.catch(e=> {console.log(e); if(e == "continue") {} else {error = true; throw "continue"}})
        // 	memory = {...mk_memory("", current_bp)}
        // 	let vs = await get_variables(stackTraceRequest)
        // 	memory = await update_memory(vs, "python", memory)
        // 	mem_trace = mem_trace.push(memory)
        // }
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
                (!first_loop ?
                    threadId == 1 ?
                        new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
                            yield new Promise((res, _) => {
                                let loop = () => setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                                    console.log("found thread id 1. Waiting...");
                                    if (threadId != 1)
                                        res();
                                    else
                                        loop();
                                }), 1000);
                                loop();
                            });
                            if (debugClient != "none")
                                yield debugClient.continueRequest({ threadId });
                            res();
                        })).catch(_ => { })
                        : debugClient.continueRequest({ threadId }).catch(_ => { })
                    : new Promise((res, rej) => { })),
                !error && debugClient.assertStoppedLocation("breakpoint", {})
                    //in case of hit we throw a continue error to force the promise.all
                    //to stop otherwise the error handlers will lock the cotinuation
                    .then((e) => __awaiter(this, void 0, void 0, function* () {
                    if (debugClient == "none")
                        return;
                    if (error)
                        return;
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
                    error = true;
                    throw "user stop";
                })
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
                return run(get_program, get_breakpoints, stop, language);
            }
            first_loop = false;
            if (!error && !terminated) {
                memory = Object.assign({}, memory_1.mk_memory("", current_bp), { __internal_heap_ref_map: complete_memory.__internal_heap_ref_map });
                //debugClient.variablesRequest
                let vs = yield get_variables(stackTraceRequest);
                //print_variables(vs, "python")
                let restart = false;
                let new_memory = yield update_memory(vs, "csharp", memory)
                    .catch(e => { console.log({ e }); restart = true; });
                if (restart) {
                    yield debugClient.stop();
                    return run(get_program, get_breakpoints, stop, language);
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
        if (terminated) {
            yield debugClient.stop().catch(e => console.error(e));
            if (should_retry) {
                return run(get_program, get_breakpoints, stop, language, retry_count + 1);
            }
            return { kind: "done", value: mem_trace };
        }
        if (!error) {
            // wait normal termination
            yield Promise.all([
                debugClient.continueRequest({ threadId }),
                debugClient.waitForEvent('terminated')
            ]).catch(e => console.error(e));
            yield debugClient.stop().catch(e => console.error(e));
            if (should_retry) {
                return run(get_program, get_breakpoints, stop, language, retry_count + 1);
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
//# sourceMappingURL=myTestFsharp.js.map