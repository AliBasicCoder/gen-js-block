import { Block } from "../src";

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
    console.log(code2);

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

    console.log(block._builder.toString());
  });
});
