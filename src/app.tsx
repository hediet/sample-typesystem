import { DistinctType, TypeArgument, Type, DistinctTypeInstantiation, AliasType, UnionType } from "./types.ts";

const v = (id: number) => new TypeArgument(id);


const object = new DistinctType("object", 0, []);

const bucket = new DistinctType("bucket", 1, [object.close()]);

const str = new DistinctType("string", 0, []);
const int = new DistinctType("int", 0, []);

const enumerable = new DistinctType("enumerable", 1, [object.close()]);
const collection = new DistinctType("collection", 1, [enumerable.close(v(0))]);
const list = new DistinctType("list", 1, [collection.close(v(0))]);

const pair = new DistinctType("pair", 2, [object.close()]);
const dictionary = new DistinctType("dictionary", 2, [enumerable.close(pair.close(v(0), v(1)))]);



const r1 = list.closeWithInferredArgs(enumerable.close(bucket.close(str.close())));
console.log(r1.toString());


const r2 = dictionary.closeWithInferredArgs(enumerable.close(pair.close(int.close(), int.close())));
console.log(r2.toString());


const valueProvider = new DistinctType("ValueProvider", 1, [object.close()]);
const dynamic = new AliasType("Dynamic", 1, new UnionType(v(0), valueProvider.close(v(0))));
const nul = new DistinctType("Null", 0, []);
const nullable = new AliasType("Nullable", 1, new UnionType(nul.close(), v(0)));
const func = new DistinctType("Func", 1, [valueProvider.close(v(0))]);

const r3 = func.closeWithInferredArgs(dynamic.close(nullable.close(str.close())));
console.log(r3.toString());



/*


False
True
F<1>
Baz<1, ..., 5>
FT := False|True
FT2 := F<False>|F<True>

Instance<1, ..., 30> : Baz< F<10>|F<11>, F<20>|F<21>, F<30>|F<31>,   11|20|30|False,   10|21|30|False>

ExpectedType := Baz< FT2, FT2, FT2,   FT, FT >


*/


