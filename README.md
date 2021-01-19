# Expression Runner

Simple JavaScript-like script compiler and sandbox runner. Given a script as a string, the compiler generates a function, which evaluates the expression without access to the context of the calling code.

**Install:** `npm install expression-runner`

---

## Syntax

Expression-runner has limited support for statements:

- if, else
- while
- for, for...in, for...of
- continue, break
- let, const
- function, return

The following JavaScript syntax is allowed within expressions:

- literal tokens (strings, numbers, etc. but not regular expressions)
- array and object literals (e.g. `[1, 2]`, `{ a: 1 }`, `{ a, b, ...c }`)
- function literals (e.g. `(a) => a + 1`, but only using a single expression)
- variables and property access
- function and method calls
- calculations with one or more operands, brackets, typeof, delete, etc.
- null-coalescing expressions using `??` and `?.` operators
- tertiary expressions (e.g. `a ? b : c`)
- assignments (top-level only, e.g. `a = 1`, `b += 2`), but _not_ `++` and `--`

Notably, support for `new` is missing, along with other prototype-based features and 'standard library' objects. Function calls may only include calls to default functions (see list below), as well as 'safe' methods on strings, numbers, arrays, dates, and the RegExp `test` method; these do not modify anything other than the original value.

## Usage: as single function

The easiest way to use this library is with the `compile()` method:

```js
let myVars = { a: 1 };
const f1 = compile("a + 1");
let result = f1(myVars);
console.log(result)  // => 2
```

Expressions can also be assignments, but those cannot appear in the middle of another expression (e.g. _not_ `a = (b = 2)` but `b = 2` itself is allowed).

To allow assignments, pass `true` as the second argument to the `compile` function.

```js
let myVars = {};
const f2 = compile("a = 42", true);
f2(myVars);
console.log(myVars.a)  // => 42
```

The final argument to the `compile` function can be used to pass additional functions that will be available within the compiled expression.

```js
let check = 0;
const setCheck = (i) => { check = i };
const f3 = compile("set(42)", false, { set: setCheck });
f3();
console.log(setCheck)  // => 42
```

## Precompilation

For manual compilation, especially if you do not want to make the default functions available or if you want to run the same expression multiple times within the same scope (variables), use the following exported classes:

- class `Compiler`
    - Instantiate a compiler object with a given expression: `new Compiler(expr)`
    - Compile the expression to an intermediate form: `ic = compiler.compile()`; optionally, pass in `true` to allow assignments at the top level.
- class `Runtime`
    - Use the static `scopeFactory` method to create a `Runtime` constructor that encapsulates the intermediate code: `R = Runtime.scopeFactory(ic)`
    - Instantiate this constructor, passing in (optional) variables and functions as an object: `new R(vars, fns)`. This represents the 'scope' that the expression code will run in
    - Default functions are available as `Runtime.functions`
    - The `Runtime` object's `run()` method evaluates the expression, and returns its result: `result = r.run()`

## Default functions

Other than 'safe' methods on strings, numbers, arrays, dates, and regular expressions (created using the `regexp` function, since regular expression literals are not allowed), the following 'global' functions are available within expressions.

- Math functions: `abs`, `floor`, `ceil`, `round`, `min`, `max`, `pow`, `sqrt`, `random`
- `typeof(value)` — result of `typeof value` in JavaScript
- `str(value)` — convert to string
- `chr(value)` — get string from character code (unicode)
- `parseFloat(value)` — same as JavaScript `parseFloat`
- `parseInt(value)` — same as JavaScript `parseInt`
- `isDefined(value)` — returns true if value is not undefined or null
- `isArray(value)` — same as JavaScript `Array.isArray(...)`
- `isObject(value)` — returns true if value is a plain object
- `keys(object)` — same as JavaScript `Object.keys(...)`
- `merge(...objects)` — returns a new object with all properties from given objects
- `concat(...arrays)` — returns a new array with all elements from given arrays
- `sort(array, [compareFn])` — returns a copy of the array that is sorted; the comparison function is optional, a default is provided that works well for both strings and numbers
- `sortBy(arrayOfObjects, propertyName)` - returns a copy of the array that is sorted by the property with given name
- `reverse(array)` — returns a copy of the array in reverse order
- `range(start, length)` — returns an array of numbers starting with `start`, of given length
- `toJSON(value)` — same as JavaScript `JSON.stringify(...)`
- `parseJSON(string)` — same as JavaScript `JSON.parse(...)`
- `regexp(patternString, [flags])` — same as JavaScript `new RegExp(...)`
- `match(string, patternString, [flags])` — same as JavaScript `string.match(...)`
- `date(...values)` — same as JavaScript `new Date(...)`
- `dateUTC(y, m, ...d)` — same as JavaScript `new Date(Date.UTC(y, m, ...))`
- `now()` — same as JavaScript `Date.now()` (i.e. returns a number)
- `encodeURI(string)` — same as JavaScript `encodeURI(...)`
- `encodeURIComponent(string)` — same as JavaScript `encodeURIComponent(...)`

