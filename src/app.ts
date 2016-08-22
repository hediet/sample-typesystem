import { Variance, BaseTypeDefinition, TypeParameter, Type, BaseType, AliasTypeDefinition, UnionType } from "./types";

const v = (id: number) => new TypeParameter(id);


const anyType = new BaseTypeDefinition("Any", [], []).close();


const object = new BaseTypeDefinition("object", [], [anyType]);

const bucket = new BaseTypeDefinition("bucket", [Variance.InOut], [object.close()]);

const str = new BaseTypeDefinition("string", [], [anyType]);
const int = new BaseTypeDefinition("int", [], [anyType]);

const enumerable = new BaseTypeDefinition("enumerable", [Variance.Out], [object.close()]);
const collection = new BaseTypeDefinition("collection", [Variance.InOut], [enumerable.close(v(0))]);
const list = new BaseTypeDefinition("list", [Variance.InOut], [collection.close(v(0))]);

function example1() {
    const r = list.closeWithInferredArgs(enumerable.close(bucket.close(str.close())));
    console.log(r.toString());
}

function example2() {
    const pair = new BaseTypeDefinition("pair", [Variance.Out, Variance.Out], [object.close()]);
    const dictionary = new BaseTypeDefinition("dictionary", [Variance.Out, Variance.Out], [enumerable.close(pair.close(v(0), v(1)))]);

    const r = dictionary.closeWithInferredArgs(enumerable.close(pair.close(str.close(), int.close())));
    console.log(r.toString());
}

function example3() {
    const valueProvider = new BaseTypeDefinition("ValueProvider", [Variance.Out], [object.close()]);
    const dynamic = new AliasTypeDefinition("Dynamic", 1, new UnionType(v(0), valueProvider.close(v(0))));
    const nul = new BaseTypeDefinition("Null", [], []);
    const nullable = new AliasTypeDefinition("Nullable", 1, new UnionType(nul.close(), v(0)));
    const func = new BaseTypeDefinition("Func", [Variance.Out], [valueProvider.close(v(0))]);

    const r = func.closeWithInferredArgs(dynamic.close(nullable.close(str.close())));
    console.log(r.toString());

    console.log(func.close(str.close()).isAssignableTo(func.close(anyType)));
}

example3();