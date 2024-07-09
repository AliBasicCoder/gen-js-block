# gen-js-block

[![npm](https://img.shields.io/npm/dm/gen-js-block)](https://npmjs.com/package/gen-js-block)
[![npm](https://img.shields.io/npm/v/gen-js-block)](https://npmjs.com/package/gen-js-block)

[![GitHub issues](https://img.shields.io/github/issues/AliBasicCoder/gen-js-block)](https://github.com/AliBasicCoder/gen-js-block/issues)
[![GitHub forks](https://img.shields.io/github/forks/AliBasicCoder/gen-js-block)](https://github.com/AliBasicCoder/gen-js-block/network)
[![GitHub stars](https://img.shields.io/github/stars/AliBasicCoder/gen-js-block)](https://github.com/AliBasicCoder/gen-js-block/stargazers)
[![GitHub license](https://img.shields.io/github/license/AliBasicCoder/gen-js-block)](https://github.com/AliBasicCoder/gen-js-block/blob/master/LICENSE)

a js-library to generate js code with js code

> if you like this package please star it in [github](https://github.com/AliBasicCoder/gen-js-block)

## Usage

all variables that start with $ are called template variables

if you use a template variable in an if statement it becomes a template if-statement

and the code inside will not be in the output
if the condition is false

```js
import { Block } from "gen-js-block";

const block = new Block(($condition) => {
  if ($condition) {
    console.log("$condition is true");
  } else {
    console.log("$condition is false");
  }
});

console.log(block.build({ $condition: true })); // => {console.log("$condition is true");}
console.log(block.build({ $condition: false })); // => {console.log("$condition is false");}
```

similarly for-of and for-in loops with template variables in them are called template loops (c-style loops can't be template maybe in the future)

```js
import { Block } from "gen-js-block";

const block = new Block(($array) => {
  for (const $item of $array) {
    console.log($item);
  }
});

console.log(block.build({ $array: [0, 1, 2] }));
// => {const $item = 0;console.log($item);};{const $item = 1;console.log($item);};{const $item = 2;console.log($item)};
```

and also the value of template variables will be included in the code,
so you can use them in the result code

```js
import { Block } from "gen-js-block";

const block = new Block(($message) => {
  console.log($message);
});

console.log(block.build({ $message: "hello world!" }));
// => {const $message = "hello world!";console.log($message);}
```

also if you call a function that starts with $ and it's an argument of the function passed to
the block class then the string returned from that call will be added to the result code as is

example: let's say you want to make code that returns a function that returns a random number

```js
import { Block } from "gen-js-block";

const block = new Block(($fn) => {
  function result() {
    return $fn();
  }
  result;
});

const code = block.build({ $fn: Math.random });
// => {const $fn = undefined;function result() { return 0.5542537758332537 }; result;}
console.log(eval(code)());
// => 0.5542537758332537
console.log(eval(code)());
// => 0.5542537758332537
```

example 2: let's say you want to print numbers from 3 to 0 but using recursion instead of loops...

```js
function recur(n: number) {
  const block = new Block(($fn: any, $n: any) => {
    if ($n < 1) {
      console.log(0);
    } else {
      console.log($n);
      // these brackets are needed in these case
      // and most cases
      {
        $fn($n - 1);
      }
    }
  });

  return block.build({ $n: n, $fn: recur });
}
const code = recur(3);
console.log(code);
// => const $fn = undefined;const $n = 3;{console.log($n);{const $fn = undefined;const $n = 2;{console.log($n);{const $fn = undefined;const $n = 1;{console.log($n);{const $fn = undefined;const $n = 0;{console.log(0);};}};}};}}
eval(code);
// => 3
// => 2
// => 1
// => 0
```

## inline options

you might have noticed that instead of replacing template variables in the result code
gen-js-block defines them on top, if you want it to replace it instead use this

```js
import { Block } from "gen-js-block";

const block = new Block(
  ($message) => {
    console.log($message);
  },
  { inlineVariables: true }
);

console.log(block.build({ $message: "hello world!" }));
// => console.log("hello world");
```

if you want to inline specific variables to this

```js
import { Block } from "gen-js-block";

const block = new Block(
  ($message, $message2) => {
    console.log($message, $message2);
  },
  { inlineVariables: ["$message"] }
);

console.log(
  block.build({ $message: "hello world!", $message2: "hello, again" })
);
// => const $message2 = "hello again";console.log("hello world", $message2);
```

## insertCode

you could also replace template variables with code instead of values

```js
import { Block, insertCode } from "gen-js-block";

const block = new Block(($varName) => {
  $varName = "hello world";
}, { inlineVariables: true });

console.log(block.build({ $varName: insertCode("helloWorld") }));
// => helloWorld = "hello world";
```

## eval method

if you want to build the code then run it you can use the eval method

```js
import { Block } from "gen-js-block";

const block = new Block(($message) => {
  console.log($message);
});

block.eval({ $message: "hello world!" });
// prints "hello world!"
```

## usage in typescript

all template variables must be typed like so

```ts
import { Block } from "gen-js-block";

const block = new Block<{ $message: string; $array: number[] }>(
  ($message: string, $array: number[]) => {
    console.log($message, $array);
  }
);
```

and if there is a non-template variables that will be defined else where you pass it as an argument

```ts
const block = new Block<{}>((definedElseWhere: string) => {
  // no errors!
  console.log(definedElseWhere);
});
```

## important notes

1. all template variables must be start with $
1. new variables defined in template loop must start with $ (since they're template vars). example:

   ```js
   // will throw an error
   const block = new Block(($array) => {
     // should be $item...
     for (const item of $array) {
       console.log(item);
     }
   });

   block.build({ $array: [0, 1, 2] });
   ```

1. result code inside template loops or ifs will be warped in a block. example:

   ```js
   // this wont error
   const block = new Block(($condition) => {
     const some = 0;
     if ($condition) {
       const some = 1;
       console.log(some);
     }
     console.log(some);
   });

   block.build({ $condition: true });
   // => {const some = 0;{const some = 1;console.log(some);}console.log(some);}
   ```

1. c-style loops can't be template loops (at least for now), example:

   ```js
   // won't work (will be in result code)
   const block = new Block(($array) => {
     for (let $i = 0; $i < $array.length; $i++) {
       console.log($array[$i]);
     }
   });

   block.build({ $array: [0, 1, 2] });
   // => {for (let $i = 0; $i < $array.length; $i++) {console.log($array[$i]);}}
   // not the output you want!
   ```

1. no template switch statements (at least for now)
   ```js
   // won't work!
   const block = new Block(($number) => {
     switch ($number) {
       case 0:
         console.log("zero");
       case 1:
         console.log("one");
     }
   });
   ```
1. can't non-identifier parameters to the function passed to block (since it doesn't make sense)

   ```js
   // all of these will error

   const block = new Block((...$args) => /* ... */);

   const block = new Block(([$item1, $item2]) => /* ... */);

   const block = new Block(({ $key }) => /* ... */);
   ```
