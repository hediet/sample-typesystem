import { TymlTypeInference } from "./tyml";
import { BaseType, BaseTypeDefinition, UnionType, TypeParameter, Variance } from "./types";

const v = (id: number) => new TypeParameter(id);


const { anyType, objectType, primitiveType, stringType, arrayDef } = TymlTypeInference;

const boolType = new BaseTypeDefinition("Boolean", [], [ primitiveType ]).close();
const nullType = new BaseTypeDefinition("Null", [], [ primitiveType ]).close();

function matchExact(r: RegExp, s: string): boolean {
    return new RegExp("^(" + r.source + ")$").test(s);
}

function stringCheck(b: BaseType, value: string): boolean {
    if (b === stringType || b == anyType) return true;
    return false;
}

function primitiveCheck(b: BaseType, value: string): boolean {
    if (b === boolType) return matchExact(/true|false/, value);
    if (b === nullType) return matchExact(/null/, value);
    if (b === stringType || b == anyType) return true;
    return false;
}

var i = new TymlTypeInference(stringCheck, primitiveCheck);

function test1() {
    var nullableBool = new UnionType(boolType, nullType);
    var t = i.inferPrimitiveType(nullableBool, "true");    
    console.log(t.toString());
}

function test2() {
    var mylist = new BaseTypeDefinition("MyList", [Variance.In], [ arrayDef.close(v(0)) ]);
    var myspeclist = new BaseTypeDefinition("MySpecList", [], [ mylist.close(boolType) ]);
    var expected = new UnionType(boolType, myspeclist.close());

    var arrType = i.inferArrayType(expected);
    console.log(arrType.toString());
    console.log(i.getArrayItemType(arrType).toString());
}

test2();


/*

Variance

Array<String> -> Array<Any>
Array<Any> -!> Array<String>
Array<out T>

Factory<String> -> Factory<Any>
Factory<out T>

Setter<Any> -> Setter<String>
Setter<String> -!> Setter<Any>
Setter<in T>

SetterGetter<in T1, out T2>
SetterGetter<Any, String>
-> SetterGetter<String, String>
-> SetterGetter<String, Any>

MyFoo<in T1, in T2>: SetterGetter<T1, T2>



*/

