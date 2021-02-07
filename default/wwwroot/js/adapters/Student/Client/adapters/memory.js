"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Immutable = require("immutable");
const utils_1 = require("./utils");
exports.mk_memory = (program, bp_i) => ({
    breakpoint_info: bp_i,
    source: program,
    globals: Immutable.Map(),
    stack: Immutable.Map(),
    closure: Immutable.Map(),
    heap: Immutable.Map(),
    definitions: Immutable.Map(),
    __internal_heap_ref_map: Immutable.Map(),
    get_heap_address: function (s) {
        if (this.__internal_heap_ref_map.has(s)) {
            return utils_1.mk_pair(this.__internal_heap_ref_map.get(s), this);
        }
        let max = -1;
        this.__internal_heap_ref_map.forEach(e => {
            if (e > max)
                max = e;
        });
        let ref = max + 1;
        let v = this.__internal_heap_ref_map.set(s, ref);
        return utils_1.mk_pair(ref, Object.assign({}, this, { __internal_heap_ref_map: v }));
    },
    pretty_print: function () {
        let print_val = (v, _tabs = 0) => {
            if (v.kind == "ref")
                return `ref_${v.val}`;
            if (v.kind == "closure") {
                let tabs = "";
                for (let index = 0; index < _tabs; index++) {
                    tabs = tabs + "\t";
                }
                let str = "";
                str = `Closure\n`;
                str = `${str}${tabs}\t Args: \n`;
                str = `${str}${tabs}\t __________________\n`;
                v.val.args.forEach(a => str = `${str}${tabs}\t | ${a}\n`);
                str = `${str}${tabs}\t Free vars: \n`;
                str = `${str}${tabs}\t __________________\n`;
                v.val.free_vars.forEach((_val, _var) => str = `${str}${tabs}\t | ${_var}: ${print_val(_val, _tabs)}\n`);
                str = `${str}${tabs}\t Code: \n`;
                str = `${str}${tabs}\t __________________\n`;
                str = `${str}${tabs}\t | ${v.val.code.replace(/\s\s+/g, "")}\n`;
                return str;
            }
            return v.val.toString();
        };
        console.log("<<<Memory>>>");
        console.log("--------------------------");
        console.log("                          ");
        console.log("\tGlobals");
        console.log("\t__________________________");
        this.globals.sortBy((s, k) => k).forEach((e, k) => {
            console.log(`\t\t| ${k} : ${print_val(e)}`);
        });
        console.log("\t__________________________");
        console.log("\tClosure");
        console.log("\t__________________________");
        this.closure.sortBy((s, k) => k).forEach((e, k) => {
            console.log(`\t\t| ${k} : ${print_val(e)}`);
        });
        console.log("\t__________________________");
        console.log("\tStack");
        console.log("\t__________________________");
        this.stack.forEach(s => {
            s.forEach((e, k) => {
                console.log(`\t\t| ${k} : ${print_val(e)}`);
            });
            console.log(`\t\t__________________`);
        });
        console.log("\t__________________________");
        console.log("\tHeap");
        console.log("\t__________________________");
        this.heap.sortBy((e, k) => k).forEach((e, k) => {
            console.log(`\t\t| ${k} : ${e.className}`);
            console.log(`\t\t__________________`);
            e.attributes.forEach((_e, _k) => {
                console.log(`\t\t\t| ${_k} : ${print_val(_e, 3)}`);
            });
        });
        console.log("\t__________________________");
    },
    update: function (val) {
        switch (val.kind) {
            case "definitions": {
                return Object.assign({}, this, { definitions: this.definitions.set(val.class_name, (this.definitions.has(val.class_name)
                        ? this.definitions.get(val.class_name)
                        : Immutable.Map())
                        .set(val.att_name, val.att_type)) });
            }
            case "globals": {
                return Object.assign({}, this, { globals: this.globals.set(val.val_name, val.val_content) });
            }
            case "closure": {
                if (this.globals.has(val.val_name))
                    return this;
                // console.log(this.stack)
                let last_index = -1;
                this.stack.forEach((e, i) => {
                    if (i > last_index)
                        last_index = i;
                });
                if (last_index > -1 &&
                    this.stack.get(last_index).has(val.val_name))
                    return this;
                return Object.assign({}, this, { closure: this.closure.set(val.val_name, val.val_content) });
            }
            case "stack": {
                return Object.assign({}, this, { stack: this.stack.set(val.stack_frame, (this.stack.has(val.stack_frame)
                        ? this.stack.get(val.stack_frame)
                        : Immutable.Map())
                        .set(val.val_name, val.val_content)) });
            }
            case "heap": {
                if (val.val == "make_ref") {
                    if (!this.heap.has(val.ref)) {
                        return Object.assign({}, this, { heap: this.heap.set(val.ref, { className: val.class_name, attributes: Immutable.Map() }) });
                    }
                    //it already exists
                    else {
                        return this;
                    }
                }
                else {
                    //update ref
                    return Object.assign({}, this, { heap: this.heap.has(val.ref)
                            ? this.heap.set(val.ref, Object.assign({}, this.heap.get(val.ref), { attributes: val.val.val_content != "none" ? this.heap.get(val.ref).attributes.set(val.val.att_name, val.val.val_content) : this.heap.get(val.ref).attributes }))
                            : this.heap.set(val.ref, { className: val.class_name, attributes: val.val.val_content != "none" ? Immutable.Map().set(val.val.att_name, val.val.val_content) : Immutable.Map() }) });
                }
            }
        }
    }
});
//# sourceMappingURL=memory.js.map