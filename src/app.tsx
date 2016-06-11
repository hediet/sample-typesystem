import { TypeDefinition, TypeArgument, Type, TypeInstantiation, AliasDefinition, UnionType } from "./types.ts";

const v = (id: number) => new TypeArgument(id);


const anyType = new TypeDefinition("Any", 0, []).close();


const object = new TypeDefinition("object", 0, [anyType]);

const bucket = new TypeDefinition("bucket", 1, [object.close()]);

const str = new TypeDefinition("string", 0, [anyType]);
const int = new TypeDefinition("int", 0, [anyType]);

const enumerable = new TypeDefinition("enumerable", 1, [object.close()]);
const collection = new TypeDefinition("collection", 1, [enumerable.close(v(0))]);
const list = new TypeDefinition("list", 1, [collection.close(v(0))]);

const pair = new TypeDefinition("pair", 2, [object.close()]);
const dictionary = new TypeDefinition("dictionary", 2, [enumerable.close(pair.close(v(0), v(1)))]);



const r1 = list.closeWithInferredArgs(enumerable.close(bucket.close(str.close())));
console.log(r1.toString());


const r2 = dictionary.closeWithInferredArgs(enumerable.close(pair.close(int.close(), int.close())));
console.log(r2.toString());


const valueProvider = new TypeDefinition("ValueProvider", 1, [object.close()]);
const dynamic = new AliasDefinition("Dynamic", 1, new UnionType(v(0), valueProvider.close(v(0))));
const nul = new TypeDefinition("Null", 0, []);
const nullable = new AliasDefinition("Nullable", 1, new UnionType(nul.close(), v(0)));
const func = new TypeDefinition("Func", 1, [valueProvider.close(v(0))]);

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


