/** Helper function to sensibly sort an array either numerically or stringwise */
function sensibleSortFn(a: any, b: any) {
  if (a === undefined || a === null) {
    if (b === undefined || b === null) return 0;
    if (typeof b === "number") a = 0;
    else a = "";
  }
  if (b === undefined || b === null) {
    if (typeof a === "number") b = 0;
    else b = "";
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(b);
}

/** List of all functions available in the global scope by default */
export default <{ [name: string]: (...args: any[]) => any }>{
  ["abs"]: Math.abs,
  ["floor"]: Math.floor,
  ["ceil"]: Math.ceil,
  ["round"]: Math.round,
  ["min"]: Math.min,
  ["max"]: Math.max,
  ["pow"]: Math.pow,
  ["sqrt"]: Math.sqrt,
  ["random"]: Math.random,
  ["typeof"](val: any) {
    return typeof val;
  },
  ["str"](val: any) {
    return String(val);
  },
  ["chr"](val: any) {
    return String.fromCharCode(val);
  },
  ["parseFloat"]: parseFloat,
  ["parseInt"]: parseInt,
  ["isDefined"](val: any) {
    return val !== undefined && val !== null;
  },
  ["isArray"]: Array.isArray,
  ["isObject"](val: any) {
    return !(
      !(val instanceof Object) ||
      val.constructor !== Object ||
      (Object.prototype.hasOwnProperty.call(val, "constructor") &&
        Object.getPrototypeOf(val).constructor !== Object)
    );
  },
  ["keys"]: Object.getOwnPropertyNames,
  ["merge"](...objs: {}[]) {
    return objs
      .filter((o) => o !== undefined && o !== null)
      .reduce((result, obj) => Object.assign(result, obj), {});
  },
  ["concat"](...arrs: any[]) {
    let result: any[] = [];
    return result.concat.apply(result, arrs);
  },
  ["sort"](array: any[], compareFn: any) {
    if (array === undefined || array === null) return array;
    if (!Array.isArray(array)) throw new Error("Sort input is not an array");
    return array.slice().sort(compareFn || sensibleSortFn);
  },
  ["sortBy"](array: any[], propertyName: string) {
    if (array === undefined || array === null) return array;
    if (!Array.isArray(array)) throw new Error("Sort input is not an array");
    return array.slice().sort((a, b) => sensibleSortFn(a[propertyName], b[propertyName]));
  },
  ["reverse"](val: any) {
    if (val === undefined || val === null) return val;
    if (Array.isArray(val)) return val.slice().reverse();
    return String(val).split("").reverse().join("");
  },
  ["range"](start: number, len: number) {
    if (typeof start !== "number" || isNaN(start) || start !== Math.floor(start))
      throw new TypeError("Invalid range start value: " + start);
    if (typeof len !== "number" || !(len > 0))
      throw new TypeError("Invalid range length value: " + len);
    let result: number[] = [];
    for (let i = start + len - 1; i >= start; i--) result[i - start] = i;
    return result;
  },
  ["toJSON"](val: any) {
    return JSON.stringify(val);
  },
  ["parseJSON"](str: any) {
    return JSON.parse(String(str));
  },
  ["regexp"](pattern: any, flags: any) {
    return flags === undefined
      ? new RegExp(String(pattern))
      : new RegExp(String(pattern), String(flags));
  },
  ["match"](input: any, pattern: any, flags: any) {
    let re =
      flags === undefined
        ? new RegExp(String(pattern))
        : new RegExp(String(pattern), String(flags));
    return String(input).match(re);
  },
  ["date"](...args: any[]) {
    return new (Date as any)(...args); // cannot change type of `args` here...
  },
  ["dateUTC"](y: any, m: any, ...args: any[]) {
    return new Date(Date.UTC(y, m, ...args));
  },
  ["now"]: Date.now,
  ["encodeURI"]: encodeURI,
  ["encodeURIComponent"]: encodeURIComponent,
};
