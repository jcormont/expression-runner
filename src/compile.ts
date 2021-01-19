import { Compiler } from "./Compiler";
import { Runtime } from "./Runtime";

/** Compile given expression, returns a function that runs the expression with given variables */
export function compile(
  expression: string,
  options:
    | true
    | {
        allowAssignment?: boolean;
        allowStatement?: boolean;
      } = {},
  extraFunctions?: { [id: string]: Function }
) {
  if (options === true) options = { allowStatement: true };
  let compiled = new Compiler(String(expression), options).compile();
  console.log(JSON.stringify(compiled));
  let Factory = Runtime.scopeFactory(compiled);
  return (vars: any) => {
    let functions = extraFunctions
      ? { ...Runtime.functions, ...extraFunctions }
      : Runtime.functions;
    let scope = new Factory(vars, functions);
    return scope.run();
  };
}
