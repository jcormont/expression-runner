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

test("Use functions", (t) => {
  t.expect(compile("str(0)")(), "0");
  t.expect(compile("abc()", false, { abc: () => 123 })({}), 123);
});

test("Use multiple expressions", (t) => {
  let context = { a: 1 };
  t.expect(compile("a += 1", true)(context), 2);
  t.expect(compile("a += 1; str(a)", true)(context), "3");
  t.expect(compile("a += 1\nstr(a)", true)(context), "4");
  t.expect(compile("[3, 2, 1]\nsort($_)\n$_[0]")(), 1);
});

console.log("Done!");
