import { ALL_CALC_SAFE, ALL_UNARY_SAFE, OPS } from "./Compiler";
import functions from "./functions";

const RESOLVE_FN = "$r";
const ASSIGN_FN = "$as";
const CALL_FN = "$c";
const DEFINE_FN = "$fn";
const TOP_FN = "$_";
const DEFINED_FN_MARKER = "$_RUNTIME_DEFINED_$";

// convert safe operators to a lookup table
const _safe_ = {};
const UNARY_SAFE: any = {};
ALL_UNARY_SAFE.forEach((op) => {
  UNARY_SAFE[op] = _safe_;
});
const CALC_SAFE: any = {};
ALL_CALC_SAFE.forEach((op) => {
  CALC_SAFE[op] = _safe_;
});

// Safe methods:
const STRING_SAFE: { [id: string]: any } = {
  length: _safe_,
  charAt: _safe_,
  charCodeAt: _safe_,
  endsWith: _safe_,
  startsWith: _safe_,
  indexOf: _safe_,
  lastIndexOf: _safe_,
  match: _safe_,
  replace: _safe_,
  slice: _safe_,
  split: _safe_,
  toLowerCase: _safe_,
  toUpperCase: _safe_,
  trim: _safe_,
};
const ARRAY_SAFE: { [id: string]: any } = {
  length: _safe_,
  concat: _safe_,
  entries: _safe_,
  every: _safe_,
  fill: _safe_,
  filter: _safe_,
  find: _safe_,
  findIndex: _safe_,
  flat: _safe_,
  forEach: _safe_,
  includes: _safe_,
  indexOf: _safe_,
  join: _safe_,
  lastIndexOf: _safe_,
  map: _safe_,
  pop: _safe_,
  push: _safe_,
  reduce: _safe_,
  reduceRight: _safe_,
  reverse: _safe_,
  shift: _safe_,
  slice: _safe_,
  some: _safe_,
  sort: _safe_,
  splice: _safe_,
  unshift: _safe_,
};
const NUMBER_SAFE: { [id: string]: any } = {
  toFixed: _safe_,
};
const REGEXP_SAFE: { [id: string]: any } = {
  test: _safe_,
};
const DATE_SAFE: { [id: string]: any } = {
  getTime: _safe_,
  getFullYear: _safe_,
  getUTCFullYear: _safe_,
  getMonth: _safe_,
  getUTCMonth: _safe_,
  getDate: _safe_,
  getUTCDate: _safe_,
  getDay: _safe_,
  getUTCDay: _safe_,
  getHours: _safe_,
  getUTCHours: _safe_,
  getMinutes: _safe_,
  getUTCMinutes: _safe_,
  getSeconds: _safe_,
  getUTCSeconds: _safe_,
  getMilliseconds: _safe_,
  getUTCMilliseconds: _safe_,
  getTimezoneOffset: _safe_,
  toISOString: _safe_,
};

/** Helper function that returns true only if given object is a plain object */
function isPlainObject(obj: any) {
  return !(
    !(obj instanceof Object) ||
    obj.constructor !== Object ||
    (Object.prototype.hasOwnProperty.call(obj, "constructor") &&
      Object.getPrototypeOf(obj).constructor !== Object)
  );
}

/** Returns true if property is safe to read */
function isSafeReadable(obj: any, propertyName: string) {
  if (
    (typeof obj === "string" && STRING_SAFE[propertyName] === _safe_) ||
    (typeof obj === "number" && NUMBER_SAFE[propertyName] === _safe_) ||
    (Array.isArray(obj) && ARRAY_SAFE[propertyName] === _safe_) ||
    (obj instanceof RegExp && REGEXP_SAFE[propertyName] === _safe_) ||
    (obj instanceof Date && DATE_SAFE[propertyName] === _safe_)
  ) {
    return true;
  } else if (
    (typeof obj === "string" || Array.isArray(obj)) &&
    (typeof propertyName === "number" || /^\d+$/.test(propertyName))
  ) {
    // numeric properties are OK
    return true;
  } else if (obj instanceof Object && Object.prototype.hasOwnProperty.call(obj, propertyName)) {
    // own property is fine
    return true;
  }
  return false;
}

/** Returns true if property is safe to write to */
function isSafeAssignable(obj: any, propertyName: string) {
  if (Array.isArray(obj)) {
    // check array properties
    if (
      propertyName !== "length" &&
      typeof propertyName !== "number" &&
      !/^\d+$/.test(propertyName)
    )
      return false;
  } else if (!isPlainObject(obj)) {
    // not an array or plain object, stay away
    return false;
  }
  return true;
}

/** Runtime environment for compiled code to run in */
export abstract class Runtime {
  /** Set of default functions */
  static readonly functions = functions;

  /** Generator that takes compiled code and returns a Runtime constructor */
  static scopeFactory(compiled: any[]): new (vars?: any, functions?: any) => Runtime {
    let expand = (n: any) => (Array.isArray(n) ? makeCode(n) : JSON.stringify(n));
    let follow = (n: any[]) => n.map(expand).join(",");
    let makeCode = (expr: any[], isTop?: boolean): string => {
      if (!expr || !Array.isArray(expr)) throw new SyntaxError(JSON.stringify(expr));
      switch (expr[0]) {
        case OPS.assign:
          // (LHS in expr[1] is always a 'resolve' operation)
          if (expr[1][0] !== OPS.resolve) throw TypeError();
          let isVarToAssign = !Array.isArray(expr[1][1]) ? 1 : 0;
          let lhsExpr = follow(expr[1].slice(1));
          let valueExpr = expand(expr[3]);
          return (
            ASSIGN_FN +
            "(" +
            JSON.stringify(expr[2]) +
            "," +
            isVarToAssign +
            "," +
            valueExpr +
            "," +
            lhsExpr +
            ")"
          );
        case OPS.expression:
          return isTop
            ? expr.length === 2 && Array.isArray(expr[1])
              ? TOP_FN + "(" + makeCode(expr[1], true) + ")"
              : expr
                  .slice(1)
                  .map((n) => TOP_FN + "(" + expand(n) + ")")
                  .join(",\n")
            : "(" + follow(expr.slice(1)) + ")";
        case OPS.arrowfunc:
          let arrowArgs = expr.slice(1, -1);
          if (arrowArgs.some((s) => !/^[a-zA-Z_$][\w$]*$/.test(s)))
            throw new SyntaxError(arrowArgs.toString());
          let code = arrowArgs.map((s) => ASSIGN_FN + "('=',1," + s + ",'" + s + "')");
          code.push(expand(expr[expr.length - 1]));
          return (
            DEFINE_FN + "(function(" + arrowArgs.join(",") + "){ return " + code.join() + " })"
          );
        case OPS.tertiary:
          return expand(expr[1]) + "?" + expand(expr[2]) + ":" + expand(expr[3]);
        case OPS.calc:
          let calcResult = expand(expr[1]);
          for (let idx = 2; idx < expr.length; idx += 2) {
            if (expr[idx] === "??") {
              calcResult =
                "(" +
                "((v,f)=>((v!==undefined&&v!==null)?v:f()))" +
                "(" +
                calcResult +
                ",()=>(" +
                expand(expr[idx + 1]) +
                "))" +
                ")";
            } else {
              if (CALC_SAFE[expr[idx]] !== _safe_) throw new SyntaxError();
              calcResult += " " + expr[idx] + " " + expand(expr[idx + 1]);
            }
          }
          return calcResult;
        case OPS.unary:
          if (UNARY_SAFE[expr[1]] !== _safe_) throw new SyntaxError(expr[1]);
          return expr[1] + "(" + expand(expr[2]) + ")";
        case OPS.call:
          return CALL_FN + "(" + follow(expr.slice(1)) + ")";
        case OPS.object:
          let objMembers: string[] = [];
          for (let idx = 1; idx < expr.length; idx++) {
            if (Array.isArray(expr[idx]) && expr[idx][0] === OPS.spread) {
              objMembers.push("..." + expand(expr[idx][1]));
            } else {
              let prop = expand(expr[idx++]);
              let val = expand(expr[idx]);
              objMembers.push(prop + ": " + val);
            }
          }
          return "{" + objMembers.join() + "}";
        case OPS.array:
          let arrElts: string[] = [];
          for (let idx = 1; idx < expr.length; idx++) {
            if (Array.isArray(expr[idx]) && expr[idx][0] === OPS.spread) {
              arrElts.push("..." + expand(expr[idx][1]));
            } else {
              arrElts.push(expand(expr[idx]));
            }
          }
          return "[" + arrElts.join() + "]";
        case OPS.undef:
          return "undefined";
        case OPS.coalesce:
          let isVarToCoalesce = !Array.isArray(expr[1]) ? 1 : 0;
          return RESOLVE_FN + "(1," + isVarToCoalesce + "," + follow(expr.slice(1)) + ")";
        case OPS.resolve:
          let isVarToResolve = !Array.isArray(expr[1]) ? 1 : 0;
          return RESOLVE_FN + "(0," + isVarToResolve + "," + follow(expr.slice(1)) + ")";
        default:
          throw TypeError();
      }
    };

    // create the actual runner function
    let runner = new Function(
      TOP_FN,
      CALL_FN,
      DEFINE_FN,
      RESOLVE_FN,
      ASSIGN_FN,
      "return " + makeCode(<any>compiled, true)
    );

    // return a specific class with this runner
    class CompiledRuntime extends Runtime {
      run() {
        return runner(
          this._top_fn,
          this._call_fn,
          this._define_fn,
          this._resolve_fn,
          this._assign_fn
        );
      }
    }
    return CompiledRuntime;
  }

  /** Constructor, takes a set of variables as an object */
  constructor(vars: any = {}, functions?: any) {
    this.vars = vars;
    this.functions = functions;
  }

  /** Current variable scope */
  public vars: any;

  /** Global functions available to the expression code */
  public readonly functions?: { [id: string]: Function };

  /** Runs the expression and returns its result */
  abstract run(): any;

  /** Set $_ variable to given value (to be assigned using `set` clause) */
  setResult(result: any) {
    this.vars.$_ = result;
  }

  // bound private functions:
  private _top_fn = (result: any) => (this.vars.$_ = result);
  private _resolve_fn = (
    coalesce: boolean,
    isVar: boolean,
    base: any,
    ...propertyNames: string[]
  ) => {
    // get base value from variables, if defined at all
    let cur = base;
    if (isVar) {
      if (this._whereVarDefined(base)) cur = this.vars[base];
      else if (this.functions?.hasOwnProperty(base))
        cur = this._define_fn(this.functions[base], true);
      else throw Error("Variable is not defined: " + base);
    }

    // get property/ies (only for own properties of objects/arrays, and common methods)
    let curName = isVar ? base : "(" + typeof base + ")";
    for (let propertyName of propertyNames) {
      if (coalesce && (cur === undefined || cur === null)) return cur;
      curName += "." + propertyName;
      if (cur === undefined || cur === null)
        throw Error(`Cannot read property ${curName} of undefined value ${cur}`);
      if (!isSafeReadable(cur, propertyName)) {
        // not safe or doesn't exist on object itself
        cur = undefined;
      } else {
        // read property, wrap functions
        let value = cur[propertyName];
        if (typeof value === "function" && !value[DEFINED_FN_MARKER])
          cur = this._define_fn(cur[<any>propertyName], true, cur);
        else cur = value;
      }
    }
    return cur;
  };
  private _assign_fn = (
    op: string,
    isVar: boolean,
    value: any,
    base: any,
    ...propertyNames: any[]
  ) => {
    let o: any;
    let propertyName!: string;
    if (isVar && !propertyNames.length) {
      // set single variable
      o = this.vars;
      propertyName = base;
    } else {
      // find base object
      o = base;
      if (isVar) {
        if (!this._whereVarDefined(base)) throw Error("Variable is not defined: " + base);
        o = this.vars[base];
      }
      let curName = isVar ? base : "(" + typeof base + ")";

      // go through all property names to find target
      let i = 0,
        len = propertyNames.length;
      for (; i < len; i++) {
        if (o === undefined || o === null) break;
        if (i) o = o[propertyName];
        propertyName = propertyNames[i];
        curName += "." + propertyName;
        if (!isSafeAssignable(o, propertyName)) throw Error("Cannot assign to " + curName);
      }

      // assign to the last property
      if (o === undefined || o === null)
        throw Error(`Cannot access property of undefined value ${curName}`);
      if (typeof o[propertyName] === "function" && !o[propertyName][DEFINED_FN_MARKER])
        throw Error("Cannot overwrite native function " + curName);
    }
    if (o === this.vars) {
      o = this._whereVarDefined(base) || this.vars;
    }
    if (op !== "=" && !(propertyName in o)) o[propertyName] = undefined;
    switch (op) {
      case "+=":
        return (o[propertyName] += value);
      case "-=":
        return (o[propertyName] -= value);
      case "*=":
        return (o[propertyName] *= value);
      case "/=":
        return (o[propertyName] /= value);
      case "%=":
        return (o[propertyName] %= value);
      default:
        return (o[propertyName] = value);
    }
  };
  private _define_fn = (f: any, isNative?: boolean, bind?: any) => {
    // set flag on given function to make it calleable below
    if (typeof f !== "function") throw new Error();
    let _f = f;
    if (isNative) {
      // wrap native function and bind if needed
      f = function (this: any) {
        return _f.apply(this, arguments);
      };
      if (bind !== undefined) f = f.bind(bind);
    } else {
      // wrap user function to push/pop variable scope
      let scope = this;
      f = function () {
        let _vars = scope.vars;
        scope.vars = Object.create(scope.vars);
        try {
          return _f.apply(undefined, arguments);
        } finally {
          scope.vars = _vars;
        }
      };
    }
    f[DEFINED_FN_MARKER] = true;
    return f;
  };
  private _call_fn = (fn: any, ...args: any[]) => {
    if (typeof fn !== "function" || !fn[DEFINED_FN_MARKER]) throw Error("Not a function");
    try {
      return (fn as Function).apply(undefined, args);
    } catch (err) {
      throw Error(err.message);
    }
  };

  /** Returns object (prototype) where given variable is defined, if any */
  private _whereVarDefined(name: string) {
    if (typeof name !== "string") return false;
    let obj = this.vars;
    while (obj) {
      if (Object.prototype.hasOwnProperty.call(obj, name)) return obj;
      obj = Object.getPrototypeOf(obj);
    }
    return false;
  }
}
