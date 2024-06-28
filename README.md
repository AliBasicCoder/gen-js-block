# js-gen

a js-library to generate js code with js code

> if you like this package please star it in [github](https://github.com/AliBasicCoder/js-gen)

## Usage

all variables that start with $ are called template variables

if you use a template variable in an if statement it becomes a template if-statement

and the code inside will not be in the output
if the condition is false

```js
import { Block } from "js-gen";

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
import { Block } from "js-gen";

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
import { Block } from "js-gen";

const block = new Block(($message) => {
  console.log($message);
});

console.log(block.build({ $message: "hello world!" }));
// => {const $message = "hello world!";console.log($message);}
```

## eval method

if you want to build the code then run it you can use the eval method

```js
import { Block } from "js-gen";

const block = new Block(($message) => {
  console.log($message);
});

block.eval({ $message: "hello world!" });
// prints "hello world!"
```

## usage in typescript

all template variables must be typed like so

```ts
import { Block } from "js-gen";

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
