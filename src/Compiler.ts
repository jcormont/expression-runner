const RESERVED = [
  "break",
  "do",
  "in",
  "typeof",
  "case",
  "else",
  "instanceof",
  "var",
  "catch",
  "export",
  "new",
  "void",
  "class",
  "extends",
  "return",
  "while",
  "const",
  "finally",
  "super",
  "with",
  "continue",
  "for",
  "switch",
  "yield",
  "debugger",
  "function",
  "this",
  "default",
  "if",
  "throw",
  "delete",
  "import",
  "try",
  "enum",
  "await",
  "implements",
  "package",
  "protected",
  "interface",
  "private",
  "public",
];

export enum OPS {
  NOP = 0,
  assign,
  expression,
  arrowfunc,
  tertiary,
  calc,
  unary,
  call,
  object,
  array,
  undef,
  coalesce,
  _resolve,
}
export const ALL_UNARY_SAFE = ["+", "-", "~", "!", "typeof"];
export const ALL_CALC_SAFE = [
  "||",
  "&&",
  "|",
  "^",
  "&",
  "!==",
  "!=",
  "===",
  "==",
  "in",
  "<",
  "<=",
  ">",
  ">=",
  "<<",
  ">>",
  ">>>",
  "+",
  "-",
  "*",
  "/",
  "%",
];

/** Type of syntree node */
enum NodeType {
  token_invalid = "",
  token_literal = "literal",
  token_punct = "punctuation",
  token_id = "identifier",
  resolve = "variable or object",
  object = "object literal",
  array = "array literal",
  member = "member expression",
  call = "call expression",
  unary = "unary expression",
  calc = "dual operand expression",
  tertiary = "tertiary expression",
  arrow_function = "arrow function",
  expression = "expression",
  assign = "assignment",
}

/** Syntax tree node */
class SynTree {
  text?: string;
  outToken?: boolean;
  outValue?: boolean;

  /** Create a syntree node for given token */
  static forToken(compiler: Compiler, type: NodeType, tokenText: string, pos: number) {
    let result = new SynTree(compiler, type);
    result.text = tokenText;
    result._pos = pos;
    return result;
  }

  /** Create a syntree node that combines the text of other nodes */
  static squash(type: NodeType, nodes: SynTree[]) {
    let result = new SynTree(nodes[0]._compiler, type);
    result.text = nodes.map((n) => n.text).join("");
    result._pos = nodes[0]._pos;
    result.children = nodes.slice();
    return result;
  }

  constructor(
    private readonly _compiler: Compiler,
    public type: NodeType,
    public op: OPS = OPS.NOP,
    public children?: SynTree[]
  ) {
    // nothing here
  }

  /** Recursively clone this node */
  clone(): SynTree {
    let result = new SynTree(
      this._compiler,
      this.type,
      this.op,
      this.children && this.children.map((c) => c.clone())
    );
    result._pos = this._pos;
    result.text = this.text;
    result.outToken = this.outToken;
    result.outValue = this.outValue;
    return result;
  }

  /** Returns the line number of this token in the input string */
  getLineNumber(): number {
    let pos = this._pos || 0;
    if (!this._pos && this.children && this.children.length)
      return this.children[0].getLineNumber();

    // get text in front of this token and count the number of newlines
    let before = this._compiler.input.slice(0, pos);
    let line = 1,
      idx = 0;
    while ((idx = before.indexOf("\n", idx) + 1) > 0) line++;
    return line;
  }

  /** Returns true if this token starts on a new line (ignoring newlines after backslash) */
  isOnNewLine(): boolean {
    let pos = this._pos || 0;
    if (!this._pos && this.children && this.children.length) return this.children[0].isOnNewLine();

    // get text in front of this token and match with regex
    let before = this._compiler.input.slice(0, pos);
    return /\n\s*$/.test(before.replace(/\\\r?\n/g, ""));
  }

  private _pos?: number;

  /** Returns the output array for this token or expression */
  getOutput(): string | any[] {
    if (this.outToken) return this.text!;
    if (this.outValue) return eval(this.text!);
    let result = this.op === OPS._resolve ? [] : [<any>this.op];
    if (this.children) {
      for (let n of this.children) {
        if (n.op || n.outToken || n.outValue) result.push(n.getOutput());
      }
    }
    return result;
  }

  /** Traverses the tree and returns an array of strings/objects */
  toJSON(): string | object {
    if (!this.children || !this.children.length) {
      return this.type + (this.text ? " " + this.text : "") + (this.op ? " #" + this.op : "");
    }
    let result: any = {
      type: this.type,
      children: this.children.map((c) => c.toJSON()),
    };
    if (this.text) result.text = this.text;
    if (this.op) result.type += " #" + this.op;
    return result;
  }
}

/** Code compiler, converts simple expressions to JSON code */
export class Compiler {
  constructor(public readonly input: string) {
    // nothing to do here
  }

  /** Returns JSON (stringified) result */
  compile(allowAssignment?: boolean) {
    this._parser(allowAssignment);
    if (this._tree.length > 1) throw new Error();
    let result = this._tree[0].getOutput();
    return Array.isArray(result) ? result : [result];
  }

  /** Traverse syntax tree and return a nested array */
  public toJSON() {
    return this._tree.map((c) => c.toJSON());
  }

  /** Syntax tree (after lexing/parsing input) */
  private _tree: SynTree[] = [];

  /** Parser: generates a full syntree down to a single expression, or fails */
  private _parser(allowAssignment?: boolean) {
    if (!this._tree.length) this._lex();
    let idx = 0;
    let throwUnexpected = () => {
      let unexpected = this._unexpected || this._tree[idx];
      let line = unexpected ? unexpected.getLineNumber() : this.input.split("\n").length;
      let type = unexpected ? unexpected.type : "expression";
      throw new Error(
        `Unexpected ${type} at line ${line}` +
          (unexpected && unexpected.text ? ": " + unexpected.text : "")
      );
    };
    while (true) {
      // remove semicolons at top level
      let isNewStatement = idx === 0;
      while (
        idx < this._tree.length &&
        this._tree[idx].type === NodeType.token_punct &&
        this._tree[idx].text === ";"
      ) {
        this._tree.splice(idx, 1);
        isNewStatement = true;
      }
      if (idx >= this._tree.length) break;

      // check if expecting a new statement/expression, then read it
      if (!isNewStatement && this._tree[idx].isOnNewLine()) {
        isNewStatement = true;
      }
      if (!isNewStatement || !this._expectExpression(idx, true, allowAssignment)) throwUnexpected();
      idx++;
    }

    // merge everything into one expression
    if (this._tree.length > 1) {
      for (let e of this._tree.splice(1)) {
        this._tree[0].children!.push(...e.children!);
      }
    } else if (!this._tree.length) {
      throw new Error("Expression cannot be empty");
    }
  }

  /** Lexer: takes input string and populates the syntax tree */
  private _lex() {
    let result: SynTree[] = (this._tree = []);
    let input = this.input;
    let pos = 0,
      len = input.length;
    let match: RegExpMatchArray | null | undefined;
    let matchToken = (...regexp: RegExp[]) =>
      regexp.some((re) => !!(match = input.match(re))) && match;
    while (pos < len) {
      if (!matchToken(Compiler._regex.space)) {
        // process next token
        let type = matchToken(Compiler._regex.id)
          ? NodeType.token_id
          : matchToken(
              Compiler._regex.number,
              Compiler._regex.numberHex,
              Compiler._regex.stringDbl,
              Compiler._regex.stringSgl
            )
          ? NodeType.token_literal
          : matchToken(Compiler._regex.punct)
          ? NodeType.token_punct
          : NodeType.token_invalid;
        result.push(SynTree.forToken(this, type, match ? match[0] : input[0], pos));

        // stop on invalid token data
        if (!match) {
          let line = result.pop()!.getLineNumber();
          throw new Error(`Unexpected character at line ${line}: ${input[0]}`);
        }
      }
      pos += match![0].length;
      input = this.input.slice(pos);
    }
  }

  private _unexpected?: SynTree;

  /** Returns true if the next token matches given text */
  private _matchText(idx: number, punct: string | string[]) {
    if (typeof punct === "string") return !!(this._tree[idx] && this._tree[idx].text === punct);
    else if (punct.length) return !!this._tree[idx] && punct.indexOf(this._tree[idx].text!) >= 0;
    else return false;
  }

  private _expectExpression(idx: number, multiExpr = true, allowAssignment = false) {
    if (this._tree.length <= idx) return false;
    if (!this._expectTertiary(idx)) return false;

    // found an expression
    let result = this._tree[idx];
    if (result.type !== NodeType.expression) {
      this._tree[idx] = result = new SynTree(this, NodeType.expression, OPS.expression, [
        this._tree[idx],
      ]);
    }

    // check if this is the LHS of an assignment
    if (this._matchText(idx + 1, ["=", "+=", "-=", "*=", "/=", "%="])) {
      if (!allowAssignment) {
        throw new SyntaxError("Assignment not allowed in this expression");
      }
      if (!this._expectExpression(idx + 2, false, allowAssignment)) {
        if (!this._unexpected) this._unexpected = this._tree[idx + 1];
        return false;
      }
      let firstExprChild = this._tree[idx].children![0];
      if (
        this._tree[idx].children!.length > 1 ||
        (firstExprChild.type !== NodeType.resolve && firstExprChild.type !== NodeType.member)
      ) {
        throw new SyntaxError("Cannot assign to " + firstExprChild.type + " expression");
      }
      result = new SynTree(this, NodeType.expression, OPS.expression);
      let assignment = new SynTree(this, NodeType.assign, OPS.assign);
      let [, op, expr] = this._tree.splice(idx, 3, result);
      op.outToken = true;
      assignment.children = [firstExprChild, op, expr];
      result.children = [assignment];
    }

    // now look for commas to continue
    while (multiExpr && this._matchText(idx + 1, ",")) {
      if (!this._expectExpression(idx + 2, false, allowAssignment)) {
        if (!this._unexpected) this._unexpected = this._tree[idx + 1];
        return false;
      }
      let [, expr] = this._tree.splice(idx + 1, 2);
      result.children!.push(expr.children![0]);
    }
    return true;
  }

  private _expectArrowFunctionOrBraced(idx: number) {
    if (this._tree.length <= idx) return false;
    let throwIfArrowFuncWithBlock = (offset: number) => {
      if (this._matchText(idx + offset, "{")) {
        let line = this._tree[idx].getLineNumber();
        throw new Error(`Unsupported arrow function with block at line ${line}`);
      }
    };
    if (this._tree[idx].type === NodeType.token_id && this._matchText(idx + 1, "=>")) {
      // found a single-argument arrow function
      throwIfArrowFuncWithBlock(2);

      // resolve to expression, but do NOT include commas
      let result = new SynTree(this, NodeType.arrow_function, OPS.arrowfunc);
      if (!this._expectExpression(idx + 2, false)) return false;
      result.children = [this._tree[idx], this._tree[idx + 2]];
      this._tree[idx].outToken = true;
      this._tree.splice(idx, 3, result);
      return true;
    }
    if (
      this._matchText(idx, "(") &&
      this._matchText(idx + 1, ")") &&
      this._matchText(idx + 2, "=>")
    ) {
      // found a zero-argument arrow function
      throwIfArrowFuncWithBlock(3);

      // resolve to expression, but do NOT include commas
      let result = new SynTree(this, NodeType.arrow_function, OPS.arrowfunc);
      if (!this._expectExpression(idx + 3, false)) return false;
      result.children = [this._tree[idx + 3]];
      this._tree.splice(idx, 4, result);
      return true;
    }
    if (this._matchText(idx, "(") && idx < this._tree.length - 2) {
      // bracket must be followed by expression first
      if (!this._expectExpression(idx + 1)) {
        if (!this._unexpected) this._unexpected = this._tree[idx];
        return false;
      }
      if (!this._matchText(idx + 2, ")")) {
        if (!this._unexpected) this._unexpected = this._tree[idx + 2];
        return false;
      }

      let result = this._tree[idx + 1];
      if (result.type === NodeType.expression) {
        // use expression itself if possible
        this._tree.splice(idx, 3, result);
      } else {
        // create wrapper expression
        result = new SynTree(this, NodeType.expression, OPS.expression);
        let inner = this._tree.splice(idx, 3, result);
        result.children = [inner[1]];
      }

      // check if part of arrow function
      if (this._matchText(idx + 1, "=>")) {
        throwIfArrowFuncWithBlock(2);

        // get argument list
        let args = result.children!;
        if (
          args.some(
            (n) =>
              n.type !== NodeType.resolve ||
              !n.children ||
              n.children.length !== 1 ||
              n.children[0].type !== NodeType.token_id
          )
        )
          throw new Error("Invalid function argument list");
        result = new SynTree(
          this,
          NodeType.arrow_function,
          OPS.arrowfunc,
          args.map((n) => n.children![0])
        );
        result.children!.forEach((n) => {
          n.outToken = true;
        });

        // resolve to expression, but do NOT include commas
        if (!this._expectExpression(idx + 2, false)) return false;
        result.children!.push(this._tree[idx + 2]);
        this._tree.splice(idx, 3, result);
      }
      return true;
    }
    return false;
  }

  private _expectTertiary(idx: number) {
    if (this._tree.length <= idx) return false;
    if (!this._expectCalc(idx)) return false;
    if (this._matchText(idx + 1, "?") && !this._matchText(idx + 1, "?.")) {
      if (!this._expectExpression(idx + 2, false)) return false;
      if (!this._matchText(idx + 3, ":")) return false;
      if (!this._expectExpression(idx + 4, false)) return false;

      // found a conditional
      let result = new SynTree(this, NodeType.tertiary, OPS.tertiary);
      result.children = this._tree.splice(idx, 5, result);
    }
    return true;
  }

  private _expectCalc(idx: number) {
    if (this._tree.length <= idx) return false;
    if (!this._expectMultiOp(idx)) return false;
    if (this._matchText(idx + 1, "??")) {
      if (!this._expectMemberOrCall(idx + 2)) {
        this._unexpected = this._tree[idx + 1];
        return false;
      }

      // found a coalescing expression
      let result = new SynTree(this, NodeType.calc, OPS.calc);
      result.children = this._tree.splice(idx, 3, result);
      result.children[1].outToken = true;
    }
    return true;
  }

  private _expectMultiOp(idx: number) {
    if (this._tree.length <= idx) return false;

    // first absorb all simple expressions
    let first: SynTree | undefined;
    while (first !== this._tree[idx]) {
      if (!this._expectMemberOrCall(idx)) return false;
      first = this._tree[idx];
    }

    // continue with operator and next operand
    // don't care about precedence and associativity at all
    let result: SynTree | undefined;
    while (this._matchText(idx + 1, ALL_CALC_SAFE)) {
      if (!this._expectMemberOrCall(idx + 2)) {
        this._unexpected = this._tree[idx + 1];
        return false;
      }
      if (!result) {
        // wrap in resulting calc node
        result = new SynTree(this, NodeType.calc, OPS.calc);
        result.children = this._tree.splice(idx, 3, result);
        result.children[1].outToken = true;
      } else {
        // add to existing node
        let [op, node] = this._tree.splice(idx + 1, 2);
        result.children!.push(op, node);
        op.outToken = true;
      }
    }
    return true;
  }

  private _expectMemberOrCall(idx: number, stopAtFirstCall?: boolean) {
    if (!this._expectUnary(idx)) return false;
    let result = this._tree[idx];
    while (true) {
      let operator = this._tree[idx + 1];
      if (!operator) break;
      if (operator.text === "." || operator.text === "?.") {
        // found property access operator: expect ID
        if (!this._tree[idx + 2] || this._tree[idx + 2].type !== NodeType.token_id) {
          this._unexpected = this._tree[idx + 2] || this._tree[idx + 1];
          return false;
        }
        // wrap value tokens in expression, don't confuse with variables
        if (result.outValue) {
          this._tree[idx] = result = new SynTree(this, NodeType.expression, OPS.expression, [
            result,
          ]);
        }
        // insert new member expression
        result = new SynTree(
          this,
          NodeType.member,
          operator.text[0] === "?" ? OPS.coalesce : OPS._resolve
        );
        result.children = this._tree.splice(idx, 3, result);
        result.children[2].outToken = true;
        if (result.children[0].op === OPS._resolve) {
          let nestedChildren = result.children.shift()!.children!;
          result.children.forEach((n) => nestedChildren.push(n));
          result.children = nestedChildren;
        }
        continue;
      }
      if (operator.text === "[") {
        if (!this._expectExpression(idx + 2)) return false;
        if (!this._matchText(idx + 3, "]")) {
          this._unexpected = this._tree[idx + 3] || this._tree[idx + 1];
          return false;
        }
        if (
          this._tree[idx + 2].type === NodeType.expression &&
          this._tree[idx + 2].children!.length === 1
        ) {
          // no need to wrap in expression type, take inner type
          this._tree[idx + 2] = this._tree[idx + 2].children![0];
        }
        // wrap value tokens in value op, don't confuse with variables
        if (result.outValue) {
          this._tree[idx] = result = new SynTree(this, NodeType.expression, OPS.expression, [
            result,
          ]);
        }
        // insert new member expression
        result = new SynTree(this, NodeType.member, OPS._resolve);
        result.children = this._tree.splice(idx, 4, result);
        if (result.children[0].op === OPS._resolve) {
          let nestedChildren = result.children.shift()!.children!;
          result.children.forEach((n) => nestedChildren.push(n));
          result.children = nestedChildren;
        }
        continue;
      }
      if (operator.text === "(") {
        // clone all nodes to be able to undo (see below)
        let deepClone = this._tree.slice(idx).map((n) => n.clone());

        // found a call expression (if brackets match up)
        if (this._matchText(idx + 2, ")") && !this._matchText(idx + 3, "=>")) {
          // empty arguments list
          result = new SynTree(this, NodeType.call, OPS.call);
          result.children = this._tree.splice(idx, 3, result);
          continue;
        }
        if (!this._expectExpression(idx + 2)) return false;
        if (!this._matchText(idx + 3, ")")) {
          this._unexpected = this._tree[idx + 3] || this._tree[idx + 1];
          return false;
        }

        if (this._matchText(idx + 4, "=>")) {
          // this isn't an argument list, it's an arrow function,
          // undo the expression match first, and then match as a function
          // and try again
          this._tree.splice(idx);
          this._tree.push(...deepClone);
          if (!this._expectArrowFunctionOrBraced(idx + 1)) return false;
          continue;
        } else {
          // this is definitely a call expression
          result = new SynTree(this, NodeType.call, OPS.call);
          let [base, , args] = this._tree.splice(idx, 4, result);
          result.children = [base];
          args.children && args.children.forEach((n) => result!.children!.push(n));

          // stop here if required
          if (stopAtFirstCall) break;
          continue;
        }
      }
      break;
    }
    return true;
  }

  private _expectUnary(idx: number) {
    if (this._tree.length <= idx) return false;
    if (this._matchText(idx, ALL_UNARY_SAFE)) {
      // found a unary operator
      if (!this._expectMemberOrCall(idx + 1)) {
        if (!this._unexpected) this._unexpected = this._tree[idx];
        return false;
      }
      // check if simply a negative number
      if (
        this._tree[idx].text === "-" &&
        this._tree[idx + 1].type === NodeType.token_literal &&
        Compiler._regex.number.test(this._tree[idx + 1].text!)
      ) {
        // use original node with sign in front
        let result = SynTree.squash(NodeType.token_literal, this._tree.splice(idx, 2));
        result.outValue = true;
        this._tree.splice(idx, 0, result);
      } else {
        // use unary OP
        let result = new SynTree(this, NodeType.unary, OPS.unary);
        result.children = this._tree.splice(idx, 2, result);
        result.children[0].outToken = true;
      }
      return true;
    }

    // look for primary expressions
    if (this._matchText(idx, "{")) {
      // check for object literal
      let result = new SynTree(this, NodeType.object, OPS.object);
      let offset = 1;
      while (!this._matchText(idx + offset, "}")) {
        if (this._matchText(idx + offset, ",")) {
          offset++;
          continue;
        }
        let keyNode = this._tree[idx + offset];
        if (keyNode.type === NodeType.token_id) {
          // key is a token
          keyNode.outToken = true;

          // check if using variable as property
          if (this._matchText(idx + offset + 1, [",", "}"])) {
            let valueNode = new SynTree(this, NodeType.resolve, OPS._resolve, [keyNode]);
            this._tree.splice(idx + offset + 1, 0, valueNode);
            offset += 2;
            continue;
          }
        } else if (keyNode.type === NodeType.token_literal) {
          // key is a number or string
          keyNode.outValue = true;
        } else {
          this._unexpected = keyNode;
          return false;
        }
        if (this._tree.length < idx + offset + 3 || !this._matchText(idx + offset + 1, ":")) {
          this._unexpected = this._tree[idx + offset];
          return false;
        }

        // parse expression (up to comma)
        if (!this._expectExpression(idx + offset + 2, false)) return false;

        // look for object closing bracket or comma
        offset += 3;
        if (this._matchText(idx + offset, "}")) continue;
        if (!this._matchText(idx + offset, ",")) {
          this._unexpected = this._tree[idx + offset - 1];
          return false;
        }
      }
      result.children = this._tree.splice(idx, offset + 1, result);
      return true;
    } else if (this._matchText(idx, "[")) {
      // check for empty array
      if (this._matchText(idx + 1, "]")) {
        // add empty array node
        this._tree.splice(idx, 2, new SynTree(this, NodeType.array, OPS.array));
        return true;
      }

      // check for array
      if (!this._expectExpression(idx + 1)) return false;

      // replace expression node with array node
      let arrayNode = this._tree[idx + 1];
      arrayNode.type = NodeType.array;
      arrayNode.op = OPS.array;
      this._tree.splice(idx, 3, arrayNode);
      return true;
    } else if (this._tree[idx].type === NodeType.token_id && !this._matchText(idx + 1, "=>")) {
      // found an identifier: check if literal or variable
      let node = this._tree[idx];
      let text = node.text!;
      if (text === "true" || text === "false" || text === "null") {
        node.type = NodeType.token_literal;
        node.outValue = true;
      } else if (text === "undefined") {
        // encode undefined separately because it doesn't exist in JSON
        node.type = NodeType.token_literal;
        node.op = OPS.undef;
      } else if (RESERVED.indexOf(text) >= 0) {
        this._unexpected = node;
        return false;
      } else {
        let resolver = new SynTree(this, NodeType.resolve, OPS._resolve, [node]);
        node.outToken = true;
        this._tree[idx] = resolver;
      }
      return true;
    } else if (this._tree[idx].type === NodeType.token_literal) {
      this._tree[idx].outValue = true;
      return true;
    } else if (
      this._tree[idx].type === NodeType.arrow_function ||
      this._expectArrowFunctionOrBraced(idx)
    ) {
      // found a literal or braced expression
      return true;
    }

    this._unexpected = this._tree[idx];
    return false;
  }

  static readonly _regex: { [id: string]: RegExp } = {
    space: /^(?:\\\r?\n|\s+)/,
    number: /^(?=[1-9]|0(?!\d))[_\d]+(\.\d+)?([eE][+-]?\d+)?/,
    numberHex: /^0x[0-9A-F]+/,
    stringDbl: /^\"(?:[^\\\"]+|\\["'\\bfnrt\/]|\\u[0-9a-f]{4})*\"/,
    stringSgl: /^\'(?:[^\\\']+|\\["'\\bfnrt\/]|\\u[0-9a-f]{4})*\'/,
    id: /^@?[a-zA-Z_$][\w$]*/,
    punct: /^(?:\:\:|\+=|-=|\*=|\/=|%=|===|!==|!=|==|>>>|>>|<<|>=|<=|=>|\?\?|\&\&|\|\||\?\.|[\{\}\(\)\[\]\.:;,<>\?~!^\|\&%\/\*\-\+=])/,
  };
}
