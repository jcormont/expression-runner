// very simple tests... this obviously needs a more structural approach

const { compile } = require("../dist");

function test(name, fn) {
  console.log("=> ", name);
  let i = 0;
  const expect = (v1, v2) => {
    i++;
    if (v1 !== v2) {
      console.error(`Assertion ${i} failed: `, v1, "!==", v2);
      process.exit(1);
    }
  };
  fn({ expect });
}

console.log("Starting test...");

test("Use literals", (t) => {
  t.expect(compile("1")(), 1);
  t.expect(compile("1.23")(), 1.23);
  t.expect(compile("1.2e3")(), 1.2e3);
  t.expect(compile("1.2E3")(), 1.2e3);
  t.expect(compile(".123")(), 0.123);
  t.expect(compile("0x01")(), 1);
  t.expect(compile("-1")(), -1);
  t.expect(compile("'a'")(), "a");
  t.expect(compile('"a"')(), "a");
  t.expect(compile("true")(), true);
  t.expect(compile("false")(), false);
  t.expect(compile("undefined")(), undefined);
  t.expect(compile("[].length")(), 0);
  t.expect(compile("[1].length")(), 1);
  t.expect(compile("[][0]")(), undefined);
  t.expect(compile("[1][0]")(), 1);
  t.expect(compile("[3,2,1][2]")(), 1);
  t.expect(compile("[3,,1][2]")(), 1);
});

test("Use variables", (t) => {
  let context = { a: 1 };
  t.expect(compile("a")(context), 1);
  t.expect(compile("b = 2", true)(context), 2);
  let obj = compile("{ a, b }")(context);
  t.expect(obj.a, 1);
  t.expect(obj.b, 2);
});

test("Use operators", (t) => {
  let context = { a: 1, b: 2 };
  t.expect(compile("a + b")(context), 3);
  t.expect(compile("b * a + 8")(context), 10);
  t.expect(compile("a + b * 2")(context), 5);
  t.expect(compile("'x' + (a ? 'y' : '0') + 'z'")(context), "xyz");
});

test("Use object spread", (t) => {
  let context = { a: { a: 41 }, b: 2 };
  t.expect(compile("{ ...a, b }.a")(context), 41);
  t.expect(compile("{ b, ...a }.a")(context), 41);
  t.expect(compile("{ b, ...a, }.a")(context), 41);
  t.expect(compile("{ b, ...a, c: 0 }.a")(context), 41);
  t.expect(compile("{ b, ...a, ...a }.a")(context), 41);
});

test("Use array spread", (t) => {
  let context = { a: [1, 2, 3] };
  t.expect(compile("[...a, 4, 5].join(',')")(context), "1,2,3,4,5");
  t.expect(compile("[0, ...a, 4].join(',')")(context), "0,1,2,3,4");
  t.expect(compile("[0, ...a].join(',')")(context), "0,1,2,3");
  t.expect(compile("[0, ...a,].length")(context), 4);
  t.expect(compile("[...a, ...a].length")(context), 6);
});

test("Use null-coalescing", (t) => {
  let context = { v: 1, o: { x: 1 }, a: null, b: undefined };
  t.expect(compile("v ?? 2")(context), 1);
  t.expect(compile("a ?? 2")(context), 2);
  t.expect(compile("b ?? 2")(context), 2);
  t.expect(compile("o.x")(context), 1);
  t.expect(compile("o?.x")(context), 1);
  t.expect(compile("a?.x")(context), null);
  t.expect(compile("b?.x")(context), undefined);
  t.expect(compile("o?.x ?? 2")(context), 1);
  t.expect(compile("a?.x ?? 2")(context), 2);
  t.expect(compile("b?.x ?? 2")(context), 2);
});

test("Use built-in functions", (t) => {
  t.expect(compile("str(0)")(), "0");
  t.expect(compile("abc()", false, { abc: () => 123 })({}), 123);
});

test("Use arrow functions", (t) => {
  t.expect(compile("(()=>41)()")(), 41);
  t.expect(compile("((a)=>41 + a)(1)")(), 42);
  t.expect(compile("f=()=>41;f()", true)(), 41);
});

test("Use multiple expressions", (t) => {
  let context = { a: 1 };
  t.expect(compile("a += 1", true)(context), 2);
  t.expect(compile("a += 1; str(a)", true)(context), "3");
  t.expect(compile("a += 1\nstr(a)", true)(context), "4");
  t.expect(compile("a += 1\n;str(a)", true)(context), "5");
  t.expect(compile(";a += 1;;;str(a);", true)(context), "6");
  t.expect(compile("arr = [3, 2, 1]\narr = sort(arr)\narr[0]", true)(), 1);
});

test("Use if statement", (t) => {
  let context = { a: 1, b: 0 };
  t.expect(compile("if (a) a", true)(context), 1);
  t.expect(compile("if (b) a;", true)(context), undefined);
  t.expect(compile("if (a && !b) { a = 41 }; a", true)(context), 41);
  t.expect(compile("if (a && !b) { a }", true)(context), 41);
  t.expect(compile("if (a && !b) { b, a }", true)(context), 41);
  t.expect(compile("if (a && !b) { b; a }", true)(context), 41);
});

console.log("Done!");
