import { Block, insertCode } from "../src";

describe("main module", () => {
  test("non-template code returns as is", () => {
    const called = [] as number[];

    const block = new Block<{}>(() => {
      function some(target: number[]) {
        target.push(1);
        for (let i = 2; i <= 10; i++) {
          target.push(i);
        }
        if (1 + 2 === 3 + 0) target.push(11);
        else {
          target.push(-1);
        }
        const arr = [12, 13, 14];
        for (const item of arr) {
          target.push(item);
        }
        try {
          throw 15;
        } catch (error) {
          target.push(error as number);
        }
        12 % 2 === 0 ? target.push(16) : target.push(-1);
      }
      some;
    });
    // console.log(block.build({}));

    block.eval({})(called);

    expect(called).toStrictEqual(
      Array(16)
        .fill(0)
        .map((_, i) => i + 1)
    );
  });

  test("replace simple template variables", () => {
    const block = new Block<{
      $number: number;
      $date: Date;
      $obj: any;
      $string: string;
    }>(($number: number, $date: Date, $obj: any, $string: string) => {
      function some(target: any) {
        target.$number = $number;
        target.$date = $date;
        target.$obj = $obj;
        target.$string = $string;
      }
      some;
    });
    const $number = 12;
    const $date = new Date(0);
    const $obj = { hello: "world" };
    const $string = "hello world";
    const target = {} as any;
    const expected = { $date, $number, $obj, $string };
    block.eval(expected)(target);

    expect(target).toStrictEqual(expected);
  });

  test("template if-statements", () => {
    const block = new Block<{ $cond: number }>(($cond: number) => {
      function some(target: number[]) {
        if ($cond === 0) {
          target.push(0);
        } else if ($cond === 1) target.push(1);
        else target.push(2);
      }
      some;
    });
    const code0 = block.build({ $cond: 0 });
    const code1 = block.build({ $cond: 1 });
    const code2 = block.build({ $cond: 2 });

    expect(!code0.includes("1") && !code0.includes("2")).toBeTruthy();
    expect(!code1.includes("0") && !code1.includes("2")).toBeTruthy();
    expect(!code2.includes("0") && !code2.includes("1")).toBeTruthy();

    const target = [] as number[];
    eval(code0)(target);
    eval(code1)(target);
    eval(code2)(target);

    expect(target).toStrictEqual([0, 1, 2]);
  });

  test("template for-loops", () => {
    const block = new Block<{ $arr: number[] }>(($arr: number[]) => {
      function some(target: number[]) {
        for (const $item of $arr) {
          target.push($item);
        }
      }
      some;
    });
    const $arr = [0, 1, 2];
    const code = block.build({ $arr });

    expect(
      code.includes("0") && code.includes("1") && code.includes("2")
    ).toBeTruthy();

    const target = [] as number[];
    eval(code)(target);

    expect(target).toStrictEqual($arr);
  });

  test("template if-statement and for-loops", () => {
    const block = new Block<{ $arr: number[]; $cond: number }>(
      ($arr: number[], $cond: number) => {
        function some(target: number[]) {
          for (const $item of $arr) {
            if ($cond === 0) {
              target.push($item);
            } else if ($cond === 1) target.push($item + 1);
            else target.push($item + 2);
          }
        }
        some;
      }
    );
    const $arr = [0, 1, 2];
    const code0 = block.build({ $arr, $cond: 0 });
    const code1 = block.build({ $arr, $cond: 1 });
    const code2 = block.build({ $arr, $cond: 2 });
    expect(
      code0.includes("0") && code0.includes("1") && code0.includes("2")
    ).toBeTruthy();
    expect(
      code1.includes("0") && code1.includes("1") && code1.includes("2")
    ).toBeTruthy();
    expect(
      code2.includes("0") && code2.includes("1") && code2.includes("2")
    ).toBeTruthy();

    const target = [] as number[];
    eval(code0)(target);
    eval(code1)(target);
    eval(code2)(target);

    expect(target).toStrictEqual([0, 1, 2, 1, 2, 3, 2, 3, 4]);
  });

  test("template break and continue", () => {
    const block = new Block<{ $arr: number[] }>(($arr: number[]) => {
      function some(target: number[]) {
        $loop: for (const $item of $arr) {
          if ($item === 0) continue $loop;
          target.push($item);
          if ($item === 1) break $loop;
        }
      }
      some;
    });
  });

  test("template function call", () => {
    const block = new Block<{ $n: number; $fn: (n: number) => number }>(
      ($n: number, $fn: (n: number) => number) => {
        function result() {
          return $fn($n);
        }
        result;
      }
    );
    const $fn = (n: number): number => (n < 2 ? 1 : n * $fn(n - 1));
    const $n = 5;
    const code = block.build({ $n, $fn });

    expect(code.includes("120")).toBeTruthy();
    expect(eval(code)()).toBe(120);
  });

  test("template recursion", () => {
    function productFact(n: number) {
      const block = new Block<{ $n: number; $fn: Function }>(
        ($n: number, $fn: Function) => {
          if ($n < 2) 1;
          else {
            $fn($n - 1);
          }
        }
      );

      return block.build({ $n: n, $fn: productFact });
    }

    const code = productFact(3);
    expect(
      code.includes("3") && code.includes("2") && code.includes("1")
    ).toBeTruthy();
  });

  test("inline option", () => {
    const block = new Block<{ $message: string }>(
      ($message: string) => {
        console.log($message);
      },
      { inlineVariables: true }
    );

    const code = block.build({ $message: "hello world" });

    expect(code).toContain('console.log("hello world")');
  });

  test("inline some variables", () => {
    const block = new Block<{ $message: string; $message2: string }>(
      ($message: string, $message2: string) => {
        console.log($message, $message2);
      },
      { inlineVariables: ["$message"] }
    );
    const code = block.build({
      $message: "hello world!",
      $message2: "hello, again",
    });

    expect(code).toContain('console.log("hello world!", $message2)');
  });

  test("inline option in for loop", () => {
    const block = new Block<{ $messages: string[] }>(
      ($messages: string[]) => {
        for (const $message of $messages) {
          console.log($message);
        }
      },
      { inlineVariables: true }
    );
    const code = block.build({ $messages: ["hi", "hello", "world"] });

    expect(code).toContain('console.log("hi")');
    expect(code).toContain('console.log("hello")');
    expect(code).toContain('console.log("world")');
  });

  test("inline option in member expression", () => {
    const block = new Block<{ $obj: any }>(
      ($obj: any) => {
        console.log($obj.some.message);
      },
      { inlineVariables: true }
    );
    const code = block.build({ $obj: { some: { message: "hello world" } } });

    expect(code).toContain('console.log("hello world")');
  });

  test("insert code", () => {
    const block = new Block<{ $fn: any }>(
      ($a: any) => {
        $a = "hello";
      },
      { inlineVariables: true }
    );

    // @ts-ignore
    const code = block.build({ $a: insertCode("myvar") });

    expect(code).toContain('myvar = "hello";');
  });
  // first bug: if template variable is the first part in a member expression
  // and that expression has variables that doesn't start with a $
  // it will be consider as a non-template condition...
  // second bug: inline variables that are in a member expression inside a if-statement will
  // cause error
  // TODO: give this test a name
  test("some", () => {
    const block = new Block<{ $s: any; $b: any; $c: string }>(
      ($s: any, $b: any, $c: string) => {
        if ($b.default === "world") console.log("hi");
        $s = $b.default;
        console.log(`this message is "${$c}"`);
      },
      { inlineVariables: true }
    );

    const code = block.build({
      $s: insertCode("object.name"),
      $b: { default: "hello" },
      $c: "hello world",
    });

    expect(code.includes('console.log("hi")')).toBeFalsy();
    expect(code).toContain(`object.name = "hello"`);
    expect(code).toContain('`this message is "${"hello world"}"`');
  });
});
