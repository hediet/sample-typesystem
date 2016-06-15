import { BaseTypeDefinition, TypeArgument, Type, BaseType, AliasTypeDefinition, UnionType } from "./types.ts";

const v = (id: number) => new TypeArgument(id);


const anyType = new BaseTypeDefinition("Any", 0, []).close();


const object = new BaseTypeDefinition("object", 0, [anyType]);

const bucket = new BaseTypeDefinition("bucket", 1, [object.close()]);

const str = new BaseTypeDefinition("string", 0, [anyType]);
const int = new BaseTypeDefinition("int", 0, [anyType]);

const enumerable = new BaseTypeDefinition("enumerable", 1, [object.close()]);
const collection = new BaseTypeDefinition("collection", 1, [enumerable.close(v(0))]);
const list = new BaseTypeDefinition("list", 1, [collection.close(v(0))]);


function example1() {
    const r = list.closeWithInferredArgs(enumerable.close(bucket.close(str.close())));
    console.log(r.toString());
}

function example2() {
    const pair = new BaseTypeDefinition("pair", 2, [object.close()]);
    const dictionary = new BaseTypeDefinition("dictionary", 2, [enumerable.close(pair.close(v(0), v(1)))]);

    const r = dictionary.closeWithInferredArgs(enumerable.close(pair.close(str.close(), int.close())));
    console.log(r.toString());
}

function example3() {
    const valueProvider = new BaseTypeDefinition("ValueProvider", 1, [object.close()]);
    const dynamic = new AliasTypeDefinition("Dynamic", 1, new UnionType(v(0), valueProvider.close(v(0))));
    const nul = new BaseTypeDefinition("Null", 0, []);
    const nullable = new AliasTypeDefinition("Nullable", 1, new UnionType(nul.close(), v(0)));
    const func = new BaseTypeDefinition("Func", 1, [valueProvider.close(v(0))]);

    const r = func.closeWithInferredArgs(dynamic.close(nullable.close(str.close())));
    console.log(r.toString());
}
